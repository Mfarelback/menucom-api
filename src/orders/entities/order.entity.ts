import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { OrderItem } from './order.item.entity';

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  customerEmail: string;

  @Column({ nullable: true })
  customerPhone: string;

  @Column({ nullable: true })
  createdBy: string; // ID del creador de la orden (x-anonymous-id)

  @Column({ nullable: true })
  ownerId: string; // ID del propietario del menú/wardrobe al que se le está comprando

  // esto seria el preference de mp
  @Column({ nullable: true })
  operationID: string;

  @Column({ nullable: true })
  paymentUrl?: string;

  @OneToMany(() => OrderItem, (item) => item.order, { cascade: true })
  items: OrderItem[];

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  total: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  subtotal: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  marketplaceFeePercentage: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  marketplaceFeeAmount: number;

  @Column({ default: 'pending' })
  status: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
