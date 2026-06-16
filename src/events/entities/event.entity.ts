import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { Commerce } from '../../commerce/entities/commerce.entity';
import { Venue } from './venue.entity';
import { TicketType } from './ticket-type.entity';
import { EventStatus } from '../enums/event-status.enum';

@Entity('events')
@Index(['commerceId'])
export class Event {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  tenantId: string; // Legacy: userId del organizer. Mantener para backward compatibility.

  @Column({ type: 'uuid', nullable: true })
  commerceId: string | null;

  @ManyToOne(() => Commerce, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'commerceId' })
  commerce: Commerce;

  @Column()
  name: string;

  @Column('text')
  description: string;

  @Column({ type: 'timestamp' })
  startDate: Date;

  @Column({ type: 'timestamp' })
  endDate: Date;

  @Column({
    type: 'enum',
    enum: EventStatus,
    default: EventStatus.DRAFT,
  })
  status: EventStatus;

  @ManyToOne(() => User)
  organizer: User;

  @OneToMany(() => TicketType, (ticketType) => ticketType.event, {
    cascade: true,
  })
  ticketTypes: TicketType[];

  @ManyToOne(() => Venue, { nullable: true })
  venue: Venue;

  @Column({ nullable: true })
  imageUrl: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
