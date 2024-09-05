import { IsString } from 'class-validator';
// import { Type } from 'class-transformer';
// import { CreateMenuItemDto } from './menu-item.dto';
import { ApiProperty } from '@nestjs/swagger';

export class EditMenuDto {
  @IsString()
  @ApiProperty({ description: 'Id del menu a editar' })
  id: string;
  @IsString()
  @ApiProperty({ description: 'Se toma como nombre de menú' })
  description: string;
}
