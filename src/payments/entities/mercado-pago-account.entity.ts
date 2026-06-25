import {
  Entity,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  PrimaryGeneratedColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Commerce } from '../../commerce/entities/commerce.entity';

@Entity('mercado_pago_accounts')
@Index(['userId'])
@Index(['commerceId'], { unique: true, where: '"commerceId" IS NOT NULL' })
export class MercadoPagoAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  userId: string;

  @Column({ type: 'uuid', nullable: true })
  commerceId: string | null;

  @ManyToOne(() => Commerce, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'commerceId' })
  commerce: Commerce;

  @Column({ type: 'varchar', length: 255 })
  accessToken: string; // Token de acceso OAuth

  @Column({ type: 'varchar', length: 255, nullable: true })
  refreshToken: string; // Token de refresco

  @Column({ type: 'varchar', length: 255 })
  collectorId: string; // ID del collector de Mercado Pago

  @Column({ type: 'varchar', length: 255, nullable: true })
  publicKey: string; // Public key de Mercado Pago

  @Column({ type: 'varchar', length: 100, nullable: true })
  country: string; // País de la cuenta

  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string; // Email de la cuenta de MP

  @Column({ type: 'varchar', length: 255, nullable: true })
  nickname: string; // Nickname de la cuenta

  @Column({ type: 'varchar', length: 50, default: 'active' })
  status: string; // active, inactive, suspended

  @Column({ type: 'timestamp', nullable: true })
  tokenExpiresAt: Date; // Fecha de expiración del token

  @Column({ type: 'json', nullable: true })
  metadata: any; // Información adicional de la cuenta

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
