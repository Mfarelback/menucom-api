import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { OrderItem } from './order.item.entity';
import { OrderStatus } from '../enums/order-status.enum';

const ColumnNumericTransformer = {
  to: (data: number): number => data,
  from: (data: string): number => parseFloat(data),
};

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  customerEmail: string;

  @Column({ nullable: true })
  customerPhone: string;

  @Column({ nullable: true })
  customerName: string;

  @Column({ nullable: true })
  customerLastName: string;

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

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: ColumnNumericTransformer,
  })
  total: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
    transformer: ColumnNumericTransformer,
  })
  subtotal: number;

  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 0,
    transformer: ColumnNumericTransformer,
  })
  marketplaceFeePercentage: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
    transformer: ColumnNumericTransformer,
  })
  marketplaceFeeAmount: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
    transformer: ColumnNumericTransformer,
  })
  mpProcessingFee: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
    transformer: ColumnNumericTransformer,
  })
  netAmount: number;

  @Column({
    type: 'enum',
    enum: OrderStatus,
    default: OrderStatus.PENDING,
  })
  status: OrderStatus;

  @Column({
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  paymentStatus: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
