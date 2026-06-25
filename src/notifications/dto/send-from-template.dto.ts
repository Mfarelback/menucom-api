import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsObject,
  IsUUID,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendFromTemplateDto {
  @ApiProperty({ example: ['uuid-1', 'uuid-2'] })
  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMinSize(1, { message: 'Debe incluir al menos un userId' })
  @ArrayMaxSize(5000, { message: 'Máximo 5000 usuarios por envío' })
  userIds: string[];

  @ApiProperty({
    example: { userName: 'Juan', amount: '2500' },
    description:
      'Placeholders. Valores siempre string. El servicio reemplaza {{key}} por value.',
  })
  @IsObject()
  params: Record<string, string>;
}
