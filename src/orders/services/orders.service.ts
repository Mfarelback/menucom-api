import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../entities/order.entity';
import { OrderItem } from '../entities/order.item.entity';
import { CreateOrderDto } from '../dtos/create.order.dto';
import { PaymentsService } from 'src/payments/services/payments.service';
import { UserService } from 'src/user/user.service';
import { Menu } from 'src/menu/entities/menu.entity';
import { Wardrobes } from 'src/wardrobes/entities/wardrobes.entity';
import { AppConfigService } from 'src/app-data';
import { AppDataService } from 'src/app-data/services/app-data.service';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItemRepository: Repository<OrderItem>,
    @InjectRepository(Menu)
    private readonly menuRepository: Repository<Menu>,
    @InjectRepository(Wardrobes)
    private readonly wardrobesRepository: Repository<Wardrobes>,
    private paymentService: PaymentsService,
    private userService: UserService,
    private readonly appConfig: AppConfigService,
    private readonly appDataService: AppDataService,
  ) {}

  /**
   * Determina automáticamente el ownerId basado en los items de la orden
   */
  private async determineOwnerId(
    items: CreateOrderDto['items'],
  ): Promise<string | null> {
    try {
      // Buscar el primer item que tenga sourceId y sourceType definidos
      for (const item of items) {
        if (item.sourceId && item.sourceType) {
          if (item.sourceType === 'menu') {
            const menu = await this.menuRepository.findOne({
              where: { id: item.sourceId },
            });
            if (menu) {
              return menu.idOwner;
            }
          } else if (item.sourceType === 'wardrobe') {
            const wardrobe = await this.wardrobesRepository.findOne({
              where: { id: item.sourceId },
            });
            if (wardrobe) {
              return wardrobe.idOwner;
            }
          }
        }
      }
      return null;
    } catch (error) {
      console.error('Error determining owner ID:', error);
      return null;
    }
  }

  /**
   * Calcula los montos de la orden incluyendo la comisión del marketplace
   * @param subtotal El subtotal de la orden antes de comisiones
   * @returns Objeto con subtotal, porcentaje de comisión, monto de comisión y total
   */
  private async calculateOrderAmounts(subtotal: number): Promise<{
    subtotal: number;
    marketplaceFeePercentage: number;
    marketplaceFeeAmount: number;
    total: number;
  }> {
    try {
      // Obtener el porcentaje de comisión del marketplace
      const marketplaceFeePercentage =
        await this.appDataService.getMarketplaceFeePercentage();

      // Calcular el monto de la comisión
      const marketplaceFeeAmount = (subtotal * marketplaceFeePercentage) / 100;

      // Calcular el total final
      const total = subtotal + marketplaceFeeAmount;

      return {
        subtotal,
        marketplaceFeePercentage,
        marketplaceFeeAmount,
        total,
      };
    } catch (error) {
      console.error('Error calculating order amounts:', error);
      // En caso de error, devolver valores por defecto (sin comisión)
      return {
        subtotal,
        marketplaceFeePercentage: 0,
        marketplaceFeeAmount: 0,
        total: subtotal,
      };
    }
  }

  async create(createOrderDto: CreateOrderDto): Promise<Order> {
    try {
      // Verificar configuraciones del sistema antes de procesar la orden
      await this.checkOrderingConfig();

      // Asignar datos falsos si no se proveen y corregir si el email es un teléfono
      const fakeEmail = 'anon@fake.com';
      const fakePhone = '0000000000';
      let { customerEmail, customerPhone, ownerId } = createOrderDto;
      const { createdBy } = createOrderDto;
      const { items, ...rest } = createOrderDto;

      // Si createdBy está presente, buscar info del usuario
      if (createdBy) {
        try {
          const user = await this.userService.findOne(createdBy);
          if (user) {
            // Si el usuario tiene email y/o phone, usarlos
            customerEmail = user.email || customerEmail;
            customerPhone = user.phone || customerPhone;
          }
        } catch (e) {
          // Si no se encuentra el usuario, continuar con los datos originales
        }
      }

      // Detectar si customerEmail es un número de teléfono (solo dígitos, 8-15 caracteres)
      const phoneRegex = /^\d{8,15}$/;
      if (customerEmail && phoneRegex.test(customerEmail)) {
        customerPhone = customerEmail;
        customerEmail = fakeEmail;
      }

      customerEmail = customerEmail || fakeEmail;
      customerPhone = customerPhone || fakePhone;

      // Determinar automáticamente el ownerId si no se proporciona
      if (!ownerId) {
        ownerId = await this.determineOwnerId(items);
      }

      // Validar límites de orden según configuración
      await this.validateOrderLimits(items);

      // Calcular los montos incluyendo la comisión del marketplace
      // Nota: rest.total se considera como el subtotal original
      const calculatedAmounts = await this.calculateOrderAmounts(rest.total);

      const orderData = {
        ...rest,
        customerEmail,
        customerPhone,
        ownerId,
        createdBy,
        subtotal: calculatedAmounts.subtotal,
        marketplaceFeePercentage: calculatedAmounts.marketplaceFeePercentage,
        marketplaceFeeAmount: calculatedAmounts.marketplaceFeeAmount,
        total: calculatedAmounts.total, // Total final con comisión incluida
      };

      // Crear instancia de Order (TypeORM generará automáticamente el ID)
      const order = this.orderRepository.create(orderData);

      // Guardar la orden primero para obtener el ID
      const savedOrder = await this.orderRepository.save(order);

      // Crear el pago y obtener el intent (ahora con el orderId disponible)
      // Usar el total final que incluye la comisión del marketplace
      const paymentIntent = await this.paymentService.createPayment(
        orderData.customerEmail,
        orderData.total,
        undefined, // description
        orderData.ownerId, // ownerId para buscar collector_id
        orderData.createdBy, // anonymousId o userId para trazabilidad
        savedOrder.id, // orderId para trazabilidad
      );
      savedOrder.operationID = paymentIntent.id; // Asignar el ID del pago a la orden

      // Generar la URL de checkout de Mercado Pago usando el transaction_id
      if (paymentIntent.transaction_id) {
        savedOrder.paymentUrl = paymentIntent.init_point;
      }

      // Actualizar la orden con los datos del pago
      await this.orderRepository.save(savedOrder);

      // Crear y guardar los ítems asociados a la orden
      const orderItems = items.map((itemDto) =>
        this.orderItemRepository.create({ ...itemDto, order: savedOrder }),
      );
      await this.orderItemRepository.save(orderItems);

      // Recuperar la orden con los ítems guardados
      return await this.orderRepository.findOne({
        where: { id: savedOrder.id },
        relations: ['items'],
      });
    } catch (error) {
      throw new Error(`Error creating order: ${error.message}`);
    }
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
  async findAll(): Promise<Order[]> {
    try {
      return await this.orderRepository.find({ relations: ['items'] });
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

  async findByUserId(userId: string): Promise<Order[]> {
    try {
      // Get user's email
      const user = await this.userService.findOne(userId);
      if (!user) {
        throw new Error(`User with id ${userId} not found`);
      }
      console.log(user);
      // Find orders by user's email
      return await this.findByOwner(user.email);
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

  async findByOwnerId(ownerId: string): Promise<Order[]> {
    try {
      if (!ownerId) {
        throw new Error('Owner ID is required');
      }
      return await this.orderRepository.find({
        where: { ownerId },
        relations: ['items'],
        order: { createdAt: 'DESC' },
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
          this.orderItemRepository.create({ ...itemDto, order }),
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
  async updateOrderStatus(orderId: string, status: string): Promise<Order> {
    try {
      const order = await this.orderRepository.findOne({
        where: { id: orderId },
      });

      if (!order) {
        throw new Error(`Order with id ${orderId} not found`);
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
