import {
  Entity,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  PrimaryGeneratedColumn,
  OneToMany,
} from 'typeorm';
import { Membership } from './membership.entity';
import { MembershipFeature } from '../enums/membership-plan.enum';

export enum PlanStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ARCHIVED = 'archived',
}

export enum PlanType {
  STANDARD = 'standard', // Planes predefinidos (FREE, PREMIUM, ENTERPRISE)
  CUSTOM = 'custom', // Planes creados por administradores
}

@Entity('subscription_plans')
export class SubscriptionPlan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', unique: true })
  name: string;

  @Column({ type: 'varchar', nullable: true })
  displayName: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({
    type: 'enum',
    enum: PlanType,
    default: PlanType.CUSTOM,
  })
  type: PlanType;

  @Column({
    type: 'enum',
    enum: PlanStatus,
    default: PlanStatus.ACTIVE,
  })
  status: PlanStatus;

  // Pricing
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @Column({ type: 'varchar', default: 'ARS' })
  currency: string;

  @Column({ type: 'varchar', default: 'monthly' }) // monthly, yearly, lifetime
  billingCycle: string;

  // Features
  @Column({ type: 'simple-array', nullable: true })
  features: MembershipFeature[];

  // Resource Limits
  @Column({ type: 'json' })
  limits: {
    maxMenus: number; // Límite de menús
    maxMenuItems: number; // Límite de items por menú
    maxWardrobes: number; // Límite de wardrobes
    maxClothingItems: number; // Límite de items de ropa
    maxLocations: number; // Límite de ubicaciones
    analyticsRetention: number; // Días de retención de analytics
    maxUsers: number; // Usuarios por cuenta (para planes empresariales)
    maxApiCalls: number; // Llamadas API por mes
    storageLimit: number; // Límite de almacenamiento en MB
  };

  // Metadata for additional configuration
  @Column({ type: 'json', nullable: true })
  metadata: {
    color?: string; // Color para mostrar en UI
    icon?: string; // Icono del plan
    popular?: boolean; // Marcar como plan popular
    trial?: {
      // Configuración de trial
      enabled: boolean;
      days: number;
    };
    customizations?: {
      // Personalizaciones adicionales
      branding?: boolean;
      whiteLabel?: boolean;
      customDomain?: boolean;
      prioritySupport?: boolean;
    };
  };

  // Admin who created this plan (for custom plans)
  @Column({ type: 'varchar', nullable: true })
  createdByUserId: string;

  @OneToMany(() => Membership, (membership) => membership.subscriptionPlan)
  memberships: Membership[];

  @CreateDateColumn({
    type: 'timestamp',
  })
  createdAt: Date;

  @UpdateDateColumn({
    type: 'timestamp',
  })
  updatedAt: Date;

  // Helper methods
  isActive(): boolean {
    return this.status === PlanStatus.ACTIVE;
  }

  hasFeature(feature: MembershipFeature): boolean {
    return this.features?.includes(feature) || false;
  }

  getLimit(limitType: keyof SubscriptionPlan['limits']): number {
    return this.limits[limitType] || 0;
  }

  isUnlimited(limitType: keyof SubscriptionPlan['limits']): boolean {
    return this.limits[limitType] === -1;
  }

  canCreateResource(
    limitType: keyof SubscriptionPlan['limits'],
    currentCount: number,
  ): boolean {
    const limit = this.getLimit(limitType);
    if (limit === -1) return true; // Unlimited
    return currentCount < limit;
  }
}
