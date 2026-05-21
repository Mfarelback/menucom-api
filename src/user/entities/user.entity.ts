import { Exclude } from 'class-transformer';
import {
  Entity,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  PrimaryColumn,
  OneToOne,
} from 'typeorm';
import { Membership } from '../../membership/entities/membership.entity';

@Entity()
export class User {
  @PrimaryColumn()
  id: string;

  @Column({ type: 'varchar', length: 255 })
  photoURL: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 255 })
  email: string;

  @Column({ type: 'varchar', length: 255 })
  phone: string;

  @Exclude()
  @Column({ type: 'varchar', length: 255, nullable: true })
  password: string;

  @Column({ type: 'boolean', default: true })
  needToChangepassword: boolean;

  /**
   * @deprecated Legacy role field. Use UserRole entity for role management.
   * This field is kept for backward compatibility but should not be used in new code.
   */
  @Column({ type: 'varchar', length: 100, nullable: true })
  role: string;

  // Campos para autenticación social con Firebase
  @Column({ type: 'varchar', length: 255, nullable: true })
  socialToken: string; // Firebase UID

  @Column({ type: 'varchar', length: 255, nullable: true })
  firebaseProvider: string; // google.com, facebook.com, etc.

  @Column({ type: 'boolean', default: false })
  isEmailVerified: boolean;

  @Column({ type: 'timestamp', nullable: true })
  lastLoginAt: Date;

  @OneToOne(() => Membership, (membership) => membership.user)
  membership: Membership;

  @CreateDateColumn({
    type: 'timestamp',
  })
  createdAt: Date;

  @Column({ type: 'varchar', length: 255, nullable: true })
  fcmToken: string;

  // === Campos de perfil de negocio para landing page ===

  @Column({ type: 'varchar', length: 255, nullable: true, unique: true })
  slug: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  businessName: string;

  @Column({ type: 'text', nullable: true })
  businessDescription: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  coverImageUrl: string;

  @Column({ type: 'boolean', default: false })
  isFeatured: boolean;

  @Column({ type: 'jsonb', nullable: true })
  businessAddress: Record<string, any>;

  @Column({ type: 'varchar', length: 50, nullable: true })
  businessPhone: string;

  @Column({ type: 'jsonb', nullable: true })
  socialLinks: Record<string, any>;

  @UpdateDateColumn({
    type: 'timestamp',
  })
  updatedAt: Date;
}
