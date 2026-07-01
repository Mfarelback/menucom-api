import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { OrderItem } from './order.item.entity';
import { OrderStatus } from '../enums/order-status.enum';
import { User } from '../../user/entities/user.entity';
import { Commerce } from '../../commerce/entities/commerce.entity';

const ColumnNumericTransformer = {
  to: (data: number): number => data,
  from: (data: string): number => parseFloat(data),
};

@Entity('orders')
@Index(['commerceId'])
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

  /**
   * @deprecated Usar `commerceId` como campo canónico para multi-tenant.
   * Se mantiene como alias legacy para backward compatibility.
   */
  @Column({ nullable: true })
  ownerId: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'ownerId' })
  owner: User;

  @Column({ type: 'uuid', nullable: true })
  commerceId: string | null;

  @ManyToOne(() => Commerce, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'commerceId' })
  commerce: Commerce;

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

  @Column({ type: 'timestamp', nullable: true })
  chargebackProcessedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
