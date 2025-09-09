import {
  IsString,
  IsEmail,
  IsOptional,
  IsBoolean,
  IsDateString,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO para el registro y login social con Firebase
 */
export class SocialUserDto {
  @IsString()
  @IsOptional()
  @ApiProperty({ description: 'ID único del usuario (UUID)', required: false })
  readonly id?: string;

  @IsString()
  @IsEmail()
  @ApiProperty({ description: 'Email del usuario' })
  readonly email: string;

  @IsString()
  @ApiProperty({ description: 'Nombre completo del usuario' })
  readonly name: string;

  @IsString()
  @IsOptional()
  @ApiProperty({ description: 'URL de la foto de perfil', required: false })
  readonly photoURL?: string;

  @IsString()
  @IsOptional()
  @ApiProperty({ description: 'Número de teléfono', required: false })
  readonly phone?: string;

  @IsString()
  @IsOptional()
  @ApiProperty({
    description: 'Rol del usuario',
    enum: ['customer', 'admin', 'pro', 'operador'],
    default: 'customer',
  })
  readonly role?: string;

  // Campos específicos para autenticación social
  @IsString()
  @ApiProperty({ description: 'Firebase UID (socialToken)' })
  readonly socialToken: string;

  @IsString()
  @IsOptional()
  @ApiProperty({
    description: 'Proveedor de autenticación social',
    example: 'google.com',
    required: false,
  })
  readonly firebaseProvider?: string;

  @IsBoolean()
  @IsOptional()
  @ApiProperty({
    description: 'Indica si el email está verificado',
    default: false,
  })
  readonly isEmailVerified?: boolean;

  @IsDateString()
  @IsOptional()
  @ApiProperty({
    description: 'Fecha del último login',
    required: false,
  })
  readonly lastLoginAt?: Date;

  // Campos opcionales heredados (sin password para usuarios sociales)
  @IsBoolean()
  @IsOptional()
  @ApiProperty({
    description: 'Indica si necesita cambiar contraseña',
    default: false,
  })
  readonly needToChangepassword?: boolean;
}

/**
 * DTO para el registro social con datos adicionales del formulario
 */
export class SocialRegistrationDto {
  @IsString()
  @IsEmail()
  @ApiProperty({ description: 'Email del usuario' })
  readonly email: string;

  @IsString()
  @ApiProperty({ description: 'Nombre completo del usuario' })
  readonly name: string;

  @IsString()
  @IsOptional()
  @ApiProperty({ description: 'Número de teléfono', required: false })
  readonly phone?: string;

  @IsString()
  @IsOptional()
  @ApiProperty({
    description: 'Rol del usuario',
    enum: ['customer', 'admin', 'pro', 'operador'],
    default: 'customer',
  })
  readonly role?: string;

  @IsString()
  @IsOptional()
  @ApiProperty({
    description: 'URL de la foto de perfil desde el formulario',
    required: false,
  })
  readonly photoURL?: string;
}
