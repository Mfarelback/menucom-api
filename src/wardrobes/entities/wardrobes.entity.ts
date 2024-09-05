import { Exclude } from 'class-transformer';
import { Entity, Column, OneToMany, PrimaryColumn } from 'typeorm';
import { ClothingItem } from './clothing_item.entity';
@Entity()
export class Wardrobes {
  @PrimaryColumn({ type: 'varchar', nullable: false })
  id: string;

  @Column({ type: 'varchar', nullable: false })
  idOwner: string;

  @Column({ type: 'varchar', nullable: true })
  description: string;

  @Column({ nullable: true })
  capacity: number;

  @Exclude()
  @OneToMany(() => ClothingItem, (ClothingItem) => ClothingItem.wardrobe)
  items: ClothingItem[];
}
