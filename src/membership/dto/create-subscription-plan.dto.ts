import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsArray,
  IsBoolean,
  Min,
  Max,
  ValidateNested,
  IsDefined,
  IsNotEmptyObject,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MembershipFeature } from '../enums/membership-plan.enum';
import { PlanType } from '../entities/subscription-plan.entity';

export class PlanLimitsDto {
  @ApiProperty({ description: 'Número máximo de catálogos', example: 1 })
  @IsNumber()
  @Min(-1) // -1 significa ilimitado
  maxCatalogs: number;

  @ApiProperty({ description: 'Número máximo de productos por catálogo', example: 10 })
  @IsNumber()
  @Min(-1)
  maxCatalogItems: number;

  @ApiProperty({ description: 'Número máximo de sucursales', example: 1 })
  @IsNumber()
  @Min(-1)
  maxLocations: number;

  @ApiProperty({ description: 'Días de retención de estadísticas', example: 7 })
  @IsNumber()
  @Min(1)
  @Max(3650) // Máximo 10 años
  analyticsRetention: number;

  @ApiProperty({ description: 'Número máximo de usuarios administradores', example: 1 })
  @IsNumber()
  @Min(-1)
  maxUsers: number;

  @ApiProperty({ description: 'Número máximo de llamadas a la API por mes', example: 100 })
  @IsNumber()
  @Min(-1)
  maxApiCalls: number;

  @ApiProperty({ description: 'Límite de almacenamiento en MB', example: 100 })
  @IsNumber()
  @Min(-1)
  storageLimit: number; // MB
}

export class PlanTrialDto {
  @ApiProperty({ description: 'Si el periodo de prueba está habilitado', example: true })
  @IsBoolean()
  enabled: boolean;

  @ApiProperty({ description: 'Días de duración del periodo de prueba', example: 14 })
  @IsNumber()
  @Min(1)
  @Max(365)
  days: number;
}

export class PlanCustomizationsDto {
  @ApiPropertyOptional({ description: 'Permitir personalización de marca', example: false })
  @IsOptional()
  @IsBoolean()
  branding?: boolean;

  @ApiPropertyOptional({ description: 'Permitir marca blanca (white label)', example: false })
  @IsOptional()
  @IsBoolean()
  whiteLabel?: boolean;

  @ApiPropertyOptional({ description: 'Permitir dominio personalizado', example: false })
  @IsOptional()
  @IsBoolean()
  customDomain?: boolean;

  @ApiPropertyOptional({ description: 'Acceso a soporte prioritario', example: false })
  @IsOptional()
  @IsBoolean()
  prioritySupport?: boolean;
}

export class PlanMetadataDto {
  @ApiPropertyOptional({ description: 'Color representativo del plan (Hex)', example: '#6B7280' })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional({ description: 'Icono representativo del plan', example: 'free' })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiPropertyOptional({ description: 'Si es un plan popular/destacado', example: false })
  @IsOptional()
  @IsBoolean()
  popular?: boolean;

  @ApiPropertyOptional({ type: () => PlanTrialDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => PlanTrialDto)
  trial?: PlanTrialDto;

  @ApiPropertyOptional({ type: () => PlanCustomizationsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => PlanCustomizationsDto)
  customizations?: PlanCustomizationsDto;
}

export class CreateSubscriptionPlanDto {
  @ApiProperty({ description: 'Nombre único del plan', example: 'basic_plan' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Nombre a mostrar al público', example: 'Plan Básico' })
  @IsOptional()
  @IsString()
  displayName?: string;

  @ApiPropertyOptional({ description: 'Descripción detallada del plan', example: 'Ideal para pequeños negocios' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: PlanType, default: PlanType.CUSTOM })
  @IsOptional()
  @IsEnum(PlanType)
  type?: PlanType = PlanType.CUSTOM;

  @ApiProperty({ description: 'Precio del plan', example: 15000 })
  @IsNumber()
  @Min(0)
  price: number;

  @ApiPropertyOptional({ description: 'Moneda del precio', example: 'ARS', default: 'ARS' })
  @IsOptional()
  @IsString()
  currency?: string = 'ARS';

  @ApiPropertyOptional({ description: 'Ciclo de facturación', example: 'monthly', default: 'monthly' })
  @IsOptional()
  @IsString()
  billingCycle?: string = 'monthly';

  @ApiProperty({ enum: MembershipFeature, isArray: true })
  @IsArray()
  @IsEnum(MembershipFeature, { each: true })
  features: MembershipFeature[];

  @ApiProperty({ type: () => PlanLimitsDto })
  @IsDefined()
  @IsNotEmptyObject()
  @ValidateNested()
  @Type(() => PlanLimitsDto)
  limits: PlanLimitsDto;

  @ApiPropertyOptional({ type: () => PlanMetadataDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => PlanMetadataDto)
  metadata?: PlanMetadataDto;

  // Campos de compatibilidad (opcionales)
  @ApiPropertyOptional({ description: 'Número máximo de productos (compatibilidad)', example: 10 })
  @IsOptional()
  @IsNumber()
  maxItems?: number;

  @ApiPropertyOptional({ description: 'Número máximo de catálogos (compatibilidad)', example: 1 })
  @IsOptional()
  @IsNumber()
  maxCatalogs?: number;

  @ApiPropertyOptional({ description: 'Si el plan está activo (compatibilidad)', example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
