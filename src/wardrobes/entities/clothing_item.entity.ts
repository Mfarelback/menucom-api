import { Entity, Column, PrimaryGeneratedColumn, ManyToOne } from 'typeorm';
import { Wardrobes } from './wardrobes.entity'; // Importa la entidad Wardrobe
@Entity()
export class ClothingItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column('simple-array')
  sizes: string[]; // List of sizes

  @Column()
  color: string;

  @Column('numeric', { precision: 10, scale: 2 })
  price: number;

  @ManyToOne(() => Wardrobes, (wardrobe) => wardrobe.items) // Relación con la entidad Wardrobe
  wardrobe: Wardrobes;
}
