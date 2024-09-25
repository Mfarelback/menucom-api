import { Entity, Column, ManyToOne, PrimaryColumn } from 'typeorm';
import { Wardrobes } from './wardrobes.entity'; // Importa la entidad Wardrobe
@Entity()
export class ClothingItem {
  @PrimaryColumn({ type: 'varchar', nullable: false })
  id: string;

  @Column()
  name: string;

  @Column()
  brand: string;

  @Column()
  photoURL: string;

  @Column('simple-array')
  sizes: string[]; // List of sizes

  @Column()
  color: string;

  @Column('int')
  quantity: number; // Nueva columna para la cantidad

  @Column('numeric', { precision: 10, scale: 2 })
  price: number;

  @ManyToOne(() => Wardrobes, (wardrobe) => wardrobe.items) // Relación con la entidad Wardrobe
  wardrobe: Wardrobes;
}
