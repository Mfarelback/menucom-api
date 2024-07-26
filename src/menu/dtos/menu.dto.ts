import { IsNotEmpty, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateMenuItemDto } from './menu-item.dto';
import { ApiProperty } from '@nestjs/swagger';

export class CreateMenuDto {
  @IsNotEmpty()
  @IsString()
  @ApiProperty({
    description: 'Id del menu, si viene vacio se crea un nuevo menu',
  })
  idMenuDirect: string;

  @IsString()
  @ApiProperty({ description: 'Se toma como nombre de menú' })
  description: string;

  @Type(() => CreateMenuItemDto)
  @ApiProperty({ description: 'Item del menú', type: [CreateMenuItemDto] })
  menuItems: CreateMenuItemDto;
}
