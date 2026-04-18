import {
  MembershipPlan,
  MembershipFeature,
} from '../enums/membership-plan.enum';

export class MembershipResponseDto {
  id: string;
  plan: MembershipPlan;
  features: MembershipFeature[];
  isActive: boolean;
  expiresAt: Date | null;
  remainingDays: number;
  isExpired: boolean;
  createdAt: Date;
  updatedAt: Date;
  subscriptionPlanId?: string;

  // Subscription fields
  mpPreapprovalId?: string;
  mpSubscriptionId?: string;
  subscriptionStatus?: string;
  amount?: number;
  originalPrice?: number;
  discountPercentage?: number;
  currency?: string;
  nextBillingDate?: Date;
  lastPaymentAt?: Date;
  paymentMethodId?: string;
  discount?: {
    id: string;
    code: string;
    displayName?: string;
  };
}
