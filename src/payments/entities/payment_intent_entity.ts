import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity()
export class PaymentIntent {
  @PrimaryColumn()
  id: string;

  @Column({ type: 'varchar', length: 255 })
  transaction_id: string;

  @Column({ type: 'varchar', length: 255 })
  user_id: string;

  @Column({ type: 'varchar', length: 100 })
  state: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ type: 'varchar', length: 500, nullable: true })
  init_point: string | null;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  mpProcessingFee: number;

  @Column('json', { nullable: true })
  mpFeeDetails: object;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  mpNetAmount: number;
}
