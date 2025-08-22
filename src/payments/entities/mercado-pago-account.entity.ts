import {
  Entity,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  PrimaryGeneratedColumn,
  Index,
} from 'typeorm';

@Entity('mercado_pago_accounts')
@Index(['userId'], { unique: true })
export class MercadoPagoAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  userId: string; // ID del usuario vendedor

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
