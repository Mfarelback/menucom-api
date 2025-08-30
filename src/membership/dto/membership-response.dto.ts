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
}
