import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Configuración de comercio/tenant para marketplace fee personalizado
 * Según documentación: docs/technical/DYNAMIC_MARKETPLACE_FEE.md
 */
@Entity('merchant_configs')
export class MerchantConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  tenantId: string; // Identificador del tenant/comercio

  @Column('decimal', { precision: 5, scale: 2, nullable: true })
  customMarketplaceFee: number; // Ej: 2.50 para 2.5%

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
