import { IsString, IsNumber, IsPositive, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateOrderItemDto {
  @ApiProperty({ example: 'Auriculares Bluetooth' })
  @IsString()
  productName: string;

  @ApiProperty({ example: 2 })
  @IsNumber()
  @IsPositive()
  quantity: number;

  @ApiProperty({ example: 950.5 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  price: number;

  @ApiProperty({
    example: 'menu-uuid-123',
    description: 'ID del menú o wardrobe del cual viene este item',
    required: false,
  })
  @IsOptional()
  @IsString()
  sourceId?: string; // ID del menú o wardrobe

  @ApiProperty({
    example: 'menu',
    description: 'Tipo de fuente: menu o wardrobe',
    required: false,
    enum: ['menu', 'wardrobe'],
  })
  @IsOptional()
  @IsString()
  sourceType?: 'menu' | 'wardrobe';
}
