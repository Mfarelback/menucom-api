import { IsEnum, IsString, IsOptional, IsNumber, Min } from 'class-validator';
import { MembershipPlan } from '../enums/membership-plan.enum';

export class SubscribeWithCardDto {
  @IsEnum(MembershipPlan)
  plan: MembershipPlan;

  @IsString()
  cardTokenId: string;

  @IsOptional()
  @IsString()
  discountCode?: string;
}

export class SubscriptionStatusResponseDto {
  isActive: boolean;
  plan: string;
  status: string;
  amount: number;
  currency: string;
  originalPrice?: number;
  discountPercentage?: number;
  nextBillingDate?: Date;
  lastPaymentAt?: Date;
  paymentMethodId?: string;
  hasDiscount: boolean;
  discountCode?: string;
}

export class CancelSubscriptionResponseDto {
  success: boolean;
  message: string;
  cancelledAt: Date;
}
