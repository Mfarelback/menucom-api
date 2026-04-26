import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsIn } from 'class-validator';

/**
 * DTO para que un usuario cambie su propio rol legacy (rubro)
 *
 * Valores válidos:
 * - customer: Cliente final
 * - grocery: Supermercado/almacén
 * - beauty: Peluquería/estética
 * - food: Restaurante/comida
 * - admin: Administrador (solo para usuarios existentes)
 *
 * NOTA: El rol se sincroniza automáticamente con la tabla user_roles
 * Mapeo interno: grocery, beauty, food -> owner | customer -> customer | admin -> admin
 */
export class ChangeOwnRoleDto {
  @IsString()
  @IsIn(['customer', 'grocery', 'beauty', 'food', 'admin'])
  @ApiProperty({
    description:
      'Nuevo rol/rubro del usuario.',
    enum: ['customer', 'grocery', 'beauty', 'food', 'admin'],
    example: 'food',
  })
  readonly role!: string;
}