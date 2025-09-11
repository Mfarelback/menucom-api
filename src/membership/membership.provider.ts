import { Injectable, Logger } from '@nestjs/common';
import { MembershipService } from './membership.service';
import {
  MembershipFeature,
  MembershipPlan,
  PLAN_LIMITS,
} from './enums/membership-plan.enum';

@Injectable()
export class MembershipProvider {
  private readonly logger = new Logger(MembershipProvider.name);

  constructor(private readonly membershipService: MembershipService) {}

  async checkFeatureAccess(
    userId: string,
    feature: MembershipFeature,
  ): Promise<boolean> {
    try {
      return await this.membershipService.hasFeature(userId, feature);
    } catch (error) {
      this.logger.error(
        `Error checking feature access for user ${userId}: ${error.message}`,
      );
      return false;
    }
  }

  async validateFeatureOrThrow(
    userId: string,
    feature: MembershipFeature,
  ): Promise<void> {
    await this.membershipService.validateAccess(userId, feature);
  }

  async checkResourceLimit(
    userId: string,
    resourceType: 'maxMenuItems' | 'maxLocations' | 'analyticsRetention',
    currentCount: number,
  ): Promise<boolean> {
    try {
      const limits = await this.membershipService.getPlanLimits(userId);
      const limit = limits[resourceType];

      if (limit === -1) {
        return true; // Unlimited
      }

      return currentCount < limit;
    } catch (error) {
      this.logger.error(
        `Error checking resource limit for user ${userId}: ${error.message}`,
      );
      return false;
    }
  }

  async getResourceLimit(
    userId: string,
    resourceType: 'maxMenuItems' | 'maxLocations' | 'analyticsRetention',
  ): Promise<number> {
    try {
      const limits = await this.membershipService.getPlanLimits(userId);
      return limits[resourceType];
    } catch (error) {
      this.logger.error(
        `Error getting resource limit for user ${userId}: ${error.message}`,
      );
      return PLAN_LIMITS[MembershipPlan.FREE][resourceType];
    }
  }

  async getUserPlan(userId: string): Promise<MembershipPlan> {
    try {
      const membership = await this.membershipService.getUserMembership(userId);
      return membership.plan;
    } catch (error) {
      this.logger.error(
        `Error getting user plan for user ${userId}: ${error.message}`,
      );
      return MembershipPlan.FREE;
    }
  }

  async canUpgradeTo(
    userId: string,
    targetPlan: MembershipPlan,
  ): Promise<boolean> {
    try {
      const currentPlan = await this.getUserPlan(userId);
      const planHierarchy = {
        [MembershipPlan.FREE]: 0,
        [MembershipPlan.PREMIUM]: 1,
        [MembershipPlan.ENTERPRISE]: 2,
      };

      return planHierarchy[targetPlan] > planHierarchy[currentPlan];
    } catch (error) {
      this.logger.error(
        `Error checking upgrade possibility for user ${userId}: ${error.message}`,
      );
      return false;
    }
  }

  async getMembershipStatus(userId: string): Promise<{
    plan: MembershipPlan;
    isActive: boolean;
    isExpired: boolean;
    remainingDays: number;
    features: MembershipFeature[];
    subscriptionPlanId?: string;
  }> {
    try {
      const membership = await this.membershipService.getUserMembership(userId);
      return {
        plan: membership.plan,
        isActive: membership.isActive,
        isExpired: membership.isExpired,
        remainingDays: membership.remainingDays,
        features: membership.features,
        subscriptionPlanId: membership.subscriptionPlanId,
      };
    } catch (error) {
      this.logger.error(
        `Error getting membership status for user ${userId}: ${error.message}`,
      );
      return {
        plan: MembershipPlan.FREE,
        isActive: true,
        isExpired: false,
        remainingDays: -1,
        features: [],
        subscriptionPlanId: undefined,
      };
    }
  }
}
