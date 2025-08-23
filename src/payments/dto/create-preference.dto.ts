import {
  IsArray,
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
  Min,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MercadoPagoItemDto {
  @ApiPropertyOptional({ description: 'ID único del item' })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty({ description: 'Título del producto o servicio' })
  @IsNotEmpty()
  @IsString()
  title: string;

  @ApiPropertyOptional({ description: 'Descripción del producto o servicio' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Cantidad del producto', minimum: 1 })
  @IsNumber()
  @Min(1)
  quantity: number;

  @ApiProperty({
    description: 'Código de moneda (ej: ARS, USD)',
    default: 'ARS',
  })
  @IsString()
  @IsNotEmpty()
  currency_id: string;

  @ApiProperty({ description: 'Precio unitario', minimum: 0.01 })
  @IsNumber()
  @Min(0.01)
  unit_price: number;

  @ApiPropertyOptional({ description: 'ID de categoría del producto' })
  @IsOptional()
  @IsString()
  category_id?: string;

  @ApiPropertyOptional({ description: 'URL de imagen del producto' })
  @IsOptional()
  @IsString()
  picture_url?: string;
}

export class MercadoPagoIdentificationDto {
  @ApiProperty({ description: 'Tipo de documento (DNI, CUIT, etc.)' })
  @IsString()
  @IsNotEmpty()
  type: string;

  @ApiProperty({ description: 'Número de documento' })
  @IsString()
  @IsNotEmpty()
  number: string;
}

export class MercadoPagoPhoneDto {
  @ApiPropertyOptional({ description: 'Código de área' })
  @IsOptional()
  @IsString()
  area_code?: string;

  @ApiPropertyOptional({ description: 'Número de teléfono' })
  @IsOptional()
  @IsString()
  number?: string;
}

export class MercadoPagoAddressDto {
  @ApiPropertyOptional({ description: 'Nombre de la calle' })
  @IsOptional()
  @IsString()
  street_name?: string;

  @ApiPropertyOptional({ description: 'Número de la calle' })
  @IsOptional()
  @IsNumber()
  street_number?: number;

  @ApiPropertyOptional({ description: 'Código postal' })
  @IsOptional()
  @IsString()
  zip_code?: string;
}

export class MercadoPagoPayerDto {
  @ApiPropertyOptional({ description: 'Nombre del pagador' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Apellido del pagador' })
  @IsOptional()
  @IsString()
  surname?: string;

  @ApiPropertyOptional({
    description: 'Nombre del pagador (campo preferido por MP)',
  })
  @IsOptional()
  @IsString()
  first_name?: string;

  @ApiPropertyOptional({
    description: 'Apellido del pagador (campo preferido por MP)',
  })
  @IsOptional()
  @IsString()
  last_name?: string;

  @ApiPropertyOptional({ description: 'Email del pagador' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: 'Teléfono del pagador' })
  @IsOptional()
  @ValidateNested()
  @Type(() => MercadoPagoPhoneDto)
  phone?: MercadoPagoPhoneDto;

  @ApiPropertyOptional({ description: 'Identificación del pagador' })
  @IsOptional()
  @ValidateNested()
  @Type(() => MercadoPagoIdentificationDto)
  identification?: MercadoPagoIdentificationDto;

  @ApiPropertyOptional({ description: 'Dirección del pagador' })
  @IsOptional()
  @ValidateNested()
  @Type(() => MercadoPagoAddressDto)
  address?: MercadoPagoAddressDto;
}

export class MercadoPagoBackUrlsDto {
  @ApiPropertyOptional({ description: 'URL de retorno para pagos exitosos' })
  @IsOptional()
  @IsString()
  success?: string;

  @ApiPropertyOptional({ description: 'URL de retorno para pagos fallidos' })
  @IsOptional()
  @IsString()
  failure?: string;

  @ApiPropertyOptional({ description: 'URL de retorno para pagos pendientes' })
  @IsOptional()
  @IsString()
  pending?: string;
}

export class CreatePreferenceDto {
  @ApiProperty({
    description: 'Lista de items a pagar',
    type: [MercadoPagoItemDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MercadoPagoItemDto)
  items: MercadoPagoItemDto[];

  @ApiProperty({ description: 'Referencia externa única' })
  @IsString()
  @IsNotEmpty()
  external_reference: string;

  @ApiPropertyOptional({ description: 'Información del pagador' })
  @IsOptional()
  @ValidateNested()
  @Type(() => MercadoPagoPayerDto)
  payer?: MercadoPagoPayerDto;

  @ApiPropertyOptional({ description: 'URLs de retorno' })
  @IsOptional()
  @ValidateNested()
  @Type(() => MercadoPagoBackUrlsDto)
  back_urls?: MercadoPagoBackUrlsDto;

  @ApiPropertyOptional({ description: 'URL de notificación de webhooks' })
  @IsOptional()
  @IsString()
  notification_url?: string;

  @ApiPropertyOptional({
    description: 'Retorno automático',
    enum: ['approved', 'all'],
  })
  @IsOptional()
  @IsEnum(['approved', 'all'])
  auto_return?: 'approved' | 'all';

  @ApiPropertyOptional({ description: 'Descripción en el estado de cuenta' })
  @IsOptional()
  @IsString()
  statement_descriptor?: string;

  @ApiPropertyOptional({
    description: 'ID del collector para pagos con vendedor específico',
  })
  @IsOptional()
  @IsNumber()
  collector_id?: number;
}
