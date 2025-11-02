import {
  Entity,
  Column,
  ManyToOne,
  PrimaryColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Catalog } from './catalog.entity';
import { CatalogItemStatus } from '../enums/catalog-type.enum';

/**
 * Entidad genérica de item de catálogo
 * Reemplaza MenuItem y ClothingItem con campos flexibles
 */
@Entity('catalog_items')
@Index(['catalogId', 'status'])
@Index(['catalogId', 'isAvailable'])
export class CatalogItem {
  @PrimaryColumn({ type: 'varchar' })
  id: string;

  @Column({ type: 'varchar' })
  catalogId: string;

  @ManyToOne(() => Catalog, (catalog) => catalog.items, {
    onDelete: 'CASCADE',
  })
  catalog: Catalog;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'varchar', nullable: true })
  photoURL: string;

  /**
   * Precio base del item
   */
  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  price: number;

  /**
   * Precio con descuento (si aplica)
   */
  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => (value ? parseFloat(value) : null),
    },
  })
  discountPrice: number;

  /**
   * Cantidad disponible en stock
   */
  @Column({ type: 'int', default: 0 })
  quantity: number;

  /**
   * SKU o código del producto
   */
  @Column({ type: 'varchar', nullable: true })
  sku: string;

  @Column({
    type: 'enum',
    enum: CatalogItemStatus,
    default: CatalogItemStatus.AVAILABLE,
  })
  status: CatalogItemStatus;

  /**
   * Indica si el item está disponible para pedidos
   */
  @Column({ type: 'boolean', default: true })
  isAvailable: boolean;

  /**
   * Indica si es un item destacado/favorito
   */
  @Column({ type: 'boolean', default: false })
  isFeatured: boolean;

  /**
   * Orden de visualización (para ordenamiento manual)
   */
  @Column({ type: 'int', default: 0 })
  displayOrder: number;

  /**
   * Atributos específicos por tipo de catálogo
   * Almacenados como JSON para máxima flexibilidad
   *
   * Ejemplos:
   * - Para MENU: {
   *     ingredients: ['tomate', 'queso', 'albahaca'],
   *     allergens: ['lactose', 'gluten'],
   *     deliveryTime: 30,
   *     calories: 450,
   *     spicyLevel: 2
   *   }
   * - Para WARDROBE: {
   *     sizes: ['S', 'M', 'L', 'XL'],
   *     colors: ['red', 'blue', 'black'],
   *     brand: 'Nike',
   *     material: 'cotton',
   *     gender: 'unisex'
   *   }
   * - Para PRODUCT_LIST: {
   *     weight: '500g',
   *     dimensions: '10x20x5',
   *     warranty: '12 months'
   *   }
   */
  @Column({ type: 'jsonb', nullable: true })
  attributes: Record<string, any>;

  /**
   * Imágenes adicionales del producto (URLs)
   */
  @Column({ type: 'simple-array', nullable: true })
  additionalImages: string[];

  /**
   * Categoría o subcategoría del item
   */
  @Column({ type: 'varchar', nullable: true })
  category: string;

  /**
   * Etiquetas para búsqueda
   */
  @Column({ type: 'simple-array', nullable: true })
  tags: string[];

  /**
   * Contador de veces que se ha pedido/comprado
   */
  @Column({ type: 'int', default: 0 })
  orderCount: number;

  /**
   * Contador de vistas del item
   */
  @Column({ type: 'int', default: 0 })
  viewCount: number;

  /**
   * Rating promedio (0-5)
   */
  @Column({
    type: 'decimal',
    precision: 3,
    scale: 2,
    default: 0,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  averageRating: number;

  /**
   * Número de reviews/comentarios
   */
  @Column({ type: 'int', default: 0 })
  reviewCount: number;

  @CreateDateColumn({
    type: 'timestamp',
  })
  createdAt: Date;

  @UpdateDateColumn({
    type: 'timestamp',
  })
  updatedAt: Date;
}
