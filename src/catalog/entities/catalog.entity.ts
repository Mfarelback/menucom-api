import {
  Entity,
  Column,
  OneToMany,
  PrimaryColumn,
  ManyToOne,
  JoinColumn,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { Commerce } from '../../commerce/entities/commerce.entity';
import { CatalogType, CatalogStatus } from '../enums/catalog-type.enum';

/**
 * Entidad genérica de catálogo que reemplaza Menu y Wardrobes
 * Soporta múltiples tipos de catálogos con campos flexibles
 */
@Entity('catalogs')
@Index(['ownerId', 'catalogType'])
@Index(['catalogType', 'status'])
@Index(['ownerId', 'status'])
@Index(['commerceId'])
export class Catalog {
  @PrimaryColumn({ type: 'varchar' })
  id: string;

  /**
   * @deprecated Usar `commerceId` como campo canónico para multi-tenant.
   * Se mantiene como alias legacy para backward compatibility.
   */
  @Column({ type: 'varchar' })
  ownerId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ownerId' })
  owner: User;

  /**
   * ID del comercio al que pertenece el catálogo (multi-tenant).
   * Nullable para backward compatibility durante la migración.
   * Una vez migrado, será el campo principal de aislamiento de datos.
   */
  @Column({ type: 'uuid', nullable: true })
  commerceId: string | null;

  @ManyToOne(() => Commerce, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'commerceId' })
  commerce: Commerce;

  @Column({
    type: 'enum',
    enum: CatalogType,
  })
  catalogType: CatalogType;

  @Column({ type: 'varchar', nullable: true })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  /**
   * Capacidad máxima de items en el catálogo
   * Puede estar limitado por el plan de membresía
   */
  @Column({ type: 'int', default: 50 })
  capacity: number;

  @Column({
    type: 'enum',
    enum: CatalogStatus,
    default: CatalogStatus.ACTIVE,
  })
  status: CatalogStatus;

  /**
   * Imagen de portada del catálogo
   */
  @Column({ type: 'varchar', nullable: true })
  coverImageUrl: string;

  /**
   * Slug para URLs amigables (opcional)
   */
  @Column({ type: 'varchar', nullable: true, unique: true })
  slug: string;

  /**
   * Indica si el catálogo es público o privado
   */
  @Column({ type: 'boolean', default: true })
  isPublic: boolean;

  /**
   * Metadatos específicos por tipo de catálogo
   * Ejemplos:
   * - Para MENU: { cuisine: 'italian', priceRange: '$$', deliveryTime: 30 }
   * - Para WARDROBE: { brand: 'Nike', season: 'summer', targetGender: 'unisex' }
   */
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  /**
   * Configuración específica del catálogo
   * Ejemplos:
   * - { allowOrders: true, requireApproval: false, showPrices: true }
   */
  @Column({ type: 'jsonb', nullable: true })
  settings: Record<string, any>;

  /**
   * Etiquetas para búsqueda y categorización
   */
  @Column({ type: 'simple-array', nullable: true })
  tags: string[];

  @OneToMany('CatalogItem', 'catalog', { cascade: true })
  items: any[];

  /**
   * Contador de vistas del catálogo (para analytics)
   */
  @Column({ type: 'int', default: 0 })
  viewCount: number;

  /**
   * Última vez que se visualizó el catálogo
   */
  @Column({ type: 'timestamp', nullable: true })
  lastViewedAt: Date;

  @CreateDateColumn({
    type: 'timestamp',
  })
  createdAt: Date;

  @UpdateDateColumn({
    type: 'timestamp',
  })
  updatedAt: Date;

  /**
   * Fecha de publicación (puede ser futura para programar)
   */
  @Column({ type: 'timestamp', nullable: true })
  publishedAt: Date;

  /**
   * Fecha de archivo
   */
  @Column({ type: 'timestamp', nullable: true })
  archivedAt: Date;
}
