import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, Not } from 'typeorm';
import { Membership } from '../entities/membership.entity';
import { MembershipAudit, MembershipAuditAction } from '../entities/membership-audit.entity';
import { SubscriptionPlan, PlanStatus, PlanType } from '../entities/subscription-plan.entity';
import { MembershipPlan, MembershipFeature } from '../enums/membership-plan.enum';
import {
  QueryMembershipsAdminDto,
  UpdateMembershipAdminDto,
  CreateCustomPlanDto,
  UpdateCustomPlanDto,
  MembershipStatsResponseDto,
  MembershipAuditResponseDto,
  MembershipWithUserDto,
} from '../dto/admin-membership.dto';

@Injectable()
export class MembershipAdminService {
  private readonly logger = new Logger(MembershipAdminService.name);

  constructor(
    @InjectRepository(Membership)
    private readonly membershipRepo: Repository<Membership>,
    @InjectRepository(MembershipAudit)
    private readonly auditRepo: Repository<MembershipAudit>,
    @InjectRepository(SubscriptionPlan)
    private readonly planRepo: Repository<SubscriptionPlan>,
  ) {}

  async getMembershipsAdmin(query: QueryMembershipsAdminDto) {
    const { search, plan, status, page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'DESC' } = query;
    const skip = (page - 1) * limit;

    const qb = this.membershipRepo
      .createQueryBuilder('m')
      .leftJoinAndSelect('m.user', 'user')
      .leftJoinAndSelect('m.subscriptionPlan', 'subscriptionPlan');

    if (search) {
      qb.andWhere(
        '(user.email ILIKE :search OR user.name ILIKE :search OR m.userId ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (plan) {
      qb.andWhere('m.plan = :plan', { plan });
    }

    this.applyStatusFilter(qb, status);

    const validSortColumns = ['createdAt', 'updatedAt', 'plan', 'expiresAt', 'amount'];
    const sortColumn = validSortColumns.includes(sortBy) ? `m.${sortBy}` : 'm.createdAt';
    qb.orderBy(sortColumn, sortOrder);

    const [data, total] = await qb.skip(skip).take(limit).getManyAndCount();

    return {
      data: data.map((m) => this.formatMembership(m)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getMembershipById(id: string) {
    const membership = await this.membershipRepo.findOne({
      where: { id },
      relations: ['user', 'subscriptionPlan'],
    });
    if (!membership) {
      throw new NotFoundException(`Membership ${id} not found`);
    }
    return this.formatMembership(membership);
  }

  async getMembershipByUserId(userId: string) {
    const membership = await this.membershipRepo.findOne({
      where: { userId },
      relations: ['user', 'subscriptionPlan'],
    });
    if (!membership) {
      throw new NotFoundException(`Membership for user ${userId} not found`);
    }
    return this.formatMembership(membership);
  }

  async updateMembershipAdmin(id: string, dto: UpdateMembershipAdminDto, adminId: string) {
    const membership = await this.membershipRepo.findOne({ where: { id } });
    if (!membership) {
      throw new NotFoundException(`Membership ${id} not found`);
    }

    const previousPlan = membership.plan;
    const updateData: Partial<Membership> = {};

    if (dto.plan !== undefined) {
      updateData.plan = dto.plan;
      const dbPlan = await this.planRepo.findOne({ where: { name: dto.plan } });
      updateData.features = dbPlan?.features || [];
      if (dbPlan) {
        updateData.subscriptionPlanId = dbPlan.id;
      }
    }
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;
    if (dto.expiresAt !== undefined) updateData.expiresAt = new Date(dto.expiresAt);
    if (dto.subscriptionStatus !== undefined) updateData.subscriptionStatus = dto.subscriptionStatus;

    await this.membershipRepo.update(id, updateData);

    const action =
      dto.plan && dto.plan !== previousPlan
        ? this.determineAuditAction(previousPlan, dto.plan)
        : MembershipAuditAction.RENEWED;

    await this.logAudit({
      userId: membership.userId,
      membershipId: membership.id,
      action,
      previousPlan,
      newPlan: dto.plan || previousPlan,
      description: `Admin ${adminId} updated membership`,
      metadata: { adminId, ...dto },
    });

    this.logger.log(`Admin ${adminId} updated membership ${id}`);
    return this.getMembershipById(id);
  }

  async getMembershipStats(): Promise<MembershipStatsResponseDto> {
    const now = new Date();

    const [byPlan, total, activeCount, pendingCount, cancelledCount, expiredCount, revenue] = await Promise.all([
      this.membershipRepo.createQueryBuilder('m')
        .select('m.plan', 'plan')
        .addSelect('COUNT(*)', 'count')
        .groupBy('m.plan')
        .getRawMany(),
      this.membershipRepo.count(),
      this.membershipRepo.count({ where: { isActive: true } }),
      this.membershipRepo.count({ where: { subscriptionStatus: 'pending' } }),
      this.membershipRepo.count({ where: { isActive: false } }),
      this.membershipRepo.count({ where: { expiresAt: LessThan(now), isActive: true } }),
      this.membershipRepo.createQueryBuilder('m')
        .select('SUM(m.amount)', 'total')
        .where('m.isActive = :isActive', { isActive: true })
        .getRawOne(),
    ]);

    const monthlyRevenue = Number(revenue?.total || 0);

    return {
      byPlan: byPlan.map((s) => ({ plan: s.plan, count: parseInt(s.count, 10) })),
      active: activeCount,
      expired: expiredCount,
      total,
      byStatus: { active: activeCount, pending: pendingCount, cancelled: cancelledCount, expired: expiredCount },
      revenue: {
        monthly: monthlyRevenue,
        yearly: monthlyRevenue * 12,
        projected: monthlyRevenue * 12 * 0.9,
      },
    };
  }

  async getMembershipAuditHistory(membershipId: string) {
    const audits = await this.auditRepo.find({
      where: { membershipId },
      order: { createdAt: 'DESC' },
    });
    return audits.map((a) => this.formatAudit(a));
  }

  async getMembershipAuditHistoryByUserId(userId: string) {
    const audits = await this.auditRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
    return audits.map((a) => this.formatAudit(a));
  }

  async assignPlanToUser(
    userId: string,
    plan: string,
    adminId: string,
    options?: { expiresAt?: Date; reason?: string },
  ) {
    let membership = await this.membershipRepo.findOne({ where: { userId } });
    const previousPlan = membership?.plan || MembershipPlan.FREE;

    const dbPlan = await this.planRepo.findOne({ where: { name: plan } });
    const features = dbPlan?.features || [];

    if (!membership) {
      membership = this.membershipRepo.create({
        userId,
        plan,
        features,
        isActive: true,
        expiresAt: options?.expiresAt,
        subscriptionPlanId: dbPlan?.id,
      });
    } else {
      await this.membershipRepo.update(membership.id, {
        plan,
        features,
        expiresAt: options?.expiresAt ?? membership.expiresAt,
        subscriptionPlanId: dbPlan?.id,
      });
    }

    membership = await this.membershipRepo.findOne({ where: { userId } });

    await this.logAudit({
      userId,
      membershipId: membership!.id,
      action: this.determineAuditAction(previousPlan, plan),
      previousPlan,
      newPlan: plan,
      description: options?.reason || `Admin ${adminId} assigned plan`,
      metadata: { adminId, assignedPlan: true },
    });

    this.logger.log(`Admin ${adminId} assigned ${plan} to user ${userId}`);
    return membership!;
  }

  async getAllPlans() {
    const [standardPlans, customPlans] = await Promise.all([
      this.getStandardPlans(),
      this.planRepo.find({ where: { type: PlanType.CUSTOM, status: PlanStatus.ACTIVE } }),
    ]);
    return { standardPlans, customPlans };
  }

  async getCustomPlans() {
    return this.planRepo.find({
      where: { type: PlanType.CUSTOM, status: Not(PlanStatus.ARCHIVED) },
      order: { price: 'ASC' },
    });
  }

  async getCustomPlanById(id: string) {
    const plan = await this.planRepo.findOne({ where: { id } });
    if (!plan) throw new NotFoundException(`Plan ${id} not found`);
    return plan;
  }

  async createCustomPlan(dto: CreateCustomPlanDto, adminId: string) {
    const existing = await this.planRepo.findOne({ where: { name: dto.name } });
    if (existing) {
      throw new BadRequestException(`Plan with name '${dto.name}' already exists`);
    }

    const plan = this.planRepo.create({
      name: dto.name,
      displayName: dto.displayName || dto.name,
      description: dto.description,
      type: PlanType.CUSTOM,
      price: dto.price,
      currency: dto.currency || 'ARS',
      billingCycle: dto.billingCycle || 'monthly',
      features: (dto.features || []) as MembershipFeature[],
      limits: dto.limits || {},
      metadata: dto.metadata,
      status: PlanStatus.ACTIVE,
      createdByUserId: adminId,
    });

    const saved = await this.planRepo.save(plan);
    this.logger.log(`Admin ${adminId} created plan ${saved.id}`);
    return saved;
  }

  async updateCustomPlan(id: string, dto: UpdateCustomPlanDto, adminId: string) {
    const plan = await this.planRepo.findOne({ where: { id } });
    if (!plan) throw new NotFoundException(`Plan ${id} not found`);

    const updateData: Partial<SubscriptionPlan> = {};
    if (dto.displayName !== undefined) updateData.displayName = dto.displayName;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.status !== undefined) updateData.status = dto.status;
    if (dto.price !== undefined) updateData.price = dto.price;
    if (dto.currency !== undefined) updateData.currency = dto.currency;
    if (dto.billingCycle !== undefined) updateData.billingCycle = dto.billingCycle;
    if (dto.features !== undefined) updateData.features = dto.features;
    if (dto.limits !== undefined) updateData.limits = { ...plan.limits, ...dto.limits };
    if (dto.metadata !== undefined) updateData.metadata = { ...plan.metadata, ...dto.metadata };

    await this.planRepo.update(id, updateData);
    this.logger.log(`Admin ${adminId} updated plan ${id}`);
    return this.getCustomPlanById(id);
  }

  async deleteCustomPlan(id: string) {
    const plan = await this.planRepo.findOne({ where: { id } });
    if (!plan) throw new NotFoundException(`Plan ${id} not found`);

    const activeSubscriptions = await this.membershipRepo.count({
      where: { subscriptionPlanId: id, isActive: true },
    });
    if (activeSubscriptions > 0) {
      plan.status = PlanStatus.INACTIVE;
    } else {
      plan.status = PlanStatus.ARCHIVED;
    }
    await this.planRepo.save(plan);
    this.logger.log(`Plan ${id} ${plan.status === PlanStatus.ARCHIVED ? 'archived' : 'deactivated'}`);
  }

  async getPlanUsageStats(planId: string) {
    const plan = await this.planRepo.findOne({ where: { id: planId } });
    if (!plan) throw new NotFoundException(`Plan ${planId} not found`);

    const usage = await this.membershipRepo
      .createQueryBuilder('m')
      .select('COUNT(*)', 'activeSubscriptions')
      .addSelect('COALESCE(SUM(m.amount), 0)', 'totalRevenue')
      .where('m.subscriptionPlanId = :planId', { planId })
      .andWhere('m.isActive = :isActive', { isActive: true })
      .getRawOne();

    return {
      plan: { id: plan.id, name: plan.name, displayName: plan.displayName, price: plan.price },
      activeSubscriptions: parseInt(usage?.activeSubscriptions || '0', 10),
      totalRevenue: Number(usage?.totalRevenue || 0),
    };
  }

  private async getStandardPlans() {
    return this.planRepo.find({
      where: { type: PlanType.STANDARD, status: PlanStatus.ACTIVE },
      order: { price: 'ASC' },
    });
  }

  private applyStatusFilter(qb: any, status?: string) {
    if (!status) return;
    const now = new Date();

    switch (status) {
      case 'active':
        qb.where('m.isActive = :isActive', { isActive: true })
          .andWhere('(m.expiresAt IS NULL OR m.expiresAt > :now)', { now });
        break;
      case 'pending':
        qb.where('m.subscriptionStatus = :status', { status: 'pending' });
        break;
      case 'expired':
        qb.where('m.expiresAt < :now', { now });
        break;
      case 'cancelled':
        qb.where('m.isActive = :isActive', { isActive: false });
        break;
      case 'trialing':
        qb.where('m.expiresAt > :now', { now })
          .andWhere('m.subscriptionStatus = :status', { status: 'trialing' });
        break;
    }
  }

  private formatMembership(m: Membership): MembershipWithUserDto {
    return {
      id: m.id,
      userId: m.userId,
      plan: m.plan,
      features: m.features || [],
      isActive: m.isActive,
      expiresAt: m.expiresAt,
      remainingDays: m.getRemainingDays(),
      isExpired: m.isExpired(),
      subscriptionStatus: m.subscriptionStatus,
      amount: m.amount,
      currency: m.currency,
      nextBillingDate: m.nextBillingDate,
      lastPaymentAt: m.lastPaymentAt,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
      user: m.user ? { id: m.user.id, email: m.user.email, name: m.user.name } : undefined,
    };
  }

  private formatAudit(a: MembershipAudit): MembershipAuditResponseDto {
    return {
      id: a.id,
      membershipId: a.membershipId,
      action: a.action,
      previousPlan: a.previousPlan,
      newPlan: a.newPlan,
      paymentId: a.paymentId,
      amount: a.amount,
      currency: a.currency,
      description: a.description,
      metadata: a.metadata,
      createdAt: a.createdAt,
    };
  }

  private async logAudit(data: {
    userId: string;
    membershipId: string;
    action: MembershipAuditAction;
    previousPlan: string;
    newPlan: string;
    description: string;
    metadata?: Record<string, any>;
  }) {
    const audit = this.auditRepo.create(data as any);
    return this.auditRepo.save(audit);
  }

  private determineAuditAction(previous: string, next: string): MembershipAuditAction {
    if (previous === next) return MembershipAuditAction.RENEWED;

    const hierarchy: Record<string, number> = {
      [MembershipPlan.FREE]: 0,
      [MembershipPlan.PREMIUM]: 1,
      [MembershipPlan.ENTERPRISE]: 2,
    };

    if (hierarchy[next] !== undefined && hierarchy[previous] !== undefined) {
      return hierarchy[next] > hierarchy[previous]
        ? MembershipAuditAction.UPGRADED
        : hierarchy[next] < hierarchy[previous]
        ? MembershipAuditAction.DOWNGRADED
        : MembershipAuditAction.RENEWED;
    }

    return MembershipAuditAction.UPGRADED;
  }
}