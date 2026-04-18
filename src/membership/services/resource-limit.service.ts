import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MembershipProvider } from '../membership.provider';
import { SubscriptionPlanService } from './subscription-plan.service';
import { PLAN_LIMITS } from '../enums/membership-plan.enum';

import { Catalog } from '../../catalog/entities/catalog.entity';
import { CatalogItem } from '../../catalog/entities/catalog-item.entity';

@Injectable()
export class ResourceLimitService {
  private readonly logger = new Logger(ResourceLimitService.name);

  constructor(
    private readonly membershipProvider: MembershipProvider,
    private readonly subscriptionPlanService: SubscriptionPlanService,
    @InjectRepository(Catalog)
    private readonly catalogRepository: Repository<Catalog>,
    @InjectRepository(CatalogItem)
    private readonly catalogItemRepository: Repository<CatalogItem>,
  ) {}

  async canCreateCatalog(userId: string): Promise<boolean> {
    const membership = await this.membershipProvider.getMembershipStatus(userId);
    if (membership.subscriptionPlanId) {
      const currentCount = await this.getCurrentCatalogCount(userId);
      return this.subscriptionPlanService.canCreateResource(
        membership.subscriptionPlanId,
        'maxCatalogs',
        currentCount,
      );
    }
    const limit = await this.membershipProvider.getResourceLimit(userId, 'maxCatalogs');
    const currentCount = await this.getCurrentCatalogCount(userId);
    return limit === -1 || currentCount < limit;
  }

  async canCreateCatalogItem(
    userId: string,
    additionalItems: number = 1,
  ): Promise<boolean> {
    const membership = await this.membershipProvider.getMembershipStatus(userId);
    if (membership.subscriptionPlanId) {
      const currentCount = await this.getCurrentCatalogItemCount(userId);
      return this.subscriptionPlanService.canCreateResource(
        membership.subscriptionPlanId,
        'maxCatalogItems',
        currentCount + additionalItems,
      );
    }
    return this.membershipProvider.checkResourceLimit(
      userId,
      'maxCatalogItems',
      additionalItems + (await this.getCurrentCatalogItemCount(userId)),
    );
  }

  async getUserLimits(userId: string): Promise<any> {
    const membership = await this.membershipProvider.getMembershipStatus(userId);

    if (membership.subscriptionPlanId) {
      const plan = await this.subscriptionPlanService.getPlanById(
        membership.subscriptionPlanId,
      );
      return {
        plan: plan.name,
        type: 'custom',
        limits: plan.limits,
        usage: {
          catalogs: await this.getCurrentCatalogCount(userId),
          catalogItems: await this.getCurrentCatalogItemCount(userId),
        },
      };
    }

    const standardLimits = PLAN_LIMITS[membership.plan];
    return {
      plan: membership.plan,
      type: 'standard',
      limits: standardLimits,
      usage: {
        catalogs: await this.getCurrentCatalogCount(userId),
        catalogItems: await this.getCurrentCatalogItemCount(userId),
      },
    };
  }

  async validateResourceCreation(
    userId: string,
    resourceType: 'catalog' | 'catalogItem',
    quantity: number = 1,
  ): Promise<void> {
    let canCreate = false;
    let resourceName = '';

    switch (resourceType) {
      case 'catalog':
        canCreate = await this.canCreateCatalog(userId);
        resourceName = 'catálogos';
        break;
      case 'catalogItem':
        canCreate = await this.canCreateCatalogItem(userId, quantity);
        resourceName = 'items de catálogo';
        break;
    }

    if (!canCreate) {
      const limits = await this.getUserLimits(userId);
      throw new BadRequestException(
        `No puedes crear más ${resourceName}. Tu plan ${limits.plan} tiene límites específicos. Considera actualizar tu plan.`,
      );
    }
  }

  private async getCurrentCatalogCount(userId: string): Promise<number> {
    return await this.catalogRepository.count({
      where: { ownerId: userId },
    });
  }

  private async getCurrentCatalogItemCount(userId: string): Promise<number> {
    const catalogs = await this.catalogRepository.find({
      where: { ownerId: userId },
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