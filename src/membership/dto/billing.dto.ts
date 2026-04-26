import {
  IsNotEmpty,
  IsUUID,
  IsNumber,
  IsOptional,
  IsString,
  IsInt,
  Min,
  Max,
  IsEnum,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BillingMode } from '../entities/membership.entity';

export class GeneratePaymentLinkDto {
  @ApiProperty({ description: 'User ID' })
  @IsNotEmpty()
  @IsUUID()
  userId: string;

  @ApiProperty({ description: 'Plan name (free, premium, enterprise, or custom plan name)' })
  @IsNotEmpty()
  @IsString()
  plan: string;

  @ApiProperty({ description: 'Amount in cents (e.g., 15000 = $150.00 ARS)' })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiPropertyOptional({ description: 'Period in months (default: 1)', default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  periodMonths?: number = 1;

  @ApiPropertyOptional({ description: 'Description for the charge' })
  @IsOptional()
  @IsString()
  description?: string;
}

export class GeneratePaymentLinkResponseDto {
  @ApiProperty()
  paymentId: string;

  @ApiProperty()
  paymentLink: string;

  @ApiProperty()
  amount: number;

  @ApiProperty()
  currency: string;

  @ApiProperty()
  periodMonths: number;

  @ApiProperty()
  expiresAt: Date;

  @ApiProperty()
  status: string;

  @ApiProperty()
  membership: {
    id: string;
    plan: string;
    pendingPaymentId: string;
    billingMode: BillingMode;
  };
}

export class EnableAutoBillingDto {
  @ApiProperty({ description: 'User ID' })
  @IsNotEmpty()
  @IsUUID()
  userId: string;

  @ApiProperty({ description: 'Plan name' })
  @IsNotEmpty()
  @IsString()
  plan: string;

  @ApiPropertyOptional({ description: 'Amount override (uses plan price if not provided)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;

  @ApiProperty({ description: 'Card token from Mercado Pago (created by MP SDK on frontend)' })
  @IsNotEmpty()
  @IsString()
  cardTokenId: string;

  @ApiPropertyOptional({ description: 'Billing cycle', default: 'monthly' })
  @IsOptional()
  @IsString()
  billingCycle?: 'monthly' | 'yearly' = 'monthly';
}

export class EnableAutoBillingResponseDto {
  @ApiProperty()
  preapprovalId: string;

  @ApiProperty()
  status: string;

  @ApiProperty()
  billingMode: BillingMode;

  @ApiProperty()
  nextBillingDate: Date;

  @ApiProperty()
  membership: {
    id: string;
    plan: string;
    mpPreapprovalId: string;
    billingMode: BillingMode;
    isActive: boolean;
  };
}

export class ChangeBillingAmountDto {
  @ApiProperty({ description: 'New amount in cents' })
  @IsNumber()
  @Min(0)
  newAmount: number;

  @ApiPropertyOptional({ description: 'Reason for the change' })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class ChangeBillingAmountResponseDto {
  @ApiProperty()
  membershipId: string;

  @ApiProperty()
  previousAmount: number;

  @ApiProperty()
  newAmount: number;

  @ApiProperty()
  effectiveFrom: Date;

  @ApiProperty()
  nextBillingDate: Date;
}

export class MigrateToAutoBillingDto {
  @ApiProperty({ description: 'Card token from Mercado Pago' })
  @IsNotEmpty()
  @IsString()
  cardTokenId: string;

  @ApiPropertyOptional({ description: 'New amount (uses current if not provided)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;
}

export class MigrateToManualBillingResponseDto {
  @ApiProperty()
  membershipId: string;

  @ApiProperty()
  previousBillingMode: BillingMode;

  @ApiProperty()
  newBillingMode: BillingMode;

  @ApiProperty()
  message: string;
}

export class BillingDetailsResponseDto {
  @ApiProperty()
  membershipId: string;

  @ApiProperty()
  userId: string;

  @ApiProperty({ enum: BillingMode })
  billingMode: BillingMode;

  @ApiProperty()
  currentPlan: {
    name: string;
    displayName: string;
    basePrice: number;
  };

  @ApiProperty()
  effectivePrice: number;

  @ApiProperty()
  adminSetPrice: number | null;

  @ApiProperty()
  autoBilling: {
    mpPreapprovalId: string | null;
    status: string | null;
    nextBillingDate: Date | null;
    lastPaymentAt: Date | null;
    paymentMethodId: string | null;
  };

  @ApiProperty()
  manualBilling: {
    pendingPaymentId: string | null;
    pendingPaymentLink: string | null;
    pendingPaymentExpiresAt: Date | null;
  };

  @ApiProperty()
  paymentHistory: SubscriptionPaymentSummaryDto[];
}

export class SubscriptionPaymentSummaryDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  date: Date;

  @ApiProperty()
  amount: number;

  @ApiProperty()
  status: string;

  @ApiProperty()
  type: string;

  @ApiProperty()
  periodMonths: number;

  @ApiProperty()
  isAdminGenerated: boolean;
}