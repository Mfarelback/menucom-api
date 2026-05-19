import {
  IsString,
  IsNotEmpty,
  IsEmail,
  Length,
  IsPositive,
  IsOptional,
  IsBoolean,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUserDto {
  @IsString()
  @IsOptional()
  @ApiProperty({ description: 'photoUrl of user' })
  readonly id: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({ description: 'photoUrl of user' })
  readonly photoURL: string;

  @IsString()
  @IsEmail()
  @IsNotEmpty()
  @ApiProperty({ description: 'the email of user' })
  readonly email: string;

  @IsString()
  @ApiProperty({ description: 'the name of user' })
  readonly name: string;

  @IsString()
  @ApiProperty({ description: 'the number phone' })
  readonly phone: string;

  @IsString()
  @IsNotEmpty()
  @Length(6)
  @ApiProperty({ description: 'the password of user' })
  readonly password: string;

  @IsOptional()
  @IsBoolean()
  @ApiProperty()
  readonly needToChangepassword: boolean;

  /**
   * @deprecated Rol legacy para compatibilidad. Usar el sistema de UserRole para asignación de roles.
   */
  @IsString()
  @IsOptional()
  @ApiPropertyOptional({
    description: 'Rol del usuario (legacy). Valores: client | admin | operador',
  })
  readonly role?: string;

  /**
   * Tipo de negocio del usuario
   * Determina el rol y contexto asignados automáticamente
   *
   * - 'customer': Cliente final (solo compra)
   * - 'events': Organizador de eventos
   * - 'food'|'dinning': Dueño de restaurante
   * - 'clothes': Dueño de tienda de ropa
   * - 'retail'|'grocery'|'electronics': Vendedor de marketplace
   * - 'admin': Administrador del sistema
   */
  @IsString()
  @IsOptional()
  @ApiPropertyOptional({
    description: 'Tipo de negocio/comportamiento del usuario',
    enum: [
      'customer',
      'events',
      'food',
      'dinning',
      'clothes',
      'retail',
      'grocery',
      'electronics',
      'accessories',
      'pharmacy',
      'beauty',
      'construction',
      'automotive',
      'pets',
      'water_distributor',
      'admin',
      'operador',
    ],
    example: 'events',
  })
  readonly businessType?: string;
}
