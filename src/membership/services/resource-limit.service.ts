import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MembershipService } from '../membership.service';
import { SubscriptionPlanService } from './subscription-plan.service';
import { MembershipPlan } from '../enums/membership-plan.enum';

import { Catalog } from '../../catalog/entities/catalog.entity';
import { CatalogItem } from '../../catalog/entities/catalog-item.entity';
import { Commerce } from '../../commerce/entities/commerce.entity';
import { TenantContext } from '../../auth/types/tenant-context.types';

@Injectable()
export class ResourceLimitService {
  private readonly logger = new Logger(ResourceLimitService.name);

  constructor(
    private readonly membershipService: MembershipService,
    private readonly subscriptionPlanService: SubscriptionPlanService,
    @InjectRepository(Catalog)
    private readonly catalogRepository: Repository<Catalog>,
    @InjectRepository(CatalogItem)
    private readonly catalogItemRepository: Repository<CatalogItem>,
    @InjectRepository(Commerce)
    private readonly commerceRepository: Repository<Commerce>,
  ) {}

  private async resolveEffectiveUserId(ctx: TenantContext): Promise<string> {
    if (ctx.commerceId) {
      const commerce = await this.commerceRepository.findOne({
        where: { id: ctx.commerceId },
        select: ['ownerId'],
      });
      if (commerce) {
        return commerce.ownerId;
      }
    }
    return ctx.userId;
  }

  async canCreateCatalog(ctx: TenantContext): Promise<boolean> {
    const effectiveUserId = await this.resolveEffectiveUserId(ctx);
    const membership = await this.membershipService.getUserMembership(
      effectiveUserId,
      ctx.commerceId,
    );
    if (membership.subscriptionPlanId) {
      const currentCount = await this.getCurrentCatalogCount(ctx);
      return this.subscriptionPlanService.canCreateResource(
        membership.subscriptionPlanId,
        'maxCatalogs',
        currentCount,
      );
    }
    const limits = await this.membershipService.getPlanLimits(effectiveUserId);
    const limit = limits.maxCatalogs;
    const currentCount = await this.getCurrentCatalogCount(ctx);
    return limit === -1 || currentCount < limit;
  }

  async canCreateCatalogItem(
    ctx: TenantContext,
    additionalItems: number = 1,
  ): Promise<boolean> {
    const effectiveUserId = await this.resolveEffectiveUserId(ctx);
    const membership = await this.membershipService.getUserMembership(
      effectiveUserId,
      ctx.commerceId,
    );
    if (membership.subscriptionPlanId) {
      const currentCount = await this.getCurrentCatalogItemCount(ctx);
      return this.subscriptionPlanService.canCreateResource(
        membership.subscriptionPlanId,
        'maxCatalogItems',
        currentCount + additionalItems,
      );
    }
    const limits = await this.membershipService.getPlanLimits(effectiveUserId);
    const limit = limits.maxCatalogItems;
    const currentCount = await this.getCurrentCatalogItemCount(ctx);
    return limit === -1 || currentCount + additionalItems < limit;
  }

  async getUserLimits(ctx: TenantContext): Promise<any> {
    const effectiveUserId = await this.resolveEffectiveUserId(ctx);
    const membership = await this.membershipService.getUserMembership(
      effectiveUserId,
      ctx.commerceId,
    );

    if (membership.subscriptionPlanId) {
      const plan = await this.subscriptionPlanService.getPlanById(
        membership.subscriptionPlanId,
      );
      return {
        plan: plan.name,
        type: 'custom',
        limits: plan.limits,
        usage: {
          catalogs: await this.getCurrentCatalogCount(ctx),
          catalogItems: await this.getCurrentCatalogItemCount(ctx),
        },
      };
    }

    const planName = membership.plan || MembershipPlan.FREE;
    try {
      const plan = await this.subscriptionPlanService.getPlanByName(planName);
      return {
        plan: plan.name,
        type: 'standard',
        limits: plan.limits,
        usage: {
          catalogs: await this.getCurrentCatalogCount(ctx),
          catalogItems: await this.getCurrentCatalogItemCount(ctx),
        },
      };
    } catch (error) {
      this.logger.error(
        `Plan ${planName} not found for user ${effectiveUserId}`,
      );
      return {
        plan: planName,
        type: 'standard',
        limits: {},
        usage: {
          catalogs: await this.getCurrentCatalogCount(ctx),
          catalogItems: await this.getCurrentCatalogItemCount(ctx),
        },
      };
    }
  }

  async validateResourceCreation(
    ctx: TenantContext,
    resourceType: 'catalog' | 'catalogItem',
    quantity: number = 1,
  ): Promise<void> {
    let canCreate = false;
    let resourceName = '';

    switch (resourceType) {
      case 'catalog':
        canCreate = await this.canCreateCatalog(ctx);
        resourceName = 'catálogos';
        break;
      case 'catalogItem':
        canCreate = await this.canCreateCatalogItem(ctx, quantity);
        resourceName = 'items de catálogo';
        break;
    }

    if (!canCreate) {
      const limits = await this.getUserLimits(ctx);
      throw new BadRequestException(
        `No puedes crear más ${resourceName}. Tu plan ${limits.plan} tiene límites específicos. Considera actualizar tu plan.`,
      );
    }
  }

  private getTenantFilter(ctx: TenantContext) {
    if (ctx.commerceId) {
      return { commerceId: ctx.commerceId };
    }
    return { ownerId: ctx.userId };
  }

  private async getCurrentCatalogCount(ctx: TenantContext): Promise<number> {
    return await this.catalogRepository.count({
      where: this.getTenantFilter(ctx),
    });
  }

  private async getCurrentCatalogItemCount(
    ctx: TenantContext,
  ): Promise<number> {
    const catalogs = await this.catalogRepository.find({
      where: this.getTenantFilter(ctx),
      select: ['id'],
    });
    if (catalogs.length === 0) {
      return 0;
    }
    const catalogIds = catalogs.map((c) => c.id);
    return await this.catalogItemRepository.count({
      where: { catalogId: { $in: catalogIds as any } } as any,
    });
  }
}
