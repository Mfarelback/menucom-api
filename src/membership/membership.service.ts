import { Injectable, Logger } from '@nestjs/common';
import { MembershipRepository } from './membership.repository';
import { SubscribeMembershipDto } from './dto/subscribe-membership.dto';
import { SubscribeToCustomPlanDto } from './dto/subscribe-to-custom-plan.dto';
import { UpdateMembershipDto } from './dto/update-membership.dto';
import { MembershipResponseDto } from './dto/membership-response.dto';
import { Membership } from './entities/membership.entity';
import { SubscriptionPlan } from './entities/subscription-plan.entity';
import { MembershipAuditAction } from './entities/membership-audit.entity';
import {
  MembershipPlan,
  MembershipFeature,
  PLAN_FEATURES,
  PLAN_LIMITS,
} from './enums/membership-plan.enum';
import {
  MembershipNotFoundException,
  DuplicateMembershipException,
  SubscriptionException,
} from '../core/exceptions';

@Injectable()
export class MembershipService {
  private readonly logger = new Logger(MembershipService.name);

  constructor(private readonly membershipRepository: MembershipRepository) {}

  async createMembership(userId: string): Promise<Membership> {
    const existingMembership =
      await this.membershipRepository.findByUserId(userId);

    if (existingMembership) {
      throw new DuplicateMembershipException(userId);
    }

    const membership = await this.membershipRepository.createMembership(
      userId,
      {
        plan: MembershipPlan.FREE,
        features: PLAN_FEATURES[MembershipPlan.FREE],
        isActive: true,
      },
    );

    await this.membershipRepository.createAuditLog({
      userId,
      membershipId: membership.id,
      action: MembershipAuditAction.CREATED,
      newPlan: MembershipPlan.FREE,
      description: 'Initial membership created',
    });

    this.logger.log(`Created new membership for user ${userId}`);
    return membership;
  }

  async subscribeToPlan(
    userId: string,
    subscribeDto: SubscribeMembershipDto,
  ): Promise<Membership> {
    let membership = await this.membershipRepository.findByUserId(userId);

    if (!membership) {
      membership = await this.createMembership(userId);
    }

    const previousPlan = membership.plan;
    const expiresAt = this.calculateExpirationDate(subscribeDto.plan);

    const updatedMembership = await this.membershipRepository.updateMembership(
      membership.id,
      {
        plan: subscribeDto.plan,
        features: PLAN_FEATURES[subscribeDto.plan],
        expiresAt,
        isActive: true,
        lastUpgradeAt: new Date(),
        paymentId: subscribeDto.paymentId,
        subscriptionId: subscribeDto.subscriptionId,
        amount: subscribeDto.amount,
        currency: subscribeDto.currency,
        metadata: subscribeDto.metadata,
      },
    );

    const action = this.getAuditAction(previousPlan, subscribeDto.plan);

    await this.membershipRepository.createAuditLog({
      userId,
      membershipId: membership.id,
      action,
      previousPlan,
      newPlan: subscribeDto.plan,
      paymentId: subscribeDto.paymentId,
      amount: subscribeDto.amount,
      currency: subscribeDto.currency,
      description: `${action} from ${previousPlan} to ${subscribeDto.plan}`,
      metadata: subscribeDto.metadata,
    });

    this.logger.log(
      `User ${userId} ${action} from ${previousPlan} to ${subscribeDto.plan}`,
    );

    return updatedMembership;
  }

  async subscribeToCustomPlan(
    userId: string,
    plan: SubscriptionPlan,
    subscribeDto: SubscribeToCustomPlanDto,
  ): Promise<Membership> {
    let membership = await this.membershipRepository.findByUserId(userId);

    if (!membership) {
      membership = await this.createMembership(userId);
    }

    const previousPlan = membership.plan;
    const expiresAt = this.calculateExpirationDateFromBillingCycle(
      plan.billingCycle,
    );

    const updatedMembership = await this.membershipRepository.updateMembership(
      membership.id,
      {
        plan: plan.name as MembershipPlan, // Para compatibilidad con el enum existente
        features: plan.features,
        expiresAt,
        isActive: true,
        lastUpgradeAt: new Date(),
        paymentId: subscribeDto.paymentId,
        subscriptionId: subscribeDto.subscriptionId,
        subscriptionPlanId: plan.id, // Nueva relación con el plan personalizable
        amount: plan.price,
        currency: plan.currency,
        metadata: {
          ...subscribeDto.metadata,
          customPlan: true,
          planId: plan.id,
          planName: plan.name,
        },
      },
    );

    // Determinar la acción de auditoría basada en el plan anterior
    const action = previousPlan
      ? MembershipAuditAction.UPGRADED
      : MembershipAuditAction.CREATED;

    await this.membershipRepository.createAuditLog({
      userId,
      membershipId: membership.id,
      action,
      previousPlan,
      newPlan: plan.name as MembershipPlan,
      paymentId: subscribeDto.paymentId,
      amount: plan.price,
      currency: plan.currency,
      description: `${action} to custom plan: ${plan.displayName || plan.name}`,
      metadata: {
        ...subscribeDto.metadata,
        customPlan: true,
        planId: plan.id,
      },
    });

    this.logger.log(
      `User ${userId} subscribed to custom plan: ${plan.name} (${plan.id})`,
    );

    return updatedMembership;
  }

  async getUserMembership(userId: string): Promise<MembershipResponseDto> {
    let membership = await this.membershipRepository.findByUserId(userId);

    if (!membership) {
      membership = await this.createMembership(userId);
    }

    return this.formatMembershipResponse(membership);
  }

  async updateMembership(
    userId: string,
    updateDto: UpdateMembershipDto,
  ): Promise<Membership> {
    const membership = await this.membershipRepository.findByUserId(userId);

    if (!membership) {
      throw new MembershipNotFoundException(userId, { operation: 'update' });
    }

    return this.membershipRepository.updateMembership(membership.id, updateDto);
  }

  async cancelMembership(userId: string): Promise<Membership> {
    const membership = await this.membershipRepository.findByUserId(userId);

    if (!membership) {
      throw new MembershipNotFoundException(userId, { operation: 'cancel' });
    }

    const updatedMembership = await this.membershipRepository.updateMembership(
      membership.id,
      {
        plan: MembershipPlan.FREE,
        features: PLAN_FEATURES[MembershipPlan.FREE],
        isActive: false,
        expiresAt: null,
      },
    );

    await this.membershipRepository.createAuditLog({
      userId,
      membershipId: membership.id,
      action: MembershipAuditAction.CANCELLED,
      previousPlan: membership.plan,
      newPlan: MembershipPlan.FREE,
      description: 'Membership cancelled',
    });

    this.logger.log(`Cancelled membership for user ${userId}`);
    return updatedMembership;
  }

  async hasFeature(
    userId: string,
    feature: MembershipFeature,
  ): Promise<boolean> {
    const membership = await this.membershipRepository.findByUserId(userId);

    if (!membership) {
      return PLAN_FEATURES[MembershipPlan.FREE].includes(feature);
    }

    return membership.canAccess(feature);
  }

  async validateAccess(
    userId: string,
    requiredFeature: MembershipFeature,
  ): Promise<void> {
    const hasAccess = await this.hasFeature(userId, requiredFeature);

    if (!hasAccess) {
      const membership = await this.membershipRepository.findByUserId(userId);
      const currentPlan = membership?.plan || 'FREE';
      throw new SubscriptionException(
        `La característica '${requiredFeature}' requiere un plan superior`,
        {
          requiredFeature,
          currentPlan,
          userId,
        },
      );
    }
  }

  async getPlanLimits(userId: string): Promise<any> {
    const membership = await this.membershipRepository.findByUserId(userId);
    const plan = membership?.plan || MembershipPlan.FREE;
    return PLAN_LIMITS[plan];
  }

  async getMembershipStats(): Promise<any> {
    return this.membershipRepository.getMembershipStats();
  }

  async getAuditHistory(userId: string): Promise<any[]> {
    return this.membershipRepository.getAuditHistory(userId);
  }

  async handleExpiredMemberships(): Promise<void> {
    this.logger.log('Checking for expired memberships...');

    const expiredMemberships =
      await this.membershipRepository.findExpiredMemberships();

    for (const membership of expiredMemberships) {
      await this.membershipRepository.updateMembership(membership.id, {
        plan: MembershipPlan.FREE,
        features: PLAN_FEATURES[MembershipPlan.FREE],
        isActive: false,
      });

      await this.membershipRepository.createAuditLog({
        userId: membership.userId,
        membershipId: membership.id,
        action: MembershipAuditAction.EXPIRED,
        previousPlan: membership.plan,
        newPlan: MembershipPlan.FREE,
        description: 'Membership expired automatically',
      });

      this.logger.warn(
        `Expired membership for user ${membership.userId}, downgraded to FREE`,
      );
    }

    this.logger.log(
      `Processed ${expiredMemberships.length} expired memberships`,
    );
  }

  async notifyExpiringMemberships(): Promise<void> {
    this.logger.log('Checking for memberships expiring soon...');

    const expiringIn3Days =
      await this.membershipRepository.findMembershipsExpiringIn(3);
    const expiringIn7Days =
      await this.membershipRepository.findMembershipsExpiringIn(7);

    // Here you would integrate with your notification service
    this.logger.log(
      `Found ${expiringIn3Days.length} memberships expiring in 3 days`,
    );
    this.logger.log(
      `Found ${expiringIn7Days.length} memberships expiring in 7 days`,
    );
  }

  private calculateExpirationDate(plan: MembershipPlan): Date | null {
    if (plan === MembershipPlan.FREE) {
      return null;
    }

    const expirationDate = new Date();
    expirationDate.setMonth(expirationDate.getMonth() + 1); // 1 month from now
    return expirationDate;
  }

  private calculateExpirationDateFromBillingCycle(
    billingCycle: string,
  ): Date | null {
    if (billingCycle === 'lifetime') {
      return null; // No expiration for lifetime plans
    }

    const expirationDate = new Date();

    switch (billingCycle) {
      case 'monthly':
        expirationDate.setMonth(expirationDate.getMonth() + 1);
        break;
      case 'yearly':
        expirationDate.setFullYear(expirationDate.getFullYear() + 1);
        break;
      case 'weekly':
        expirationDate.setDate(expirationDate.getDate() + 7);
        break;
      case 'quarterly':
        expirationDate.setMonth(expirationDate.getMonth() + 3);
        break;
      default:
        // Default to monthly
        expirationDate.setMonth(expirationDate.getMonth() + 1);
    }

    return expirationDate;
  }

  private getAuditAction(
    previousPlan: MembershipPlan,
    newPlan: MembershipPlan,
  ): MembershipAuditAction {
    const planHierarchy = {
      [MembershipPlan.FREE]: 0,
      [MembershipPlan.PREMIUM]: 1,
      [MembershipPlan.ENTERPRISE]: 2,
    };

    if (planHierarchy[newPlan] > planHierarchy[previousPlan]) {
      return MembershipAuditAction.UPGRADED;
    } else if (planHierarchy[newPlan] < planHierarchy[previousPlan]) {
      return MembershipAuditAction.DOWNGRADED;
    } else {
      return MembershipAuditAction.RENEWED;
    }
  }

  formatMembershipResponse(membership: Membership): MembershipResponseDto {
    return {
      id: membership.id,
      plan: membership.plan,
      features: membership.features || [],
      isActive: membership.isActive,
      expiresAt: membership.expiresAt,
      remainingDays: membership.getRemainingDays(),
      isExpired: membership.isExpired(),
      createdAt: membership.createdAt,
      updatedAt: membership.updatedAt,
      subscriptionPlanId: membership.subscriptionPlanId,
    };
  }
}
