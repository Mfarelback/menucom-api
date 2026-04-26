import {
  Entity,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  PrimaryGeneratedColumn,
  OneToOne,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import {
  MembershipPlan,
  MembershipFeature,
} from '../enums/membership-plan.enum';
import { SubscriptionPlan } from './subscription-plan.entity';
import { SubscriptionDiscount } from './subscription-discount.entity';

export enum BillingMode {
  NONE = 'none',
  MANUAL = 'manual',
  AUTO = 'auto',
}

@Entity()
export class Membership {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn()
  user: User;

  @Column({ type: 'varchar' })
  userId: string;

  @Column({
    type: 'varchar',
    default: MembershipPlan.FREE,
  })
  plan: string;

  @Column({ type: 'simple-array', nullable: true })
  features: MembershipFeature[];

  @Column({ type: 'timestamp', nullable: true })
  expiresAt: Date;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'timestamp', nullable: true })
  lastUpgradeAt: Date;

  @Column({ type: 'varchar', nullable: true })
  paymentId: string;

  @Column({ type: 'varchar', nullable: true })
  subscriptionId: string;

  @ManyToOne(() => SubscriptionPlan, { nullable: true })
  @JoinColumn()
  subscriptionPlan: SubscriptionPlan;

  @Column({ type: 'varchar', nullable: true })
  subscriptionPlanId: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  amount: number;

  @Column({ type: 'varchar', nullable: true })
  currency: string;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any>;

  // === Campos de Suscripción MP ===

  @Column({ type: 'varchar', nullable: true })
  mpPreapprovalId: string;

  @Column({ type: 'varchar', nullable: true })
  mpSubscriptionId: string;

  @Column({ type: 'varchar', nullable: true })
  mpSubscriberId: string;

  @Column({ type: 'varchar', nullable: true })
  paymentMethodId: string;

  @Column({ type: 'timestamp', nullable: true })
  nextBillingDate: Date;

  @Column({ type: 'timestamp', nullable: true })
  lastPaymentAt: Date;

  @Column({ type: 'varchar', nullable: true })
  subscriptionStatus: string;

  // Descuento aplicado
  @ManyToOne(() => SubscriptionDiscount, { nullable: true })
  @JoinColumn()
  discount: SubscriptionDiscount;

  @Column({ type: 'varchar', nullable: true })
  discountId: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  discountPercentage: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  originalPrice: number;

  // === BILLING MODE ===
  @Column({
    type: 'enum',
    enum: BillingMode,
    default: BillingMode.NONE,
  })
  billingMode: BillingMode;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  adminSetPrice: number;

  @Column({ type: 'int', default: 1 })
  paidPeriodMonths: number;

  // === PENDING PAYMENT (para links de pago manual) ===
  @Column({ type: 'varchar', nullable: true })
  pendingPaymentId: string;

  @Column({ type: 'varchar', nullable: true })
  pendingPaymentLink: string;

  @Column({ type: 'timestamp', nullable: true })
  pendingPaymentExpiresAt: Date;

  // === ACCESS PERIOD ===
  @Column({ type: 'timestamp', nullable: true })
  accessStartDate: Date;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;

  // Helper methods
  isExpired(): boolean {
    if (!this.expiresAt) return false;
    return new Date() > this.expiresAt;
  }

  hasFeature(feature: MembershipFeature): boolean {
    return this.features?.includes(feature) || false;
  }

  canAccess(requiredFeature: MembershipFeature): boolean {
    if (!this.isActive) return false;
    if (this.isExpired()) return false;
    return this.hasFeature(requiredFeature);
  }

  getRemainingDays(): number {
    if (!this.expiresAt) return -1;
    const now = new Date();
    const diffTime = this.expiresAt.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  hasActiveSubscription(): boolean {
    return (
      this.mpPreapprovalId != null &&
      this.subscriptionStatus === 'authorized' &&
      this.isActive
    );
  }

  hasValidDiscount(): boolean {
    if (!this.discount) return false;
    return this.discount.isValid();
  }

  getDaysUntilNextBilling(): number {
    if (!this.nextBillingDate) return -1;
    const now = new Date();
    const diffTime = this.nextBillingDate.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
}
