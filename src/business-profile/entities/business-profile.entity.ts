import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Commerce } from '../../commerce/entities/commerce.entity';

export interface BusinessHour {
  day: string;
  open: string;
  close: string;
  isHoliday?: boolean;
}

export interface SocialLinks {
  instagram?: string;
  facebook?: string;
  whatsapp?: string;
  website?: string;
}

export interface BusinessPolicies {
  returns?: string;
  shipping?: string;
  warranty?: string;
  payment?: string;
}

@Entity('business_profiles')
export class BusinessProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  commerceId: string;

  @OneToOne(() => Commerce, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'commerceId' })
  commerce: Commerce;

  @Column({ type: 'jsonb', nullable: true })
  hours: BusinessHour[];

  @Column({ type: 'jsonb', nullable: true })
  socialLinks: SocialLinks;

  @Column({ type: 'simple-array', nullable: true })
  certifications: string[];

  @Column({ type: 'text', nullable: true })
  bio: string;

  @Column({ type: 'text', nullable: true })
  coverage: string;

  @Column({ type: 'jsonb', nullable: true })
  policies: BusinessPolicies;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;
}
