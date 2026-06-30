import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Order } from '../entities/order.entity';
import { OrderItem, OrderSourceType } from '../entities/order.item.entity';
import { CreateOrderDto } from '../dtos/create.order.dto';
import { PaymentsService } from '../../payments/services/payments.service';
import { UserService } from '../../user/user.service';
import { AppConfigService } from '../../app-data';
import { AppDataService } from '../../app-data/services/app-data.service';
import { MarketplaceFeeResolverService } from '../../payments/services/marketplace-fee-resolver.service';
import { Catalog } from '../../catalog/entities/catalog.entity';
import { CatalogItem } from '../../catalog/entities/catalog-item.entity';
import { LoggerService } from '../../core/logger';
import { OrderStatus } from '../enums/order-status.enum';
import { NotificationsService } from '../../notifications/notifications.service';
import { PaginatedResult } from '../../core/interceptors/response-transform.interceptor';
import { Commerce } from '../../commerce/entities/commerce.entity';
import { TenantContext } from '../../auth/types/tenant-context.types';

interface OwnerResolution {
  ownerId: string;
  commerceId: string | null;
}

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItemRepository: Repository<OrderItem>,
    @InjectRepository(Catalog)
    private readonly catalogRepository: Repository<Catalog>,
    @InjectRepository(CatalogItem)
    private readonly catalogItemRepository: Repository<CatalogItem>,
    @InjectRepository(Commerce)
    private readonly commerceRepository: Repository<Commerce>,

    private paymentService: PaymentsService,
    private userService: UserService,
    private readonly appConfig: AppConfigService,
    private readonly appDataService: AppDataService,
    private readonly feeResolver: MarketplaceFeeResolverService,
    private readonly logger: LoggerService,
    private readonly dataSource: DataSource,
    private readonly notificationsService: NotificationsService,
  ) {
    this.logger.setContext('OrdersService');
  }

  /**
   * Determina automáticamente el ownerId y commerceId basado en los items de la orden
   * y valida que todos los items pertenezcan al mismo comercio.
   */
  private async determineOwnerAndValidate(
    items: CreateOrderDto['items'],
  ): Promise<OwnerResolution> {
    try {
      let foundOwnerId: string | null = null;
      let foundCommerceId: string | null = null;

      for (const item of items) {
        const catalogItem = await this.catalogItemRepository.findOne({
          where: { id: item.sourceId },
          relations: ['catalog'],
        });

        if (!catalogItem || !catalogItem.catalog) {
          throw new BadRequestException(
            `Item con ID ${item.sourceId} no encontrado o no tiene catálogo asociado.`,
          );
        }

        const currentOwnerId = catalogItem.catalog.ownerId;
        const currentCommerceId = catalogItem.catalog.commerceId;

        if (foundOwnerId && foundOwnerId !== currentOwnerId) {
          throw new BadRequestException(
            'No se permiten órdenes con productos de diferentes negocios.',
          );
        }

        if (
          foundCommerceId &&
          currentCommerceId &&
          foundCommerceId !== currentCommerceId
        ) {
          throw new BadRequestException(
            'No se permiten órdenes con productos de diferentes comercios.',
          );
        }

        foundOwnerId = currentOwnerId;
        foundCommerceId = currentCommerceId || null;
      }

      if (!foundOwnerId) {
        throw new BadRequestException(
          'No se pudo determinar el propietario del negocio para esta orden.',
        );
      }

      return { ownerId: foundOwnerId, commerceId: foundCommerceId };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.logger.error(
        `Error validating owner ID: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        'Error al validar el propietario del negocio.',
      );
    }
  }

  /**
   * Calcula los montos de la orden basándose en los precios REALES de la base de datos
   * y usando el MarketplaceFeeResolverService para aplicar el fee correcto por plan de membresía.
   */
  private async calculateSecureOrderAmounts(
    items: CreateOrderDto['items'],
    ownerId: string,
    commerceId: string | null,
  ): Promise<{
    subtotal: number;
    marketplaceFeePercentage: number;
    marketplaceFeeAmount: number;
    total: number;
    itemsWithFixedPrices: any[];
  }> {
    let subtotal = 0;
    const itemsWithFixedPrices = [];

    for (const item of items) {
      const dbItem = await this.catalogItemRepository.findOne({
        where: { id: item.sourceId },
      });

      if (!dbItem) {
        throw new BadRequestException(
          `Producto ${item.productName} (ID: ${item.sourceId}) no encontrado en el catálogo.`,
        );
      }

      // IMPORTANTE: Siempre usamos el precio de la base de datos (servidor)
      const price = dbItem.discountPrice ?? dbItem.price;
      subtotal += price * item.quantity;

      itemsWithFixedPrices.push({
        ...item,
        price, // Sobreescribimos con el precio real validado
      });
    }

    // 0.3: Usar MarketplaceFeeResolverService con jerarquía de 3 niveles
    // (custom → membership 7/5/3 → global) en lugar del fee global plano.
    const feeResolution = await this.feeResolver.resolveFeePercentage(
      ownerId,
      commerceId ?? undefined,
    );
    const marketplaceFeePercentage = feeResolution.percentage;
    const marketplaceFeeAmount =
      Math.round(subtotal * marketplaceFeePercentage) / 100;
    const total = subtotal + marketplaceFeeAmount;

    return {
      subtotal,
      marketplaceFeePercentage,
      marketplaceFeeAmount,
      total,
      itemsWithFixedPrices,
    };
  }

  async create(
    createOrderDto: CreateOrderDto,
    tenantId?: string,
  ): Promise<Order> {
    // 1. Verificar configuraciones del sistema
    await this.checkOrderingConfig();

    // 2. Validar límites de items
    await this.validateOrderLimits(createOrderDto.items);

    // 3. Determinar Owner y Commerce, validar integridad (mismo dueño para todos los items)
    const { ownerId, commerceId } = await this.determineOwnerAndValidate(
      createOrderDto.items,
    );

    // 4. Validar que el tenant del usuario coincida con el commerce de los items
    if (tenantId && commerceId && tenantId !== commerceId) {
      throw new BadRequestException(
        'No tienes acceso para crear órdenes en este comercio.',
      );
    }

    // 5. Calcular montos seguros (precios de servidor) con fee dinámico
    const secureAmounts = await this.calculateSecureOrderAmounts(
      createOrderDto.items,
      ownerId,
      commerceId,
    );

    // 6. Preparar datos del cliente
    let { customerEmail, customerPhone, customerName, customerLastName } =
      createOrderDto;
    const { createdBy } = createOrderDto;

    if (createdBy) {
      try {
        const user = await this.userService.findOne(createdBy);
        if (user) {
          customerEmail = user.email || customerEmail;
          customerPhone = user.phone || customerPhone;
          if (!customerName && user.name) {
            const nameParts = user.name.trim().split(' ');
            customerName = nameParts[0];
            customerLastName = nameParts.slice(1).join(' ') || customerLastName;
          }
        }
      } catch (e) {}
    }

    // Fallback para datos faltantes
    customerEmail = customerEmail || 'anon@fake.com';
    customerPhone = customerPhone || '0000000000';

    // 7. Ejecutar todo en una transacción atómica
    const order = await this.dataSource.transaction(async (manager) => {
      try {
        // Crear la orden inicial
        const order = manager.create(Order, {
          customerEmail,
          customerPhone,
          customerName,
          customerLastName,
          ownerId,
          commerceId,
          createdBy,
          subtotal: secureAmounts.subtotal,
          marketplaceFeePercentage: secureAmounts.marketplaceFeePercentage,
          marketplaceFeeAmount: secureAmounts.marketplaceFeeAmount,
          total: secureAmounts.total,
          status: OrderStatus.PENDING,
        });

        const savedOrder = await manager.save(Order, order);

        // Crear los ítems con los precios validados
        const orderItems = secureAmounts.itemsWithFixedPrices.map((item) =>
          manager.create(OrderItem, {
            ...item,
            sourceType: item.sourceType as OrderSourceType,
            order: savedOrder,
          }),
        );
        await manager.save(OrderItem, orderItems);

        // Generar el intento de pago con Mercado Pago
        const paymentIntent = await this.paymentService.createPayment(
          customerEmail,
          secureAmounts.total,
          `Orden #${savedOrder.id.substring(0, 8)}`,
          ownerId,
          commerceId,
          createdBy,
          savedOrder.id,
          secureAmounts.marketplaceFeeAmount,
          customerName,
          customerLastName,
        );

        // Actualizar la orden con los datos de pago
        savedOrder.operationID = paymentIntent.id;
        if (paymentIntent.transaction_id) {
          savedOrder.paymentUrl = paymentIntent.init_point;
        }

        const finalOrder = await manager.save(Order, savedOrder);
        finalOrder.items = orderItems;

        return finalOrder;
      } catch (error) {
        this.logger.error(
          `Error en transacción de creación de orden: ${error.message}`,
          error.stack,
        );
        throw new InternalServerErrorException(
          `No se pudo procesar la orden: ${error.message}`,
        );
      }
    });

    // Notificar al dueño del negocio sobre la nueva orden
    if (order?.id && ownerId) {
      this.notificationsService
        .sendNotificationToUser(
          ownerId,
          'Nueva orden recibida',
          `Has recibido una nueva orden por $${Number(order.total).toFixed(2)}.`,
          { orderId: order.id, type: 'new_order' },
        )
        .catch((err) =>
          this.logger.warn(
            `Error enviando notificación al owner: ${err.message}`,
          ),
        );
    }

    return order;
  }

  // Otros métodos (findOne, findAll, update, delete) pueden seguir este patrón
  async findOne(id: string): Promise<any> {
    try {
      const order = await this.orderRepository.findOne({
        where: { id },
        relations: ['items', 'owner'],
      });
      if (!order) {
        throw new NotFoundException(`Orden con id ${id} no encontrada`);
      }
      return this.mapOrderStoreInfo(order);
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        `Error al buscar la orden: ${error.message}`,
      );
    }
  }
  async findAll(
    page: number = 1,
    limit: number = 10,
    tenant?: TenantContext,
  ): Promise<PaginatedResult<any>> {
    try {
      const skip = (page - 1) * limit;
      const where: any = {};
      if (tenant?.commerceId) {
        where.commerceId = tenant.commerceId;
      }
      const [data, total] = await this.orderRepository.findAndCount({
        where,
        relations: ['items', 'owner'],
        skip,
        take: limit,
        order: { createdAt: 'DESC' },
      });
      return { data: data.map(this.mapOrderStoreInfo), total, page, limit };
    } catch (error) {
      throw new InternalServerErrorException(
        `Error al obtener las órdenes: ${error.message}`,
      );
    }
  }

  async findByOwner(customerEmail: string): Promise<any[]> {
    try {
      const orders = await this.orderRepository.find({
        where: { customerEmail },
        relations: ['items', 'owner'],
        order: { createdAt: 'DESC' },
      });
      return orders.map(this.mapOrderStoreInfo);
    } catch (error) {
      throw new InternalServerErrorException(
        `Error al obtener órdenes por email: ${error.message}`,
      );
    }
  }

  private mapOrderStoreInfo(order: Order): any {
    if (!order.owner) {
      const { owner, ...rest } = order;
      return { ...rest, store: null };
    }
    const { owner, ...rest } = order;
    return {
      ...rest,
      store: {
        id: owner.id,
        businessName: owner.businessName || owner.name,
        slug: owner.slug,
        coverImageUrl: owner.coverImageUrl || owner.photoURL,
        businessPhone: owner.businessPhone || owner.phone,
        businessAddress: owner.businessAddress,
      },
    };
  }

  async findByUserId(
    userId: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<PaginatedResult<any>> {
    try {
      const user = await this.userService.findOne(userId);
      if (!user) {
        throw new NotFoundException(`Usuario con id ${userId} no encontrado`);
      }
      this.logger.debug(`Buscando órdenes para el usuario: ${user.email}`);

      const skip = (page - 1) * limit;
      const [data, total] = await this.orderRepository.findAndCount({
        where: { customerEmail: user.email },
        relations: ['items', 'owner'],
        order: { createdAt: 'DESC' },
        skip,
        take: limit,
      });
      return { data: data.map(this.mapOrderStoreInfo), total, page, limit };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        `Error al obtener órdenes por ID de usuario: ${error.message}`,
      );
    }
  }

  async findByCreator(createdBy: string): Promise<any[]> {
    try {
      const orders = await this.orderRepository.find({
        where: { createdBy },
        relations: ['items', 'owner'],
        order: { createdAt: 'DESC' },
      });
      return orders.map(this.mapOrderStoreInfo);
    } catch (error) {
      throw new InternalServerErrorException(
        `Error al obtener órdenes por creador: ${error.message}`,
      );
    }
  }

  async findByOwnerId(
    ownerId: string,
    page: number = 1,
    limit: number = 10,
    tenant?: TenantContext,
  ): Promise<PaginatedResult<any>> {
    try {
      if (!ownerId) {
        throw new BadRequestException('El ID del propietario es requerido');
      }

      const skip = (page - 1) * limit;

      const where: any = {};
      if (tenant?.commerceId) {
        const commerce = await this.commerceRepository.findOne({
          where: { id: tenant.commerceId, ownerId },
        });
        if (!commerce) {
          throw new BadRequestException(
            'El comercio especificado no pertenece al propietario',
          );
        }
        where.commerceId = tenant.commerceId;
      } else {
        where.ownerId = ownerId;
      }

      const [data, total] = await this.orderRepository.findAndCount({
        where,
        relations: ['items', 'owner'],
        order: { createdAt: 'DESC' },
        skip,
        take: limit,
      });
      return { data: data.map(this.mapOrderStoreInfo), total, page, limit };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException(
        `Error al obtener órdenes por ID de propietario: ${error.message}`,
      );
    }
  }

  async update(
    id: string,
    updateOrderDto: Partial<CreateOrderDto>,
  ): Promise<Order> {
    try {
      const order = await this.orderRepository.findOne({
        where: { id },
        relations: ['items'],
      });
      if (!order) {
        throw new NotFoundException(`Orden con id ${id} no encontrada`);
      }

      // Update order fields
      Object.assign(order, updateOrderDto);

      // If items are provided, update them (simple replace logic)
      if (updateOrderDto.items) {
        // Remove existing items
        await this.orderItemRepository.delete({ order: { id } });
        // Add new items
        const newItems = updateOrderDto.items.map((itemDto) =>
          this.orderItemRepository.create({
            ...itemDto,
            sourceType: itemDto.sourceType as OrderSourceType,
            order,
          }),
        );
        await this.orderItemRepository.save(newItems);
      }

      await this.orderRepository.save(order);

      return this.mapOrderStoreInfo(
        await this.orderRepository.findOne({
          where: { id },
          relations: ['items', 'owner'],
        }),
      );
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        `Error al actualizar la orden: ${error.message}`,
      );
    }
  }

  async delete(id: string): Promise<void> {
    try {
      const order = await this.orderRepository.findOne({ where: { id } });
      if (!order) {
        throw new NotFoundException(`Orden con id ${id} no encontrada`);
      }
      // Delete related items first due to FK constraints
      await this.orderItemRepository.delete({ order: { id } });
      await this.orderRepository.delete(id);
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        `Error al eliminar la orden: ${error.message}`,
      );
    }
  }

  /**
   * Actualiza el estado de una orden
   */
  async updateOrderStatus(orderId: string, status: OrderStatus): Promise<any> {
    try {
      const order = await this.orderRepository.findOne({
        where: { id: orderId },
        relations: ['items', 'owner'],
      });

      if (!order) {
        throw new NotFoundException(`Orden con id ${orderId} no encontrada`);
      }

      // Idempotencia: si ya tiene el mismo estado, no hacer nada
      if (order.status === status) {
        this.logger.debug(
          `Order ${orderId} ya está en estado ${status}. Saltando update.`,
        );
        return this.mapOrderStoreInfo(order);
      }

      // Si la orden ya está en un estado final, no permitir cambios (a menos que sea una corrección específica)
      if (
        order.status === OrderStatus.CONFIRMED &&
        status === OrderStatus.PENDING
      ) {
        this.logger.warn(
          `Intento de cambiar orden CONFIRMED ${orderId} a PENDING bloqueado.`,
        );
        return this.mapOrderStoreInfo(order);
      }

      const prevStatus = order.status;
      order.status = status;
      await this.orderRepository.save(order);

      const updatedOrder = this.mapOrderStoreInfo(
        await this.orderRepository.findOne({
          where: { id: orderId },
          relations: ['items', 'owner'],
        }),
      );

      // Notificaciones FCM según el nuevo estado
      this.sendStatusChangeNotifications(updatedOrder, prevStatus, status);

      return updatedOrder;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        `Error al actualizar el estado de la orden: ${error.message}`,
      );
    }
  }

  /**
   * Actualiza el estado de cumplimiento de la orden (processing, shipped, delivered).
   * Solo permite transiciones hacia adelante: confirmed → processing → shipped → delivered.
   * Rechaza cambios si el pago no está approved.
   */
  async updateOrderFulfillmentStatus(
    orderId: string,
    newStatus: OrderStatus,
  ): Promise<any> {
    try {
      const order = await this.orderRepository.findOne({
        where: { id: orderId },
      });

      if (!order) {
        throw new NotFoundException(`Orden con id ${orderId} no encontrada`);
      }

      const validTransitions: Record<OrderStatus, OrderStatus[]> = {
        [OrderStatus.PENDING]: [OrderStatus.CONFIRMED],
        [OrderStatus.CONFIRMED]: [OrderStatus.PROCESSING],
        [OrderStatus.PROCESSING]: [OrderStatus.SHIPPED],
        [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED],
        [OrderStatus.DELIVERED]: [],
        [OrderStatus.CANCELLED]: [],
        [OrderStatus.FAILED]: [],
      };

      const allowedNext = validTransitions[order.status];
      if (!allowedNext || !allowedNext.includes(newStatus)) {
        throw new BadRequestException(
          `No se puede cambiar de ${order.status} a ${newStatus}. Transición no válida.`,
        );
      }

      if (order.paymentStatus !== 'approved') {
        throw new BadRequestException(
          'No se puede actualizar el estado de cumplimiento porque el pago no está aprobado.',
        );
      }

      const prevStatus = order.status;
      order.status = newStatus;
      await this.orderRepository.save(order);

      const updatedOrder = this.mapOrderStoreInfo(
        await this.orderRepository.findOne({
          where: { id: orderId },
          relations: ['items', 'owner'],
        }),
      );

      this.sendStatusChangeNotifications(updatedOrder, prevStatus, newStatus);

      return updatedOrder;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      )
        throw error;
      throw new InternalServerErrorException(
        `Error al actualizar el estado de cumplimiento: ${error.message}`,
      );
    }
  }

  /**
   * Actualiza los datos de comisiones de Mercado Pago en una orden.
   * Se llama desde el webhook cuando MP confirma el pago.
   */
  async updateOrderPaymentFees(
    orderId: string,
    mpProcessingFee: number,
    netAmount: number,
    paymentStatus?: string,
  ): Promise<Order> {
    try {
      const order = await this.orderRepository.findOne({
        where: { id: orderId },
      });

      if (!order) {
        throw new NotFoundException(`Orden con id ${orderId} no encontrada`);
      }

      order.mpProcessingFee = mpProcessingFee;
      order.netAmount = netAmount;
      if (paymentStatus !== undefined) {
        order.paymentStatus = paymentStatus;
      }
      await this.orderRepository.save(order);

      return this.mapOrderStoreInfo(
        await this.orderRepository.findOne({
          where: { id: orderId },
          relations: ['items', 'owner'],
        }),
      );
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        `Error al actualizar fees de pago: ${error.message}`,
      );
    }
  }

  async markChargebackProcessed(orderId: string): Promise<void> {
    await this.orderRepository.update(orderId, {
      chargebackProcessedAt: new Date(),
    });
  }

  /**
   * Busca una orden por operationID (PaymentIntent ID)
   */
  async findByOperationId(operationId: string): Promise<any | null> {
    try {
      const order = await this.orderRepository.findOne({
        where: { operationID: operationId },
        relations: ['items', 'owner'],
      });
      if (!order) return null;
      return this.mapOrderStoreInfo(order);
    } catch (error) {
      throw new InternalServerErrorException(
        `Error al buscar orden por ID de operación: ${error.message}`,
      );
    }
  }

  private async sendStatusChangeNotifications(
    order: Order,
    prevStatus: OrderStatus,
    newStatus: OrderStatus,
  ): Promise<void> {
    if (!order) return;

    const notifications: Promise<boolean>[] = [];

    if (
      newStatus === OrderStatus.CONFIRMED &&
      prevStatus !== OrderStatus.CONFIRMED
    ) {
      // Notificar al comprador que su pago fue confirmado
      if (order.createdBy) {
        notifications.push(
          this.notificationsService.sendNotificationToUser(
            order.createdBy,
            'Pago confirmado',
            `Tu pago de $${Number(order.total).toFixed(2)} ha sido confirmado.`,
            { orderId: order.id, type: 'payment_confirmed' },
          ),
        );
      }

      // Notificar al dueño que el pago fue recibido
      if (order.ownerId) {
        notifications.push(
          this.notificationsService.sendNotificationToUser(
            order.ownerId,
            'Pago recibido',
            `El pago de la orden por $${Number(order.total).toFixed(2)} ha sido confirmado.`,
            { orderId: order.id, type: 'payment_received' },
          ),
        );
      }
    }

    if (
      newStatus === OrderStatus.CANCELLED &&
      prevStatus !== OrderStatus.CANCELLED
    ) {
      if (order.createdBy) {
        notifications.push(
          this.notificationsService.sendNotificationToUser(
            order.createdBy,
            'Orden cancelada',
            'Tu orden ha sido cancelada.',
            { orderId: order.id, type: 'order_cancelled' },
          ),
        );
      }
    }

    if (newStatus === OrderStatus.FAILED && prevStatus !== OrderStatus.FAILED) {
      if (order.createdBy) {
        notifications.push(
          this.notificationsService.sendNotificationToUser(
            order.createdBy,
            'Pago fallido',
            'El pago de tu orden no pudo ser procesado.',
            { orderId: order.id, type: 'payment_failed' },
          ),
        );
      }
    }

    // Notificaciones de cumplimiento para el comprador
    if (
      newStatus === OrderStatus.PROCESSING &&
      prevStatus !== OrderStatus.PROCESSING
    ) {
      if (order.createdBy) {
        notifications.push(
          this.notificationsService.sendNotificationToUser(
            order.createdBy,
            'Orden en preparación',
            'Tu orden está siendo preparada.',
            { orderId: order.id, type: 'order_processing' },
          ),
        );
      }
    }

    if (
      newStatus === OrderStatus.SHIPPED &&
      prevStatus !== OrderStatus.SHIPPED
    ) {
      if (order.createdBy) {
        notifications.push(
          this.notificationsService.sendNotificationToUser(
            order.createdBy,
            'Orden enviada',
            'Tu orden ha sido enviada.',
            { orderId: order.id, type: 'order_shipped' },
          ),
        );
      }
    }

    if (
      newStatus === OrderStatus.DELIVERED &&
      prevStatus !== OrderStatus.DELIVERED
    ) {
      if (order.createdBy) {
        notifications.push(
          this.notificationsService.sendNotificationToUser(
            order.createdBy,
            'Orden entregada',
            'Tu orden ha sido entregada.',
            { orderId: order.id, type: 'order_delivered' },
          ),
        );
      }
    }

    if (notifications.length > 0) {
      await Promise.allSettled(notifications).then((results) => {
        results.forEach((r, i) => {
          if (r.status === 'rejected') {
            this.logger.warn(
              `Notificación FCM fallida: ${r.reason?.message || 'unknown error'}`,
            );
          }
        });
      });
    }
  }

  /**
   * Ejemplo: Verificar configuraciones del sistema antes de procesar órdenes
   */
  private async checkOrderingConfig(): Promise<void> {
    // Verificar si el sistema de órdenes está habilitado
    const orderingEnabled = await this.appConfig.getBoolean(
      'ordering_enabled',
      true,
    );

    if (!orderingEnabled) {
      const maintenanceMessage = await this.appConfig.getString(
        'ordering_disabled_message',
        'El sistema de órdenes está temporalmente deshabilitado',
      );
      throw new BadRequestException(maintenanceMessage);
    }

    //verifica el percentage_fee
    const percentageFee = await this.appConfig.getNumber('percentage_fee', 0);
    if (percentageFee < 0 || percentageFee > 100) {
      throw new BadRequestException(
        `El porcentaje de comisión debe estar entre 0 y 100`,
      );
    }

    // Verificar modo de mantenimiento
    const maintenanceMode = await this.appConfig.getBoolean(
      'maintenance_mode',
      false,
    );

    if (maintenanceMode) {
      const maintenanceMessage = await this.appConfig.getString(
        'maintenance_message',
        'Sistema en mantenimiento. Inténtalo más tarde.',
      );
      throw new BadRequestException(maintenanceMessage);
    }
  }

  /**
   * Ejemplo: Validar límites de orden según configuración
   */
  private async validateOrderLimits(
    items: CreateOrderDto['items'],
  ): Promise<void> {
    // Obtener límites configurables
    const maxItemsPerOrder = await this.appConfig.getNumber(
      'max_items_per_order',
      10,
    );

    const minOrderValue = await this.appConfig.getNumber('min_order_value', 5);

    // Validar número de items
    if (items.length > maxItemsPerOrder) {
      throw new BadRequestException(
        `La orden no puede tener más de ${maxItemsPerOrder} items`,
      );
    }

    // Calcular valor total de items
    const totalValue = items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );

    // Validar valor mínimo
    if (totalValue < minOrderValue) {
      throw new BadRequestException(
        `El valor mínimo de orden es $${minOrderValue}`,
      );
    }

    // Verificar si ciertos tipos de items están permitidos
    const allowWardobeItems = await this.appConfig.getBoolean(
      'allow_wardrobe_items',
      true,
    );
    const allowMenuItems = await this.appConfig.getBoolean(
      'allow_menu_items',
      true,
    );

    for (const item of items) {
      if (item.sourceType === 'wardrobe' && !allowWardobeItems) {
        throw new BadRequestException(
          'Los items de guardarropa están temporalmente deshabilitados',
        );
      }

      if (item.sourceType === 'menu' && !allowMenuItems) {
        throw new BadRequestException(
          'Los items de menú están temporalmente deshabilitados',
        );
      }
    }
  }

  /**
   * Ejemplo: Obtener configuraciones de notificación
   */
  async getNotificationSettings(): Promise<any> {
    return await this.appConfig.getObject('notification_settings', {
      email_enabled: true,
      sms_enabled: false,
      push_enabled: true,
      order_confirmation: true,
      payment_confirmation: true,
      order_ready: true,
    });
  }

  /**
   * Ejemplo: Obtener configuraciones de horario de servicio
   */
  async getServiceHours(): Promise<any> {
    return await this.appConfig.getObject('service_hours', {
      monday: { open: '08:00', close: '22:00', enabled: true },
      tuesday: { open: '08:00', close: '22:00', enabled: true },
      wednesday: { open: '08:00', close: '22:00', enabled: true },
      thursday: { open: '08:00', close: '22:00', enabled: true },
      friday: { open: '08:00', close: '22:00', enabled: true },
      saturday: { open: '10:00', close: '20:00', enabled: true },
      sunday: { open: '10:00', close: '18:00', enabled: false },
    });
  }

  async countAll(): Promise<number> {
    try {
      return await this.orderRepository.count();
    } catch (error) {
      throw new InternalServerErrorException(
        `Error al contar las órdenes: ${error.message}`,
      );
    }
  }

  async getTotalRevenue(): Promise<number> {
    try {
      const result = await this.orderRepository
        .createQueryBuilder('order')
        .select('SUM(order.total)', 'total')
        .getRawOne();
      return parseFloat(result.total) || 0;
    } catch (error) {
      throw new InternalServerErrorException(
        `Error al calcular los ingresos totales: ${error.message}`,
      );
    }
  }
}
