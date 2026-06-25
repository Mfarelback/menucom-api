import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEnum,
  IsOptional,
  IsBoolean,
  IsObject,
  MaxLength,
} from 'class-validator';
import { BusinessContext } from '../../auth/models/permissions.model';

export class CreateCommerceDto {
  @ApiProperty({
    description: 'Nombre del negocio',
    example: 'Mi Restaurante',
  })
  @IsString()
  @MaxLength(255)
  businessName: string;

  @ApiProperty({
    description: 'Slug único para el negocio',
    example: 'mi-restaurante',
  })
  @IsString()
  @MaxLength(255)
  slug: string;

  @ApiPropertyOptional({
    description: 'Tipo de negocio',
    example: 'restaurant',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  businessType?: string;

  @ApiProperty({
    description: 'Contexto de negocio',
    enum: BusinessContext,
    example: BusinessContext.RESTAURANT,
  })
  @IsEnum(BusinessContext)
  context: BusinessContext;

  @ApiPropertyOptional({
    description: 'Archivo del logo (imagen)',
    type: 'string',
    format: 'binary',
  })
  logo?: any;

  @ApiPropertyOptional({
    description: 'Archivo de imagen de portada (imagen)',
    type: 'string',
    format: 'binary',
  })
  coverImage?: any;

  @ApiPropertyOptional({
    description: 'URL del logo (se asigna automáticamente al subir archivo)',
  })
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @ApiPropertyOptional({
    description:
      'URL de imagen de portada (se asigna automáticamente al subir archivo)',
  })
  @IsOptional()
  @IsString()
  coverImageUrl?: string;

  @ApiPropertyOptional({ description: 'Descripción del negocio' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Dirección del negocio' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ description: 'Teléfono del negocio' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({
    description: 'Si el negocio está activo',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Metadatos adicionales' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
