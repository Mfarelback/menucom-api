import { ApiProperty, ApiPropertyOptional, OmitType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsString,
  IsEnum,
  IsOptional,
  IsDate,
  IsDateString,
  IsUUID,
  IsNumber,
} from 'class-validator';
import { EventStatus } from '../enums/event-status.enum';

export class CreateVenueDto {
  @ApiProperty({ example: 'Estadio Monumental' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'Av. Figueroa Alcorta 7597, Buenos Aires' })
  @IsString()
  address: string;

  @ApiPropertyOptional({ example: -34.5453 })
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional({ example: -58.4498 })
  @IsOptional()
  @IsNumber()
  longitude?: number;

  @ApiPropertyOptional({ example: 80000 })
  @IsOptional()
  @IsNumber()
  capacity?: number;
}

export class CreateEventDto {
  @ApiProperty({ example: 'Concierto de Rock' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'Un gran concierto con bandas locales.' })
  @IsString()
  description: string;

  @ApiProperty({ example: '2024-12-01T20:00:00Z' })
  @Transform(({ value }) => new Date(value))
  @IsDate()
  startDate: Date;

  @ApiProperty({ example: '2024-12-01T23:59:00Z' })
  @Transform(({ value }) => new Date(value))
  @IsDate()
  endDate: Date;

  @ApiPropertyOptional({ example: 'https://example.com/banner.jpg' })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({ description: 'ID de la locación existente' })
  @IsOptional()
  @IsUUID()
  venueId?: string;

  @ApiPropertyOptional({
    type: CreateVenueDto,
    description: 'O crear una nueva locación',
  })
  @IsOptional()
  venue?: CreateVenueDto;
}

export class CreateEventWithFileDto extends OmitType(CreateEventDto, [
  'imageUrl',
] as const) {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'Imagen del evento',
    required: false,
  })
  image?: any;
}

export class UpdateEventDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => new Date(value))
  @IsDate()
  startDate?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => new Date(value))
  @IsDate()
  endDate?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEnum(EventStatus)
  status?: EventStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  venueId?: string;
}

export class UpdateEventWithFileDto extends OmitType(UpdateEventDto, [
  'imageUrl',
] as const) {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'Imagen del evento',
    required: false,
  })
  image?: any;
}

export class CreateTicketTypeDto {
  @ApiProperty({ example: 'General' })
  @IsString()
  name: string;

  @ApiProperty({ example: 1500.5 })
  @IsNumber()
  price: number;

  @ApiProperty({ example: 100 })
  @IsNumber()
  totalQuantity: number;

  @ApiProperty({ example: '2024-10-01T10:00:00Z' })
  @Transform(({ value }) => new Date(value))
  @IsDate()
  saleStartDate: Date;

  @ApiProperty({ example: '2024-11-30T23:59:59Z' })
  @Transform(({ value }) => new Date(value))
  @IsDate()
  saleEndDate: Date;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @IsNumber()
  maxPerUser?: number;

  @ApiProperty({ description: 'ID del evento al que pertenece' })
  @IsUUID()
  eventId: string;
}

export class UpdateTicketTypeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  price?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  totalQuantity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => new Date(value))
  @IsDate()
  saleStartDate?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => new Date(value))
  @IsDate()
  saleEndDate?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  maxPerUser?: number;
}
