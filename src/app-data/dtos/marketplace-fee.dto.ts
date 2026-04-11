import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, Min, Max } from 'class-validator';

export class SetMarketplaceFeeDto {
  @ApiProperty({
    description: 'Porcentaje de comisión del marketplace (0-100)',
    minimum: 0,
    maximum: 100,
    example: 5.5,
  })
  @IsNumber(
    { maxDecimalPlaces: 2 },
    {
      message: 'El porcentaje debe ser un número válido con máximo 2 decimales',
    },
  )
  @Min(0, { message: 'El porcentaje no puede ser menor a 0' })
  @Max(100, { message: 'El porcentaje no puede ser mayor a 100' })
  percentage: number;
}

export class MarketplaceFeeResponseDto {
  @ApiProperty({
    description: 'Porcentaje de comisión del marketplace',
    example: 5.5,
  })
  percentage: number;
}
