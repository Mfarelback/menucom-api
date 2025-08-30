import {
  Entity,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  PrimaryGeneratedColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import {
  MembershipPlan,
  MembershipFeature,
} from '../enums/membership-plan.enum';

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
    type: 'enum',
    enum: MembershipPlan,
    default: MembershipPlan.FREE,
  })
  plan: MembershipPlan;

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

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  amount: number;

  @Column({ type: 'varchar', nullable: true })
  currency: string;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn({
    type: 'timestamp',
  })
  createdAt: Date;

  @UpdateDateColumn({
    type: 'timestamp',
  })
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
}
