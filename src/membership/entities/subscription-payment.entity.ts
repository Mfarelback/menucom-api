import {
  Entity,
  Column,
  CreateDateColumn,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Membership } from './membership.entity';

export enum PaymentStatus {
  PENDING = 'pending',
  AUTHORIZED = 'authorized',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
  PROCESSING = 'processing',
}

export enum PaymentType {
  SUBSCRIPTION_PAYMENT = 'subscription_payment',
  FIRST_PAYMENT = 'first_payment',
  TRIAL = 'trial',
  MANUAL_PAYMENT = 'manual_payment',
}

@Entity('subscription_payments')
export class SubscriptionPayment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Membership, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'membershipId' })
  membership: Membership;

  @Column({ type: 'varchar' })
  membershipId: string;

  @Column({ type: 'varchar', nullable: true })
  mpPaymentId: string;

  @Column({ type: 'varchar', nullable: true })
  mpPreapprovalId: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  originalAmount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  discountAmount: number;

  @Column({ type: 'varchar', default: 'ARS' })
  currency: string;

  @Column({
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
  })
  status: PaymentStatus;

  @Column({
    type: 'enum',
    enum: PaymentType,
    default: PaymentType.SUBSCRIPTION_PAYMENT,
  })
  type: PaymentType;

  @Column({ type: 'varchar', nullable: true })
  paymentMethodId: string;

  @Column({ type: 'varchar', nullable: true })
  paymentMethodType: string;

  @Column({ type: 'timestamp', nullable: true })
  paidAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  nextRetryAt: Date;

  @Column({ type: 'int', default: 0 })
  retryCount: number;

  @Column({ type: 'varchar', nullable: true })
  failureReason: string;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any>;

  @Column({ type: 'int', default: 1 })
  periodMonths: number;

  @Column({ type: 'boolean', default: false })
  isAdminGenerated: boolean;

  @Column({ type: 'varchar', nullable: true })
  planName: string;

  @Column({ type: 'varchar', nullable: true })
  description: string;

  @Column({ type: 'json', nullable: true })
  paymentMetadata: Record<string, any>;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  isSuccessful(): boolean {
    return (
      this.status === PaymentStatus.APPROVED ||
      this.status === PaymentStatus.AUTHORIZED
    );
  }

  isFailed(): boolean {
    return (
      this.status === PaymentStatus.REJECTED ||
      this.status === PaymentStatus.CANCELLED
    );
  }

  canRetry(): boolean {
    return this.status === PaymentStatus.REJECTED && this.retryCount < 4;
  }
}
