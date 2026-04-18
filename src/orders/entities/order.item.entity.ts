import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, Index } from 'typeorm';
import { Order } from './order.entity';

export enum OrderSourceType {
  MENU = 'menu',
  WARDROBE = 'wardrobe',
}

@Entity()
export class OrderItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  productName: string;

  @Column('int')
  quantity: number;

  @Column('decimal', { precision: 10, scale: 2 })
  price: number;

  @Column({ nullable: true })
  sourceId: string; // ID del menú o wardrobe

  @Index()
  @Column({
    type: 'enum',
    enum: OrderSourceType,
    nullable: true,
  })
  sourceType: OrderSourceType; // 'menu' o 'wardrobe'

  @ManyToOne(() => Order, (order) => order.items, { onDelete: 'CASCADE' })
  order: Order;
}
