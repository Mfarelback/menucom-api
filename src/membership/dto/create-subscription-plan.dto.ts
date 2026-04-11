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
} from 'class-validator';
import { Type } from 'class-transformer';
import { MembershipFeature } from '../enums/membership-plan.enum';
import { PlanType } from '../entities/subscription-plan.entity';

export class PlanLimitsDto {
  @IsNumber()
  @Min(-1) // -1 significa ilimitado
  maxMenus: number;

  @IsNumber()
  @Min(-1)
  maxMenuItems: number;

  @IsNumber()
  @Min(-1)
  maxWardrobes: number;

  @IsNumber()
  @Min(-1)
  maxClothingItems: number;

  @IsNumber()
  @Min(-1)
  maxLocations: number;

  @IsNumber()
  @Min(1)
  @Max(3650) // Máximo 10 años
  analyticsRetention: number;

  @IsNumber()
  @Min(-1)
  maxUsers: number;

  @IsNumber()
  @Min(-1)
  maxApiCalls: number;

  @IsNumber()
  @Min(-1)
  storageLimit: number; // MB
}

export class PlanTrialDto {
  @IsBoolean()
  enabled: boolean;

  @IsNumber()
  @Min(1)
  @Max(365)
  days: number;
}

export class PlanCustomizationsDto {
  @IsOptional()
  @IsBoolean()
  branding?: boolean;

  @IsOptional()
  @IsBoolean()
  whiteLabel?: boolean;

  @IsOptional()
  @IsBoolean()
  customDomain?: boolean;

  @IsOptional()
  @IsBoolean()
  prioritySupport?: boolean;
}

export class PlanMetadataDto {
  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsBoolean()
  popular?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => PlanTrialDto)
  trial?: PlanTrialDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => PlanCustomizationsDto)
  customizations?: PlanCustomizationsDto;
}

export class CreateSubscriptionPlanDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(PlanType)
  type?: PlanType = PlanType.CUSTOM;

  @IsNumber()
  @Min(0)
  price: number;

  @IsOptional()
  @IsString()
  currency?: string = 'ARS';

  @IsOptional()
  @IsString()
  billingCycle?: string = 'monthly';

  @IsArray()
  @IsEnum(MembershipFeature, { each: true })
  features: MembershipFeature[];

  @ValidateNested()
  @Type(() => PlanLimitsDto)
  limits: PlanLimitsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => PlanMetadataDto)
  metadata?: PlanMetadataDto;
}
