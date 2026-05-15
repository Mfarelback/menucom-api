import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { Event } from './event.entity';
import { Ticket } from './ticket.entity';
import { Order } from '../../orders/entities/order.entity';
import { TicketPurchaseStatus } from '../enums/ticket-purchase-status.enum';
import { TicketType } from './ticket-type.entity';

@Entity('ticket_purchases')
export class TicketPurchase {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  tenantId: string; // Crítico para multi-tenant

  @ManyToOne(() => User)
  buyer: User;

  @ManyToOne(() => Event)
  event: Event;

  @ManyToOne(() => TicketType)
  ticketType: TicketType;

  @Column('decimal', { precision: 10, scale: 2 })
  totalAmount: number;

  @Column({ default: 1 })
  quantity: number;

  @Column('decimal', { precision: 10, scale: 2 })
  appliedFeePercentage: number;

  @Column('decimal', { precision: 10, scale: 2 })
  feeAmount: number;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  netAmount: number; // Monto neto que recibe el organizador (totalAmount - feeAmount)

  @Column({
    type: 'enum',
    enum: TicketPurchaseStatus,
    default: TicketPurchaseStatus.PENDING,
  })
  paymentStatus: TicketPurchaseStatus;

  @Column({ nullable: true })
  customerName: string;

  @Column({ nullable: true })
  customerEmail: string;

  @OneToMany(() => Ticket, (ticket) => ticket.purchase)
  tickets: Ticket[];

  @ManyToOne(() => Order, { nullable: true })
  order: Order; // Integración con el sistema de órdenes general

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
