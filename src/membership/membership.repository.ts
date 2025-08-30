import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Membership } from './entities/membership.entity';
import {
  MembershipAudit,
  MembershipAuditAction,
} from './entities/membership-audit.entity';
import { MembershipPlan } from './enums/membership-plan.enum';

@Injectable()
export class MembershipRepository {
  constructor(
    @InjectRepository(Membership)
    private readonly membershipRepository: Repository<Membership>,
    @InjectRepository(MembershipAudit)
    private readonly auditRepository: Repository<MembershipAudit>,
  ) {}

  async findByUserId(userId: string): Promise<Membership | null> {
    return this.membershipRepository.findOne({
      where: { userId },
      relations: ['user'],
    });
  }

  async createMembership(
    userId: string,
    membershipData: Partial<Membership>,
  ): Promise<Membership> {
    const membership = this.membershipRepository.create({
      userId,
      ...membershipData,
    });
    return this.membershipRepository.save(membership);
  }

  async updateMembership(
    id: string,
    updateData: Partial<Membership>,
  ): Promise<Membership> {
    await this.membershipRepository.update(id, updateData);
    return this.findById(id);
  }

  async findById(id: string): Promise<Membership | null> {
    return this.membershipRepository.findOne({
      where: { id },
      relations: ['user'],
    });
  }

  async findExpiredMemberships(): Promise<Membership[]> {
    return this.membershipRepository
      .createQueryBuilder('membership')
      .where('membership.expiresAt < :now', { now: new Date() })
      .andWhere('membership.isActive = :isActive', { isActive: true })
      .getMany();
  }

  async findMembershipsExpiringIn(days: number): Promise<Membership[]> {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + days);

    return this.membershipRepository
      .createQueryBuilder('membership')
      .where('membership.expiresAt <= :targetDate', { targetDate })
      .andWhere('membership.expiresAt > :now', { now: new Date() })
      .andWhere('membership.isActive = :isActive', { isActive: true })
      .getMany();
  }

  async createAuditLog(auditData: {
    userId: string;
    membershipId?: string;
    action: MembershipAuditAction;
    previousPlan?: MembershipPlan;
    newPlan: MembershipPlan;
    paymentId?: string;
    amount?: number;
    currency?: string;
    description?: string;
    metadata?: Record<string, any>;
  }): Promise<MembershipAudit> {
    const audit = this.auditRepository.create(auditData);
    return this.auditRepository.save(audit);
  }

  async getAuditHistory(userId: string): Promise<MembershipAudit[]> {
    return this.auditRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async getMembershipStats(): Promise<any> {
    const stats = await this.membershipRepository
      .createQueryBuilder('membership')
      .select('membership.plan, COUNT(*) as count')
      .groupBy('membership.plan')
      .getRawMany();

    const activeCount = await this.membershipRepository.count({
      where: { isActive: true },
    });

    const expiredCount = await this.membershipRepository
      .createQueryBuilder('membership')
      .where('membership.expiresAt < :now', { now: new Date() })
      .getCount();

    return {
      byPlan: stats,
      active: activeCount,
      expired: expiredCount,
    };
  }
}
