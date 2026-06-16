import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEnum,
  IsOptional,
  IsBoolean,
  IsObject,
  MaxLength,
} from 'class-validator';
import { BusinessContext } from '../../auth/models/permissions.model';

export class UpdateCommerceDto {
  @ApiPropertyOptional({ description: 'Nombre del negocio' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  businessName?: string;

  @ApiPropertyOptional({ description: 'Slug único para el negocio' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  slug?: string;

  @ApiPropertyOptional({ description: 'Tipo de negocio' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  businessType?: string;

  @ApiPropertyOptional({ description: 'Contexto de negocio', enum: BusinessContext })
  @IsOptional()
  @IsEnum(BusinessContext)
  context?: BusinessContext;

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

  @ApiPropertyOptional({ description: 'URL del logo (se asigna automáticamente al subir archivo)' })
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @ApiPropertyOptional({ description: 'URL de imagen de portada (se asigna automáticamente al subir archivo)' })
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

  @ApiPropertyOptional({ description: 'Si el negocio está activo' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Metadatos adicionales' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
