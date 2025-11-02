import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsInt,
  Min,
  IsObject,
  IsArray,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { CatalogItemStatus } from '../enums/catalog-type.enum';

export class CreateCatalogItemDto {
  @ApiPropertyOptional({
    description: 'ID del catálogo al que pertenece (se asigna automáticamente)',
    example: 'abc-123-def-456',
  })
  @IsOptional()
  @IsString()
  catalogId?: string;

  @ApiProperty({
    description: 'Nombre del item',
    example: 'Pizza Margherita',
  })
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({
    description: 'Descripción del item',
    example: 'Pizza clásica con tomate, mozzarella y albahaca',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'URL de la foto principal',
    example: 'https://example.com/pizza.jpg',
  })
  @IsOptional()
  @IsString()
  photoURL?: string;

  @ApiProperty({
    description: 'Precio del item',
    example: 12.99,
    minimum: 0,
  })
  @Transform(({ value }) => {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'string') {
      const parsed = parseFloat(value);
      return isNaN(parsed) ? 0 : parsed;
    }
    return typeof value === 'number' ? value : 0;
  })
  @IsNumber()
  @Min(0)
  price: number;

  @ApiPropertyOptional({
    description: 'Precio con descuento',
    example: 9.99,
  })
  @Transform(({ value }) => {
    if (value === null || value === undefined || value === '') return undefined;
    if (typeof value === 'string') {
      const parsed = parseFloat(value);
      return isNaN(parsed) ? undefined : parsed;
    }
    return value;
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discountPrice?: number;

  @ApiPropertyOptional({
    description: 'Cantidad en stock',
    example: 10,
    default: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  quantity?: number;

  @ApiPropertyOptional({
    description: 'SKU o código del producto',
    example: 'PIZZA-MARG-001',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  sku?: string;

  @ApiPropertyOptional({
    description: 'Si el item está disponible',
    example: true,
    default: true,
  })
  @Transform(({ value }) => {
    if (value === null || value === undefined || value === '') return undefined;
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true';
    }
    return value;
  })
  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;

  @ApiPropertyOptional({
    description: 'Si es un item destacado',
    example: false,
    default: false,
  })
  @Transform(({ value }) => {
    if (value === null || value === undefined || value === '') return undefined;
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true';
    }
    return value;
  })
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @ApiPropertyOptional({
    description: 'Atributos específicos del item (flexible JSON)',
    example: {
      ingredients: ['tomate', 'mozzarella', 'albahaca'],
      deliveryTime: 30,
      calories: 450,
    },
  })
  @Transform(({ value }) => {
    if (value === null || value === undefined || value === '') return undefined;
    if (typeof value === 'string') {
      // Si es un string vacío o solo espacios en blanco
      const trimmed = value.trim();
      if (trimmed === '' || trimmed === '{}' || trimmed === '{  }')
        return undefined;
      try {
        return JSON.parse(trimmed);
      } catch {
        return undefined;
      }
    }
    return value;
  })
  @IsOptional()
  @IsObject()
  attributes?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'URLs de imágenes adicionales',
    example: [
      'https://example.com/pizza1.jpg',
      'https://example.com/pizza2.jpg',
    ],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  additionalImages?: string[];

  @ApiPropertyOptional({
    description: 'Categoría del item',
    example: 'Pizzas',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @ApiPropertyOptional({
    description: 'Etiquetas para búsqueda',
    example: ['vegetariana', 'italiana', 'clásica'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({
    description: 'Orden de visualización',
    example: 1,
    default: 0,
  })
  @IsOptional()
  @IsInt()
  displayOrder?: number;
}

export class UpdateCatalogItemDto {
  @ApiPropertyOptional({
    description: 'Nombre del item',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({
    description: 'Descripción del item',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'URL de la foto principal',
  })
  @IsOptional()
  @IsString()
  photoURL?: string;

  @ApiPropertyOptional({
    description: 'Precio del item',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @ApiPropertyOptional({
    description: 'Precio con descuento',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discountPrice?: number;

  @ApiPropertyOptional({
    description: 'Cantidad en stock',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  quantity?: number;

  @ApiPropertyOptional({
    description: 'SKU o código del producto',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  sku?: string;

  @ApiPropertyOptional({
    description: 'Estado del item',
    enum: CatalogItemStatus,
  })
  @IsOptional()
  @IsEnum(CatalogItemStatus)
  status?: CatalogItemStatus;

  @ApiPropertyOptional({
    description: 'Si el item está disponible',
  })
  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;

  @ApiPropertyOptional({
    description: 'Si es un item destacado',
  })
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @ApiPropertyOptional({
    description: 'Atributos específicos del item',
  })
  @IsOptional()
  @IsObject()
  attributes?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'URLs de imágenes adicionales',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  additionalImages?: string[];

  @ApiPropertyOptional({
    description: 'Categoría del item',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @ApiPropertyOptional({
    description: 'Etiquetas para búsqueda',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({
    description: 'Orden de visualización',
  })
  @IsOptional()
  @IsInt()
  displayOrder?: number;
}
