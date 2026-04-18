import {
  Entity,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  PrimaryGeneratedColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Membership } from './membership.entity';

export enum DiscountType {
  PERCENTAGE = 'percentage',
  FIXED_AMOUNT = 'fixed_amount',
}

export enum DiscountStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  EXPIRED = 'expired',
  EXHAUSTED = 'exhausted',
}

@Entity('subscription_discounts')
export class SubscriptionDiscount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', unique: true })
  code: string;

  @Column({ type: 'varchar', nullable: true })
  displayName: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({
    type: 'enum',
    enum: DiscountType,
    default: DiscountType.PERCENTAGE,
  })
  type: DiscountType;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  value: number;

  @Column({ type: 'timestamp', nullable: true })
  validFrom: Date;

  @Column({ type: 'timestamp', nullable: true })
  validUntil: Date;

  @Column({ type: 'int', default: 0 })
  maxUses: number;

  @Column({ type: 'int', default: 0 })
  usedCount: number;

  @Column({ type: 'simple-array', nullable: true })
  applicablePlans: string[];

  @Column({ type: 'simple-array', nullable: true })
  applicableUsers: string[];

  @Column({
    type: 'enum',
    enum: DiscountStatus,
    default: DiscountStatus.ACTIVE,
  })
  status: DiscountStatus;

  @Column({ type: 'varchar', nullable: true })
  createdByUserId: string;

  @OneToMany(() => Membership, (membership) => membership.discount)
  memberships: Membership[];

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;

  isValid(): boolean {
    if (this.status !== DiscountStatus.ACTIVE) return false;
    const now = new Date();
    if (this.validFrom && now < this.validFrom) return false;
    if (this.validUntil && now > this.validUntil) return false;
    if (this.maxUses > 0 && this.usedCount >= this.maxUses) return false;
    return true;
  }

  calculateDiscount(originalPrice: number): number {
    if (!this.isValid()) return 0;

    if (this.type === DiscountType.PERCENTAGE) {
      return (originalPrice * this.value) / 100;
    }
    return Math.min(this.value, originalPrice);
  }

  calculateFinalPrice(originalPrice: number): number {
    const discount = this.calculateDiscount(originalPrice);
    return Math.max(0, originalPrice - discount);
  }
}
