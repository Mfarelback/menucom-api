import { ApiProperty, OmitType } from '@nestjs/swagger';
import { UpdateUserDto } from './update-user.dto';

/**
 * DTO para documentación de Swagger del endpoint de actualización con archivo
 * Omite photoURL del UpdateUserDto original y agrega el campo de archivo
 */
export class UpdateUserWithFileDto extends OmitType(UpdateUserDto, [
  'photoURL',
] as const) {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'Photo file to upload (replaces current photo if provided)',
    required: false,
  })
  photo?: any;
}
