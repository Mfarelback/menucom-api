import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEmail, IsOptional, IsBoolean } from 'class-validator';

/**
 * DTO para actualizar un usuario
 * Excluye el campo password ya que hay un endpoint específico para cambiar contraseña
 * Para subir archivos de imagen, use el endpoint multipart que procesará automáticamente
 */
export class UpdateUserDto {
  @IsString()
  @IsOptional()
  @ApiProperty({
    description:
      'Photo URL of user (only use if providing direct URL, not for file uploads)',
    required: false,
  })
  readonly photoURL?: string;

  @IsString()
  @IsOptional()
  @ApiProperty({ description: 'Name of user', required: false })
  readonly name?: string;

  @IsString()
  @IsEmail()
  @IsOptional()
  @ApiProperty({ description: 'Email of user', required: false })
  readonly email?: string;

  @IsString()
  @IsOptional()
  @ApiProperty({ description: 'Phone number of user', required: false })
  readonly phone?: string;

  @IsBoolean()
  @IsOptional()
  @ApiProperty({
    description: 'Whether user needs to change password',
    required: false,
  })
  readonly needToChangepassword?: boolean;
}
