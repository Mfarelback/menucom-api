import {
  IsString,
  IsNumber,
  IsOptional,
  IsEnum,
  IsArray,
  IsDateString,
  Min,
  Max,
} from 'class-validator';
import { DiscountType } from '../entities/subscription-discount.entity';

export class CreateSubscriptionDiscountDto {
  @IsString()
  code: string;

  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(DiscountType)
  type: DiscountType;

  @IsNumber()
  @Min(0)
  @Max(100)
  value: number;

  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @IsOptional()
  @IsDateString()
  validUntil?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxUses?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  applicablePlans?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  applicableUsers?: string[];
}

export class UpdateSubscriptionDiscountDto {
  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  value?: number;

  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @IsOptional()
  @IsDateString()
  validUntil?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxUses?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  applicablePlans?: string[];

  @IsOptional()
  @IsEnum(DiscountType)
  type?: DiscountType;
}

export class ApplyDiscountDto {
  @IsString()
  code: string;
}

export class ValidateDiscountResponseDto {
  valid: boolean;
  discount?: {
    id: string;
    code: string;
    displayName?: string;
    type: DiscountType;
    value: number;
    originalPrice: number;
    finalPrice: number;
    percentage: number;
  };
  message?: string;
}
