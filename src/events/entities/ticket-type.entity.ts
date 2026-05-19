import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  Check,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Event } from './event.entity';

@Entity('ticket_types')
@Check(`"soldQuantity" <= "totalQuantity"`)
export class TicketType {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Event, (event) => event.ticketTypes, { onDelete: 'CASCADE' })
  event: Event;

  @Column()
  name: string; // General, VIP, Early Bird

  @Column('decimal', { precision: 10, scale: 2 })
  price: number;

  @Column()
  totalQuantity: number;

  @Column({ default: 0 })
  soldQuantity: number;

  @Column({ type: 'timestamp' })
  saleStartDate: Date;

  @Column({ type: 'timestamp' })
  saleEndDate: Date;

  @Column({ default: 10 })
  maxPerUser: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
