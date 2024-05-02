// menu-item.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsNumber } from 'class-validator';

export class CreateMenuItemDto {
    @IsNotEmpty()
    @IsString()
    @ApiProperty({ description: 'Nombre del plato' })
    name: string;

    @IsNotEmpty()
    @IsString()
    @ApiProperty({ description: 'Foto' })
    photoURL: string;

    @IsNotEmpty()
    @IsNumber({ maxDecimalPlaces: 2 })

    @ApiProperty({ description: 'precio por porción' })
    price: number;

    @IsNotEmpty()
    @IsNumber()
    @ApiProperty({ description: 'Tiempo de preparacion o entrega en minutos' })
    deliveryTime: number;
}
