import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('venues')
export class Venue {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  address: string;

  @Column('decimal', { precision: 10, scale: 8, nullable: true })
  latitude: number;

  @Column('decimal', { precision: 11, scale: 8, nullable: true })
  longitude: number;

  @Column({ nullable: true })
  capacity: number;

  @Column('simple-array', { nullable: true })
  services: string[]; // ['parking', 'wifi', 'accessible']

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
