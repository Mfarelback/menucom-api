import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Commerce } from '../../commerce/entities/commerce.entity';

/**
 * Configuración de comercio/tenant para marketplace fee personalizado
 * Según documentación: docs/technical/DYNAMIC_MARKETPLACE_FEE.md
 */
@Entity('merchant_configs')
@Index(['commerceId'])
export class MerchantConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  tenantId: string; // Legacy: userId del owner. Mantener para backward compatibility.

  @Column({ type: 'uuid', nullable: true })
  commerceId: string | null;

  @ManyToOne(() => Commerce, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'commerceId' })
  commerce: Commerce;

  @Column('decimal', { precision: 5, scale: 2, nullable: true })
  customMarketplaceFee: number; // Ej: 2.50 para 2.5%

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
