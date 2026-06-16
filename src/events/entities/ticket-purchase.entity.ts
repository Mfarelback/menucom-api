import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { Commerce } from '../../commerce/entities/commerce.entity';
import { Event } from './event.entity';
import { Ticket } from './ticket.entity';
import { Order } from '../../orders/entities/order.entity';
import { TicketPurchaseStatus } from '../enums/ticket-purchase-status.enum';
import { TicketType } from './ticket-type.entity';

@Entity('ticket_purchases')
@Index(['commerceId'])
export class TicketPurchase {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  tenantId: string; // Legacy: userId. Mantener para backward compatibility.

  @Column({ type: 'uuid', nullable: true })
  commerceId: string | null;

  @ManyToOne(() => Commerce, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'commerceId' })
  commerce: Commerce;

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
