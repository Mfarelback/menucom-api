import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEnum,
  IsOptional,
  IsBoolean,
  IsObject,
  IsArray,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { CatalogType, CatalogStatus } from '../enums/catalog-type.enum';

export class CreateCatalogDto {
  @ApiProperty({
    description: 'Tipo de catálogo',
    enum: CatalogType,
    example: CatalogType.MENU,
  })
  @Transform(({ value }) => {
    // Convertir valores comunes en mayúscula a los valores correctos del enum
    const upperToLowerMap = {
      MENU: 'menu',
      WARDROBE: 'wardrobe',
      PRODUCT_LIST: 'product_list',
      SERVICE_LIST: 'service_list',
      MARKETPLACE: 'marketplace',
    };
    return upperToLowerMap[value] || value;
  })
  @IsEnum(CatalogType)
  catalogType: CatalogType;

  @ApiPropertyOptional({
    description: 'Nombre del catálogo',
    example: 'Menú Principal',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({
    description: 'Descripción del catálogo',
    example: 'Nuestro menú principal con los mejores platillos',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'URL de imagen de portada',
    example: 'https://example.com/cover.jpg',
  })
  @IsOptional()
  @IsString()
  coverImageUrl?: string;

  @ApiPropertyOptional({
    description: 'Slug para URL amigable',
    example: 'menu-principal',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  slug?: string;

  @ApiPropertyOptional({
    description: 'Si el catálogo es público',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @ApiPropertyOptional({
    description: 'Metadatos específicos del tipo de catálogo',
    example: { cuisine: 'italian', priceRange: '$$' },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Configuración del catálogo',
    example: { allowOrders: true, showPrices: true },
  })
  @IsOptional()
  @IsObject()
  settings?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Etiquetas para búsqueda',
    example: ['italiana', 'pizza', 'pasta'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

export class UpdateCatalogDto {
  @ApiPropertyOptional({
    description: 'Nombre del catálogo',
    example: 'Menú Principal Actualizado',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({
    description: 'Descripción del catálogo',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Estado del catálogo',
    enum: CatalogStatus,
  })
  @IsOptional()
  @IsEnum(CatalogStatus)
  status?: CatalogStatus;

  @ApiPropertyOptional({
    description: 'Slug para URL amigable',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  slug?: string;

  @ApiPropertyOptional({
    description: 'URL de imagen de portada',
  })
  @IsOptional()
  @IsString()
  coverImageUrl?: string;

  @ApiPropertyOptional({
    description: 'Si el catálogo es público',
  })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @ApiPropertyOptional({
    description: 'Metadatos específicos',
  })
  @Transform(({ value }) => {
    if (value === null || value === undefined || value === '') return undefined;
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return undefined;
      }
    }
    return value;
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Configuración del catálogo',
  })
  @Transform(({ value }) => {
    if (value === null || value === undefined || value === '') return undefined;
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return undefined;
      }
    }
    return value;
  })
  @IsOptional()
  @IsObject()
  settings?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Etiquetas para búsqueda',
  })
  @Transform(({ value }) => {
    if (value === null || value === undefined || value === '') return undefined;
    if (typeof value === 'string') {
      // Si es string vacío o solo espacios, devolver undefined
      const trimmed = value.trim();
      if (trimmed === '') return undefined;
      // Si es string con comas, convertir a array
      return trimmed
        .split(',')
        .map((tag: string) => tag.trim())
        .filter((tag: string) => tag.length > 0);
    }
    return Array.isArray(value) ? value : undefined;
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
