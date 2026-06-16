import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SwitchContextDto {
  @ApiProperty({
    description: 'ID del comercio al cual cambiar el contexto activo',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  commerceId: string;
}
