import { IsString, IsNumber, IsPositive } from 'class-validator';
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
}
