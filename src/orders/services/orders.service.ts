import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../entities/order.entity';
import { OrderItem } from '../entities/order.item.entity';
import { CreateOrderDto } from '../dtos/create.order.dto';
import { PaymentsService } from 'src/payments/services/payments.service';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItemRepository: Repository<OrderItem>,
    private paymentService: PaymentsService,
  ) {}

  async create(createOrderDto: CreateOrderDto): Promise<Order> {
    try {
      const { items, ...orderData } = createOrderDto;

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
        order.paymentUrl = `https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=${paymentIntent.transaction_id}`;
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
}
