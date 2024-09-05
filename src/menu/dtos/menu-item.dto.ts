// menu-item.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsNumber } from 'class-validator';

export class CreateMenuItemDto {
  @IsString()
  @ApiProperty({
    description: 'ID del menú al que agrega el item',
    nullable: true,
  })
  idMenu: string;

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
  @ApiProperty({
    description: 'Lista de ingredientes (array de strings)',
    type: [String],
  })
  ingredients: string[];

  @IsNotEmpty()
  @IsNumber()
  @ApiProperty({ description: 'Tiempo de preparacion o entrega en minutos' })
  deliveryTime: number;
}
