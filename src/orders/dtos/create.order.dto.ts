import {
  IsString,
  IsOptional,
  IsNumber,
  ValidateNested,
  IsArray,
  IsPositive,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { CreateOrderItemDto } from './create.order.item.dto';

export class CreateOrderDto {
  @ApiProperty({ example: 'cliente@email.com', required: false })
  @IsOptional()
  @IsString()
  customerEmail?: string;

  @ApiProperty({ example: '333-3133-333', required: false })
  @IsOptional()
  @IsString()
  customerPhone?: string;

  @ApiProperty({ example: 'anonymous-user-123', required: false })
  @IsOptional()
  @IsString()
  createdBy?: string;

  @ApiProperty({
    example: 'owner-uuid-123',
    description: 'ID del propietario del menú/wardrobe',
    required: true,
  })
  @IsOptional()
  @IsString()
  ownerId?: string;

  @ApiProperty({ example: 1300.5 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  total: number;

  @ApiProperty({ type: [CreateOrderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];
}
