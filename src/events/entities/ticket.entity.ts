import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TicketType } from './ticket-type.entity';
import { TicketPurchase } from './ticket-purchase.entity';
import { TicketStatus } from '../enums/ticket-status.enum';
import { User } from '../../user/entities/user.entity';

@Entity('tickets')
export class Ticket {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => TicketType)
  ticketType: TicketType;

  @ManyToOne(() => TicketPurchase, (purchase) => purchase.tickets)
  purchase: TicketPurchase;

  @Column({ unique: true })
  qrCode: string;

  @Column({ nullable: true })
  ownerName: string;

  @Column({ nullable: true })
  ownerEmail: string;

  @Column({
    type: 'enum',
    enum: TicketStatus,
    default: TicketStatus.PENDING,
  })
  status: TicketStatus;

  @Column({ type: 'timestamp', nullable: true })
  validatedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  usedAt: Date;

  @ManyToOne(() => User, { nullable: true })
  validatedBy: User; // Auditoría: quién validó el ticket

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
