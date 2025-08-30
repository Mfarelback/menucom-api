import {
  Entity,
  Column,
  CreateDateColumn,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { Membership } from './membership.entity';
import { MembershipPlan } from '../enums/membership-plan.enum';

export enum MembershipAuditAction {
  CREATED = 'created',
  UPGRADED = 'upgraded',
  DOWNGRADED = 'downgraded',
  RENEWED = 'renewed',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
  REACTIVATED = 'reactivated',
}

@Entity()
export class MembershipAudit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn()
  user: User;

  @Column({ type: 'varchar' })
  userId: string;

  @ManyToOne(() => Membership, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn()
  membership: Membership;

  @Column({ type: 'varchar', nullable: true })
  membershipId: string;

  @Column({
    type: 'enum',
    enum: MembershipAuditAction,
  })
  action: MembershipAuditAction;

  @Column({
    type: 'enum',
    enum: MembershipPlan,
    nullable: true,
  })
  previousPlan: MembershipPlan;

  @Column({
    type: 'enum',
    enum: MembershipPlan,
  })
  newPlan: MembershipPlan;

  @Column({ type: 'varchar', nullable: true })
  paymentId: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  amount: number;

  @Column({ type: 'varchar', nullable: true })
  currency: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn({
    type: 'timestamp',
  })
  createdAt: Date;
}
