import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Order } from '../entities/order.entity';
import { OrderItem, OrderSourceType } from '../entities/order.item.entity';
import { CreateOrderDto } from '../dtos/create.order.dto';
import { PaymentsService } from 'src/payments/services/payments.service';
import { UserService } from 'src/user/user.service';
import { AppConfigService } from 'src/app-data';
import { AppDataService } from 'src/app-data/services/app-data.service';
import { Catalog } from 'src/catalog/entities/catalog.entity';
import { CatalogItem } from 'src/catalog/entities/catalog-item.entity';
import { LoggerService } from 'src/core/logger';
import { OrderStatus } from '../enums/order-status.enum';

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

    private paymentService: PaymentsService,
    private userService: UserService,
    private readonly appConfig: AppConfigService,
    private readonly appDataService: AppDataService,
    private readonly logger: LoggerService,
    private readonly dataSource: DataSource,
  ) {
    this.logger.setContext('OrdersService');
  }

  /**
   * Determina automáticamente el ownerId basado en los items de la orden
   * y valida que todos los items pertenezcan al mismo propietario.
   */
  private async determineOwnerIdAndValidate(
    items: CreateOrderDto['items'],
  ): Promise<string> {
    try {
      let foundOwnerId: string | null = null;

      for (const item of items) {
        if (item.sourceId && (item.sourceType === 'menu' || item.sourceType === 'wardrobe')) {
          const catalogItem = await this.catalogItemRepository.findOne({
            where: { id: item.sourceId },
            relations: ['catalog'],
          });

          if (!catalogItem || !catalogItem.catalog) {
            throw new BadRequestException(`Item con ID ${item.sourceId} no encontrado o no tiene catálogo asociado.`);
          }

          const currentOwnerId = catalogItem.catalog.ownerId;

          if (foundOwnerId && foundOwnerId !== currentOwnerId) {
            throw new BadRequestException('No se permiten órdenes con productos de diferentes negocios.');
          }

          foundOwnerId = currentOwnerId;
        }
      }

      if (!foundOwnerId) {
        throw new BadRequestException('No se pudo determinar el propietario del negocio para esta orden.');
      }

      return foundOwnerId;
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.logger.error(`Error validating owner ID: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Error al validar el propietario del negocio.');
    }
  }

  /**
   * Calcula los montos de la orden basándose en los precios REALES de la base de datos
   */
  private async calculateSecureOrderAmounts(items: CreateOrderDto['items']): Promise<{
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
        where: { id: item.sourceId }
      });

      if (!dbItem) {
        throw new BadRequestException(`Producto ${item.productName} no encontrado.`);
      }

      // IMPORTANTE: Usamos el precio de la base de datos, no el del frontend
      const price = dbItem.discountPrice ?? dbItem.price;
      subtotal += price * item.quantity;

      itemsWithFixedPrices.push({
        ...item,
        price, // Sobreescribimos con el precio real
      });
    }

    const marketplaceFeePercentage = await this.appDataService.getMarketplaceFeePercentage();
    const marketplaceFeeAmount = (subtotal * marketplaceFeePercentage) / 100;
    const total = subtotal + marketplaceFeeAmount;

    return {
      subtotal,
      marketplaceFeePercentage,
      marketplaceFeeAmount,
      total,
      itemsWithFixedPrices
    };
  }

  async create(createOrderDto: CreateOrderDto): Promise<Order> {
    // 1. Verificar configuraciones del sistema
    await this.checkOrderingConfig();

    // 2. Validar límites de items
    await this.validateOrderLimits(createOrderDto.items);

    // 3. Determinar Owner y validar integridad (mismo dueño para todos los items)
    const ownerId = await this.determineOwnerIdAndValidate(createOrderDto.items);

    // 4. Calcular montos seguros (precios de servidor)
    const secureAmounts = await this.calculateSecureOrderAmounts(createOrderDto.items);

    // 5. Preparar datos del cliente
    let { customerEmail, customerPhone, customerName, customerLastName } = createOrderDto;
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

    // 6. Ejecutar todo en una transacción atómica
    return await this.dataSource.transaction(async (manager) => {
      try {
        // Crear la orden inicial
        const order = manager.create(Order, {
          customerEmail,
          customerPhone,
          customerName,
          customerLastName,
          ownerId,
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
        this.logger.error(`Error en transacción de creación de orden: ${error.message}`, error.stack);
        throw new InternalServerErrorException(`No se pudo procesar la orden: ${error.message}`);
      }
    });
  }

  // Otros métodos (findOne, findAll, update, delete) pueden seguir este patrón
  async findOne(id: string): Promise<Order> {
    try {
      const order = await this.orderRepository.findOne({
        where: { id },
        relations: ['items'],
      });
      if (!order) {
        throw new Error(`Order with id ${id} not found`);
      }
      return order;
    } catch (error) {
      throw new Error(`Error finding order: ${error.message}`);
    }
  }
  async findAll(page: number = 1, limit: number = 10): Promise<Order[]> {
    try {
      const skip = (page - 1) * limit;
      return await this.orderRepository.find({
        relations: ['items'],
        skip,
        take: limit,
        order: { createdAt: 'DESC' },
      });
    } catch (error) {
      throw new Error(`Error finding orders: ${error.message}`);
    }
  }

  async findByOwner(customerEmail: string): Promise<Order[]> {
    try {
      return await this.orderRepository.find({
        where: { customerEmail },
        relations: ['items'],
        order: { createdAt: 'DESC' },
      });
    } catch (error) {
      throw new Error(`Error finding orders by owner: ${error.message}`);
    }
  }

  async findByUserId(userId: string, page: number = 1, limit: number = 10): Promise<Order[]> {
    try {
      // Get user's email
      const user = await this.userService.findOne(userId);
      if (!user) {
        throw new Error(`User with id ${userId} not found`);
      }
      this.logger.debug(`Finding orders for user: ${user.email}`);
      
      const skip = (page - 1) * limit;
      return await this.orderRepository.find({
        where: { customerEmail: user.email },
        relations: ['items'],
        order: { createdAt: 'DESC' },
        skip,
        take: limit,
      });
    } catch (error) {
      throw new Error(`Error finding orders by user ID: ${error.message}`);
    }
  }

  async findByCreator(createdBy: string): Promise<Order[]> {
    try {
      return await this.orderRepository.find({
        where: { createdBy },
        relations: ['items'],
        order: { createdAt: 'DESC' },
      });
    } catch (error) {
      throw new Error(`Error finding orders by creator: ${error.message}`);
    }
  }

  async findByOwnerId(
    ownerId: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<Order[]> {
    try {
      if (!ownerId) {
        throw new Error('Owner ID is required');
      }

      const skip = (page - 1) * limit;

      return await this.orderRepository.find({
        where: { ownerId },
        relations: ['items'],
        order: { createdAt: 'DESC' },
        skip,
        take: limit,
      });
    } catch (error) {
      throw new Error(`Error finding orders by owner ID: ${error.message}`);
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
        throw new Error(`Order with id ${id} not found`);
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

      return await this.orderRepository.findOne({
        where: { id },
        relations: ['items'],
      });
    } catch (error) {
      throw new Error(`Error updating order: ${error.message}`);
    }
  }

  async delete(id: string): Promise<void> {
    try {
      const order = await this.orderRepository.findOne({ where: { id } });
      if (!order) {
        throw new Error(`Order with id ${id} not found`);
      }
      // Delete related items first due to FK constraints
      await this.orderItemRepository.delete({ order: { id } });
      await this.orderRepository.delete(id);
    } catch (error) {
      throw new Error(`Error deleting order: ${error.message}`);
    }
  }

  /**
   * Actualiza el estado de una orden
   */
  async updateOrderStatus(orderId: string, status: OrderStatus): Promise<Order> {
    try {
      const order = await this.orderRepository.findOne({
        where: { id: orderId },
      });

      if (!order) {
        throw new Error(`Order with id ${orderId} not found`);
      }

      // Idempotencia: si ya tiene el mismo estado, no hacer nada
      if (order.status === status) {
        this.logger.debug(`Order ${orderId} ya está en estado ${status}. Saltando update.`);
        return order;
      }

      // Si la orden ya está en un estado final, no permitir cambios (a menos que sea una corrección específica)
      if (order.status === OrderStatus.CONFIRMED && status === OrderStatus.PENDING) {
        this.logger.warn(`Intento de cambiar orden CONFIRMED ${orderId} a PENDING bloqueado.`);
        return order;
      }

      order.status = status;
      await this.orderRepository.save(order);

      return await this.orderRepository.findOne({
        where: { id: orderId },
        relations: ['items'],
      });
    } catch (error) {
      throw new Error(`Error updating order status: ${error.message}`);
    }
  }

  /**
   * Busca una orden por operationID (PaymentIntent ID)
   */
  async findByOperationId(operationId: string): Promise<Order | null> {
    try {
      return await this.orderRepository.findOne({
        where: { operationID: operationId },
        relations: ['items'],
      });
    } catch (error) {
      throw new Error(`Error finding order by operation ID: ${error.message}`);
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
      throw new Error(maintenanceMessage);
    }

    //verifica el percentage_fee
    const percentageFee = await this.appConfig.getNumber('percentage_fee', 0);
    if (percentageFee < 0 || percentageFee > 100) {
      throw new Error(`El porcentaje de comisión debe estar entre 0 y 100`);
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
      throw new Error(maintenanceMessage);
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
      throw new Error(
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
      throw new Error(`El valor mínimo de orden es $${minOrderValue}`);
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
        throw new Error(
          'Los items de guardarropa están temporalmente deshabilitados',
        );
      }

      if (item.sourceType === 'menu' && !allowMenuItems) {
        throw new Error('Los items de menú están temporalmente deshabilitados');
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
}
