// menu.entity.ts

import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class WardrobeDto {
  @IsString()
  @ApiProperty({ description: 'Se toma como nombre de menú' })
  id: string;

  @IsString()
  @ApiProperty({ description: 'Se toma como nombre de menú' })
  description: string;
}
