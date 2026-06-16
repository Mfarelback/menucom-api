import {
  Entity,
  Column,
  CreateDateColumn,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { Membership } from './membership.entity';
import { Commerce } from '../../commerce/entities/commerce.entity';

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

  @Column({ type: 'uuid', nullable: true })
  @Index()
  commerceId: string | null;

  @ManyToOne(() => Commerce, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'commerceId' })
  commerce: Commerce | null;

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
    type: 'varchar',
    nullable: true,
  })
  previousPlan: string;

  @Column({
    type: 'varchar',
    nullable: true,
  })
  newPlan: string;

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
