import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Membership, BillingMode } from '../entities/membership.entity';
import { SubscriptionPayment, PaymentStatus, PaymentType } from '../entities/subscription-payment.entity';
import { SubscriptionPlan, PlanStatus, PlanType } from '../entities/subscription-plan.entity';
import { MembershipAudit, MembershipAuditAction } from '../entities/membership-audit.entity';
import { MercadoPagoService } from '../payment/mercado-pago.service';
import { MercadoPagoSubscriptionService } from '../payment/mercado-pago-subscription.service';
import { MembershipPlan, MembershipFeature } from '../enums/membership-plan.enum';
import {
  GeneratePaymentLinkDto,
  GeneratePaymentLinkResponseDto,
  EnableAutoBillingDto,
  EnableAutoBillingResponseDto,
  ChangeBillingAmountDto,
  ChangeBillingAmountResponseDto,
  MigrateToAutoBillingDto,
  MigrateToManualBillingResponseDto,
  BillingDetailsResponseDto,
  SubscriptionPaymentSummaryDto,
} from '../dto/billing.dto';

@Injectable()
export class BillingAdminService {
  private readonly logger = new Logger(BillingAdminService.name);
  private readonly appUrl: string;
  private readonly frontendUrl: string;

  constructor(
    @InjectRepository(Membership)
    private readonly membershipRepo: Repository<Membership>,
    @InjectRepository(SubscriptionPayment)
    private readonly paymentRepo: Repository<SubscriptionPayment>,
    @InjectRepository(SubscriptionPlan)
    private readonly planRepo: Repository<SubscriptionPlan>,
    @InjectRepository(MembershipAudit)
    private readonly auditRepo: Repository<MembershipAudit>,
    private readonly mercadoPagoService: MercadoPagoService,
    private readonly mpSubscriptionService: MercadoPagoSubscriptionService,
    private readonly configService: ConfigService,
  ) {
    this.appUrl = this.configService.get('APP_URL') || 'http://localhost:3000';
    this.frontendUrl = this.configService.get('FRONTEND_URL') || 'http://localhost:5173';
  }

  async generatePaymentLink(
    dto: GeneratePaymentLinkDto,
    adminId: string,
  ): Promise<GeneratePaymentLinkResponseDto> {
    const membership = await this.membershipRepo.findOne({
      where: { userId: dto.userId },
      relations: ['user'],
    });

    if (!membership) {
      throw new NotFoundException(`Membership for user ${dto.userId} not found`);
    }

    const user = membership.user;
    const plan = await this.planRepo.findOne({ where: { name: dto.plan } });
    const periodMonths = dto.periodMonths || 1;

    const payment = await this.mercadoPagoService.createCustomPayment({
      amount: dto.amount,
      description: `Menucom - ${dto.plan} (${periodMonths} mes${periodMonths > 1 ? 'es' : ''})${dto.description ? ` - ${dto.description}` : ''}`,
      userId: membership.userId,
      userEmail: user.email,
      externalReference: `membership_${membership.userId}_${dto.plan}_manual_${Date.now()}`,
      metadata: {
        user_id: membership.userId,
        plan: dto.plan,
        period_months: periodMonths,
        billing_mode: 'manual',
        admin_set_price: dto.amount,
        admin_id: adminId,
      },
      returnUrl: `${this.frontendUrl}/membership/success`,
      cancelUrl: `${this.frontendUrl}/membership/error`,
    });

    membership.pendingPaymentId = payment.paymentId;
    membership.pendingPaymentLink = payment.paymentUrl;
    membership.pendingPaymentExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    membership.billingMode = BillingMode.MANUAL;
    membership.adminSetPrice = dto.amount;
    membership.paidPeriodMonths = periodMonths;

    await this.membershipRepo.save(membership);

    await this.logAudit({
      userId: membership.userId,
      membershipId: membership.id,
      action: MembershipAuditAction.CREATED,
      previousPlan: membership.plan,
      newPlan: dto.plan,
      description: `Generated payment link for ${periodMonths} month(s) - Amount: ${dto.amount}`,
      metadata: {
        adminId,
        paymentId: payment.paymentId,
        amount: dto.amount,
        periodMonths,
        billingMode: BillingMode.MANUAL,
      },
    });

    this.logger.log(
      `Payment link generated for user ${membership.userId}: ${payment.paymentId}`,
    );

    return {
      paymentId: payment.paymentId,
      paymentLink: payment.paymentUrl,
      amount: dto.amount,
      currency: 'ARS',
      periodMonths,
      expiresAt: membership.pendingPaymentExpiresAt,
      status: 'pending',
      membership: {
        id: membership.id,
        plan: membership.plan,
        pendingPaymentId: membership.pendingPaymentId,
        billingMode: membership.billingMode,
      },
    };
  }

  async enableAutoBilling(
    dto: EnableAutoBillingDto,
    adminId: string,
  ): Promise<EnableAutoBillingResponseDto> {
    const membership = await this.membershipRepo.findOne({
      where: { userId: dto.userId },
      relations: ['user'],
    });

    if (!membership) {
      throw new NotFoundException(`Membership for user ${dto.userId} not found`);
    }

    if (membership.mpPreapprovalId) {
      throw new ConflictException('User already has an active subscription');
    }

    const user = membership.user;
    const plan = await this.planRepo.findOne({ where: { name: dto.plan } });
    const amount = dto.amount || plan?.price || this.mpSubscriptionService.getPlanPrice(dto.plan);

    const preapproval = await this.mpSubscriptionService.createPreapproval({
      userId: membership.userId,
      userEmail: user.email,
      plan: dto.plan,
      price: amount,
      cardTokenId: dto.cardTokenId,
      returnUrl: `${this.frontendUrl}/membership/success`,
      cancelUrl: `${this.frontendUrl}/membership/error`,
    });

    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 1);

    membership.plan = dto.plan;
    membership.features = plan?.features || [];
    membership.subscriptionPlanId = plan?.id;
    membership.mpPreapprovalId = preapproval.preapprovalId;
    membership.subscriptionStatus = preapproval.status;
    membership.billingMode = BillingMode.AUTO;
    membership.amount = amount;
    membership.adminSetPrice = dto.amount || null;
    membership.isActive = true;
    membership.expiresAt = expiresAt;
    membership.nextBillingDate = preapproval.nextBillingDate || expiresAt;
    membership.lastUpgradeAt = new Date();

    await this.membershipRepo.save(membership);

    await this.logAudit({
      userId: membership.userId,
      membershipId: membership.id,
      action: MembershipAuditAction.UPGRADED,
      previousPlan: membership.plan,
      newPlan: dto.plan,
      description: `Enabled auto-billing - Amount: ${amount}`,
      metadata: {
        adminId,
        preapprovalId: preapproval.preapprovalId,
        amount,
        billingMode: BillingMode.AUTO,
      },
    });

    this.logger.log(
      `Auto-billing enabled for user ${membership.userId}: ${preapproval.preapprovalId}`,
    );

    return {
      preapprovalId: preapproval.preapprovalId,
      status: preapproval.status,
      billingMode: BillingMode.AUTO,
      nextBillingDate: membership.nextBillingDate,
      membership: {
        id: membership.id,
        plan: membership.plan,
        mpPreapprovalId: membership.mpPreapprovalId,
        billingMode: membership.billingMode,
        isActive: membership.isActive,
      },
    };
  }

  async changeBillingAmount(
    membershipId: string,
    dto: ChangeBillingAmountDto,
    adminId: string,
  ): Promise<ChangeBillingAmountResponseDto> {
    const membership = await this.membershipRepo.findOne({
      where: { id: membershipId },
    });

    if (!membership) {
      throw new NotFoundException(`Membership ${membershipId} not found`);
    }

    if (membership.billingMode !== BillingMode.AUTO || !membership.mpPreapprovalId) {
      throw new BadRequestException('Can only change amount for active auto-billing subscriptions');
    }

    const previousAmount = Number(membership.amount);

    await this.mpSubscriptionService.changeSubscriptionAmount(
      membership.mpPreapprovalId,
      dto.newAmount,
    );

    membership.amount = dto.newAmount;
    membership.adminSetPrice = dto.newAmount;
    await this.membershipRepo.save(membership);

    await this.logAudit({
      userId: membership.userId,
      membershipId: membership.id,
      action: MembershipAuditAction.RENEWED,
      previousPlan: membership.plan,
      newPlan: membership.plan,
      amount: dto.newAmount,
      description: `Changed billing amount from ${previousAmount} to ${dto.newAmount}${dto.reason ? ` - ${dto.reason}` : ''}`,
      metadata: {
        adminId,
        previousAmount,
        newAmount: dto.newAmount,
        reason: dto.reason,
      },
    });

    this.logger.log(
      `Billing amount changed for membership ${membershipId}: ${previousAmount} -> ${dto.newAmount}`,
    );

    return {
      membershipId: membership.id,
      previousAmount,
      newAmount: dto.newAmount,
      effectiveFrom: new Date(),
      nextBillingDate: membership.nextBillingDate,
    };
  }

  async migrateToAutoBilling(
    membershipId: string,
    dto: MigrateToAutoBillingDto,
    adminId: string,
  ): Promise<EnableAutoBillingResponseDto> {
    const membership = await this.membershipRepo.findOne({
      where: { id: membershipId },
      relations: ['user'],
    });

    if (!membership) {
      throw new NotFoundException(`Membership ${membershipId} not found`);
    }

    if (membership.mpPreapprovalId) {
      throw new ConflictException('Membership already has an active subscription');
    }

    const user = (membership as any).user;
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const amount = dto.amount || Number(membership.adminSetPrice) || Number(membership.amount);

    const preapproval = await this.mpSubscriptionService.createPreapproval({
      userId: membership.userId,
      userEmail: user.email,
      plan: membership.plan,
      price: amount,
      cardTokenId: dto.cardTokenId,
    });

    membership.pendingPaymentId = null;
    membership.pendingPaymentLink = null;
    membership.pendingPaymentExpiresAt = null;
    membership.billingMode = BillingMode.AUTO;
    membership.mpPreapprovalId = preapproval.preapprovalId;
    membership.subscriptionStatus = preapproval.status;
    membership.amount = amount;
    membership.isActive = true;

    await this.membershipRepo.save(membership);

    await this.logAudit({
      userId: membership.userId,
      membershipId: membership.id,
      action: MembershipAuditAction.UPGRADED,
      previousPlan: membership.plan,
      newPlan: membership.plan,
      description: 'Migrated from manual to auto-billing',
      metadata: {
        adminId,
        preapprovalId: preapproval.preapprovalId,
        billingMode: BillingMode.AUTO,
      },
    });

    this.logger.log(
      `Membership ${membershipId} migrated to auto-billing: ${preapproval.preapprovalId}`,
    );

    return {
      preapprovalId: preapproval.preapprovalId,
      status: preapproval.status,
      billingMode: BillingMode.AUTO,
      nextBillingDate: membership.nextBillingDate,
      membership: {
        id: membership.id,
        plan: membership.plan,
        mpPreapprovalId: membership.mpPreapprovalId,
        billingMode: membership.billingMode,
        isActive: membership.isActive,
      },
    };
  }

  async migrateToManualBilling(
    membershipId: string,
    adminId: string,
  ): Promise<MigrateToManualBillingResponseDto> {
    const membership = await this.membershipRepo.findOne({
      where: { id: membershipId },
    });

    if (!membership) {
      throw new NotFoundException(`Membership ${membershipId} not found`);
    }

    const previousBillingMode = membership.billingMode;

    if (membership.mpPreapprovalId) {
      await this.mpSubscriptionService.cancelSubscription(membership.mpPreapprovalId);
    }

    membership.mpPreapprovalId = null;
    membership.mpSubscriptionId = null;
    membership.subscriptionStatus = null;
    membership.billingMode = BillingMode.MANUAL;

    await this.membershipRepo.save(membership);

    await this.logAudit({
      userId: membership.userId,
      membershipId: membership.id,
      action: MembershipAuditAction.DOWNGRADED,
      previousPlan: membership.plan,
      newPlan: membership.plan,
      description: 'Migrated from auto to manual billing',
      metadata: {
        adminId,
        previousBillingMode,
        newBillingMode: BillingMode.MANUAL,
      },
    });

    this.logger.log(`Membership ${membershipId} migrated to manual billing`);

    return {
      membershipId: membership.id,
      previousBillingMode,
      newBillingMode: BillingMode.MANUAL,
      message: 'Subscription cancelled and migrated to manual billing',
    };
  }

  async getBillingDetails(membershipId: string): Promise<BillingDetailsResponseDto> {
    const membership = await this.membershipRepo.findOne({
      where: { id: membershipId },
    });

    if (!membership) {
      throw new NotFoundException(`Membership ${membershipId} not found`);
    }

    const plan = membership.subscriptionPlanId
      ? await this.planRepo.findOne({ where: { id: membership.subscriptionPlanId } })
      : await this.planRepo.findOne({ where: { name: membership.plan } });

    const payments = await this.paymentRepo.find({
      where: { membershipId },
      order: { createdAt: 'DESC' },
      take: 20,
    });

    const paymentHistory: SubscriptionPaymentSummaryDto[] = payments.map((p) => ({
      id: p.id,
      date: p.paidAt || p.createdAt,
      amount: Number(p.amount),
      status: p.status,
      type: p.type,
      periodMonths: p.periodMonths,
      isAdminGenerated: p.isAdminGenerated,
    }));

    const effectivePrice = membership.adminSetPrice || Number(membership.amount) || (plan ? Number(plan.price) : 0);

    return {
      membershipId: membership.id,
      userId: membership.userId,
      billingMode: membership.billingMode,
      currentPlan: {
        name: membership.plan,
        displayName: plan?.displayName || membership.plan,
        basePrice: plan ? Number(plan.price) : 0,
      },
      effectivePrice,
      adminSetPrice: membership.adminSetPrice,
      autoBilling: {
        mpPreapprovalId: membership.mpPreapprovalId,
        status: membership.subscriptionStatus,
        nextBillingDate: membership.nextBillingDate,
        lastPaymentAt: membership.lastPaymentAt,
        paymentMethodId: membership.paymentMethodId,
      },
      manualBilling: {
        pendingPaymentId: membership.pendingPaymentId,
        pendingPaymentLink: membership.pendingPaymentLink,
        pendingPaymentExpiresAt: membership.pendingPaymentExpiresAt,
      },
      paymentHistory,
    };
  }

  async pauseSubscription(membershipId: string, adminId: string): Promise<Membership> {
    const membership = await this.membershipRepo.findOne({
      where: { id: membershipId },
    });

    if (!membership) {
      throw new NotFoundException(`Membership ${membershipId} not found`);
    }

    if (!membership.mpPreapprovalId) {
      throw new BadRequestException('No active subscription to pause');
    }

    await this.mpSubscriptionService.pauseSubscription(membership.mpPreapprovalId);

    membership.subscriptionStatus = 'paused';
    await this.membershipRepo.save(membership);

    await this.logAudit({
      userId: membership.userId,
      membershipId: membership.id,
      action: MembershipAuditAction.RENEWED,
      previousPlan: membership.plan,
      newPlan: membership.plan,
      description: 'Subscription paused by admin',
      metadata: { adminId },
    });

    this.logger.log(`Subscription paused for membership ${membershipId}`);

    return membership;
  }

  async resumeSubscription(membershipId: string, adminId: string): Promise<Membership> {
    const membership = await this.membershipRepo.findOne({
      where: { id: membershipId },
    });

    if (!membership) {
      throw new NotFoundException(`Membership ${membershipId} not found`);
    }

    if (!membership.mpPreapprovalId) {
      throw new BadRequestException('No paused subscription to resume');
    }

    await this.mpSubscriptionService.resumeSubscription(membership.mpPreapprovalId);

    membership.subscriptionStatus = 'authorized';
    await this.membershipRepo.save(membership);

    await this.logAudit({
      userId: membership.userId,
      membershipId: membership.id,
      action: MembershipAuditAction.RENEWED,
      previousPlan: membership.plan,
      newPlan: membership.plan,
      description: 'Subscription resumed by admin',
      metadata: { adminId },
    });

    this.logger.log(`Subscription resumed for membership ${membershipId}`);

    return membership;
  }

  async extendMembership(
    membershipId: string,
    paymentAmount: number,
    periodMonths: number,
    paymentId?: string,
    paymentType: PaymentType = PaymentType.SUBSCRIPTION_PAYMENT,
  ): Promise<Membership> {
    const membership = await this.membershipRepo.findOne({
      where: { id: membershipId },
    });

    if (!membership) {
      throw new NotFoundException(`Membership ${membershipId} not found`);
    }

    const currentExpires = membership.expiresAt || new Date();
    const newExpires = new Date(currentExpires);
    newExpires.setMonth(newExpires.getMonth() + periodMonths);

    membership.expiresAt = newExpires;
    membership.lastPaymentAt = new Date();
    membership.isActive = true;
    membership.accessStartDate = new Date();
    membership.amount = paymentAmount;

    if (membership.pendingPaymentId) {
      membership.pendingPaymentId = null;
      membership.pendingPaymentLink = null;
      membership.pendingPaymentExpiresAt = null;
    }

    await this.membershipRepo.save(membership);

    if (paymentId) {
      const paymentRecord = this.paymentRepo.create({
        membershipId: membership.id,
        mpPaymentId: paymentId,
        mpPreapprovalId: membership.mpPreapprovalId,
        amount: paymentAmount,
        originalAmount: paymentAmount,
        status: PaymentStatus.APPROVED,
        type: paymentType,
        periodMonths,
        isAdminGenerated: paymentType === PaymentType.MANUAL_PAYMENT,
        planName: membership.plan,
        paidAt: new Date(),
      });
      await this.paymentRepo.save(paymentRecord);
    }

    await this.logAudit({
      userId: membership.userId,
      membershipId: membership.id,
      action: MembershipAuditAction.RENEWED,
      previousPlan: membership.plan,
      newPlan: membership.plan,
      amount: paymentAmount,
      description: `Membership extended by ${periodMonths} month(s)`,
      metadata: { paymentId, periodMonths },
    });

    this.logger.log(
      `Membership ${membershipId} extended by ${periodMonths} month(s) - Payment: ${paymentId}`,
    );

    return membership;
  }

  private async logAudit(data: {
    userId: string;
    membershipId: string;
    action: MembershipAuditAction;
    previousPlan: string;
    newPlan: string;
    amount?: number;
    currency?: string;
    description: string;
    metadata?: Record<string, any>;
  }) {
    const audit = this.auditRepo.create({
      userId: data.userId,
      membershipId: data.membershipId,
      action: data.action,
      previousPlan: data.previousPlan,
      newPlan: data.newPlan,
      amount: data.amount,
      currency: data.currency,
      description: data.description,
      metadata: data.metadata,
    });
    return this.auditRepo.save(audit);
  }
}