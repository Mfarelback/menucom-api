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

  @Column({ type: 'varchar', length: 100 })
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
  createAt: Date;

  @UpdateDateColumn({
    type: 'timestamp',
  })
  updateAt: Date;
}
