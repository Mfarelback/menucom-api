import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsIn } from 'class-validator';

/**
 * DTO para que un usuario cambie su propio rol legacy (rubro)
 *
 * Valores válidos (sincronizados con frontend TypeComerceModel):
 * - customer: Cliente final (default)
 * - retail: Venta de productos general
 * - water_distributor: Distribuidora de agua
 * - grocery: Distribuidora de alimentos
 * - food: Restaurant/Comida
 * - clothes: Venta de ropa
 * - accessories: Accesorios
 * - electronics: Electrónica
 * - pharmacy: Farmacia
 * - beauty: Belleza
 * - construction: Materiales de construcción
 * - automotive: Automotriz
 * - pets: Petshop
 * - admin: Administrador (solo para usuarios existentes)
 *
 * NOTA: El rol se sincroniza automáticamente con la tabla user_roles
 * Mapeo interno: grocery, beauty, food, clothes, accessories, etc. -> owner | customer -> customer | admin -> admin
 */
const VALID_ROLES = [
  'customer',
  'retail',
  'water_distributor',
  'grocery',
  'food',
  'clothes',
  'accessories',
  'electronics',
  'pharmacy',
  'beauty',
  'construction',
  'automotive',
  'pets',
  'admin',
] as const;

export class ChangeOwnRoleDto {
  @IsString()
  @IsIn(VALID_ROLES)
  @ApiProperty({
    description:
      'Nuevo rol/rubro del usuario.',
    enum: VALID_ROLES,
    example: 'food',
  })
  readonly role!: string;
}