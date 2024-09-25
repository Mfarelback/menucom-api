import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsArray, IsInt } from 'class-validator';

export class CreateClothingItemDto {
  @IsString()
  @ApiProperty({
    description: 'ID del menú al que agrega el item',
    nullable: true,
  })
  idWard: string;

  @IsString()
  @ApiProperty({
    description: 'descripcion de la prenda',
    nullable: true,
  })
  name: string;

  @IsString()
  @ApiProperty({
    description: 'Marca',
    nullable: true,
  })
  brand: string;

  @IsString()
  @ApiProperty({
    description: 'photo',
    nullable: true,
  })
  photoURL: string;

  @IsArray()
  @ApiProperty({
    description: 'sizes',
    nullable: true,
  })
  sizes: string[];

  @IsString()
  @ApiProperty({
    description: 'color',
    nullable: true,
  })
  color: string;

  @IsNumber()
  @ApiProperty({
    description: 'price',
    nullable: true,
  })
  price: number;

  @IsInt()
  @ApiProperty({
    description: 'quantity',
    nullable: true,
  })
  quantity: number; // Nueva propiedad para la cantidad
}
