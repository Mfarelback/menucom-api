// menu-item.entity.ts
import { Entity, Column, ManyToOne, PrimaryColumn } from 'typeorm';
import { Menu } from './menu.entity';
import { Exclude } from 'class-transformer';

@Entity()
export class MenuItem {
  @PrimaryColumn()
  id: string;

  @Column()
  name: string;

  @Column()
  photoURL: string;

  @Column()
  price: number;

  @Column('simple-array')
  ingredients: string[]; // List of ingredients

  @Column()
  deliveryTime: number;

  @Exclude()
  @ManyToOne(() => Menu, (menu) => menu.id)
  menu: Menu;
}
