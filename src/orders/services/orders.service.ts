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

  async create(createOrderDto: CreateOrderDto): Promise<Order> {
    try {
      // Asignar datos falsos si no se proveen y corregir si el email es un teléfono
      const fakeEmail = 'anon@fake.com';
      const fakePhone = '0000000000';
      let { customerEmail, customerPhone, ownerId } = createOrderDto;
      const { items, ...rest } = createOrderDto;

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

      const orderData = {
        ...rest,
        customerEmail,
        customerPhone,
        ownerId,
      };

      // Crear instancia de Order (TypeORM generará automáticamente el ID)
      const order = this.orderRepository.create(orderData);

      // Crear el pago y obtener el intent
      const paymentIntent = await this.paymentService.createPayment(
        orderData.customerEmail,
        orderData.total,
      );
      order.operationID = paymentIntent.id; // Asignar el ID del pago a la orden

      // Generar la URL de checkout de Mercado Pago usando el transaction_id
      if (paymentIntent.transaction_id) {
        order.paymentUrl = paymentIntent.init_point;
      }

      // Guardar la orden primero para obtener el ID
      const savedOrder = await this.orderRepository.save(order);

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
}
