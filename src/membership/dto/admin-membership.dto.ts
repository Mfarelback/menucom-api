import { Type } from 'class-transformer';
import { IsOptional, IsString, IsEnum, IsInt, IsBoolean, IsNumber, IsDateString, Min, Max, ValidateNested, IsObject } from 'class-validator';
import { MembershipFeature } from '../enums/membership-plan.enum';
import { PlanStatus, PlanType } from '../entities/subscription-plan.entity';

export class PlanLimitsDto {
  @IsOptional()
  @IsNumber()
  maxCatalogs?: number;

  @IsOptional()
  @IsNumber()
  maxCatalogItems?: number;

  @IsOptional()
  @IsNumber()
  maxLocations?: number;

  @IsOptional()
  @IsInt()
  analyticsRetention?: number;

  @IsOptional()
  @IsInt()
  maxUsers?: number;

  @IsOptional()
  @IsInt()
  maxApiCalls?: number;

  @IsOptional()
  @IsInt()
  storageLimit?: number;
}

export class QueryMembershipsAdminDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  plan?: string;

  @IsOptional()
  @IsString()
  status?: 'active' | 'pending' | 'expired' | 'cancelled' | 'trialing';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  sortBy?: 'createdAt' | 'updatedAt' | 'plan' | 'expiresAt' | 'amount';

  @IsOptional()
  @IsString()
  sortOrder?: 'ASC' | 'DESC' = 'DESC';
}

export class UpdateMembershipAdminDto {
  @IsOptional()
  @IsString()
  plan?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsOptional()
  @IsString()
  subscriptionStatus?: string;
}

export class CreateCustomPlanDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsOptional()
  @IsString()
  currency?: string = 'ARS';

  @IsOptional()
  @IsString()
  billingCycle?: 'monthly' | 'yearly' | 'quarterly' | 'weekly' | 'lifetime';

  @IsOptional()
  features?: MembershipFeature[];

  @IsOptional()
  @ValidateNested()
  @Type(() => PlanLimitsDto)
  @IsObject()
  limits?: Partial<PlanLimitsDto>;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class UpdateCustomPlanDto {
  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(PlanStatus)
  status?: PlanStatus;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  billingCycle?: string;

  @IsOptional()
  features?: MembershipFeature[];

  @IsOptional()
  @ValidateNested()
  @Type(() => PlanLimitsDto)
  @IsObject()
  limits?: Partial<PlanLimitsDto>;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export interface MembershipStatsResponseDto {
  byPlan: { plan: string; count: number }[];
  active: number;
  expired: number;
  total: number;
  byStatus: {
    active: number;
    pending: number;
    cancelled: number;
    expired: number;
  };
  revenue: {
    monthly: number;
    yearly: number;
    projected: number;
  };
}

export interface MembershipAuditResponseDto {
  id: string;
  membershipId: string;
  action: string;
  previousPlan: string;
  newPlan: string;
  paymentId?: string;
  amount?: number;
  currency?: string;
  description?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}

export interface MembershipWithUserDto {
  id: string;
  userId: string;
  plan: string;
  features: string[];
  isActive: boolean;
  expiresAt: Date | null;
  remainingDays: number;
  isExpired: boolean;
  subscriptionStatus?: string;
  amount?: number;
  currency?: string;
  nextBillingDate?: Date;
  lastPaymentAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  user?: {
    id: string;
    email: string;
    name?: string;
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}