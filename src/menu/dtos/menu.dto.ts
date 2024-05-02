import { IsNotEmpty, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateMenuItemDto } from './menu-item.dto';
import { ApiProperty } from '@nestjs/swagger';

export class CreateMenuDto {
    @IsNotEmpty()
    @IsString()
    @ApiProperty({ description: 'Id del comedor' })
    idOwner: string;

    @IsString()
    @ApiProperty({ description: 'Por si se personaliza alguna descripcion general del menú' })
    description: string;

    @Type(() => CreateMenuItemDto)
    @ApiProperty({ description: 'Item del menú', type: [CreateMenuItemDto] })
    menuItems: CreateMenuItemDto;
}