import {
  Entity,
  Column,
  ManyToOne,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { RoleType, BusinessContext } from '../models/permissions.model';

/**
 * Entidad que representa la asignación de un rol a un usuario en un contexto específico
 *
 * Esto permite:
 * - Un usuario puede tener múltiples roles
 * - Cada rol puede estar asociado a un contexto de negocio diferente
 * - Un usuario puede ser OWNER en RESTAURANT y CUSTOMER en WARDROBE
 * - Un usuario puede ser MANAGER en un restaurante específico
 *
 * Ejemplos:
 * - { user: "juan", role: CUSTOMER, context: GENERAL } → Cliente general del sistema
 * - { user: "maria", role: OWNER, context: RESTAURANT } → Dueña de restaurante
 * - { user: "maria", role: CUSTOMER, context: WARDROBE } → También cliente de wardrobes
 * - { user: "pedro", role: MANAGER, context: RESTAURANT, resourceId: "rest-123" } → Gerente del restaurante rest-123
 */
@Entity('user_roles')
@Index(['userId', 'context'])
@Index(['userId', 'role', 'context'])
@Index(['resourceId'])
export class UserRole {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User;

  @Column({
    type: 'enum',
    enum: RoleType,
  })
  role: RoleType;

  @Column({
    type: 'enum',
    enum: BusinessContext,
  })
  context: BusinessContext;

  /**
   * ID del recurso específico al que aplica el rol (opcional)
   * Por ejemplo:
   * - Para un MANAGER de un restaurante específico, sería el ID del restaurante
   * - Para un OWNER de un catálogo, sería el ID del catálogo
   * - null significa que aplica a todo el contexto
   */
  @Column({ type: 'varchar', nullable: true })
  resourceId: string;

  /**
   * Indica si el rol está activo
   * Permite desactivar roles temporalmente sin eliminarlos
   */
  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  /**
   * Usuario que otorgó este rol (opcional)
   * Útil para auditoría y trazabilidad
   */
  @Column({ type: 'varchar', nullable: true })
  grantedBy: string;

  /**
   * Fecha de expiración del rol (opcional)
   * Permite roles temporales o de prueba
   */
  @Column({ type: 'timestamp', nullable: true })
  expiresAt: Date;

  @CreateDateColumn({
    type: 'timestamp',
  })
  grantedAt: Date;

  @UpdateDateColumn({
    type: 'timestamp',
  })
  updatedAt: Date;

  /**
   * Metadatos adicionales del rol (opcional)
   * Permite almacenar información extra sin modificar la estructura
   */
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;
}
