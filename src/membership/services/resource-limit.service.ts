import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { MembershipProvider } from '../membership.provider';
import { SubscriptionPlanService } from './subscription-plan.service';
import { PLAN_LIMITS } from '../enums/membership-plan.enum';

// Import entities for counting
import { Menu } from '../../menu/entities/menu.entity';
import { MenuItem } from '../../menu/entities/menu-item.entity';
import { Wardrobes } from '../../wardrobes/entities/wardrobes.entity';
import { ClothingItem } from '../../wardrobes/entities/clothing_item.entity';

@Injectable()
export class ResourceLimitService {
  private readonly logger = new Logger(ResourceLimitService.name);

  constructor(
    private readonly membershipProvider: MembershipProvider,
    private readonly subscriptionPlanService: SubscriptionPlanService,
    @InjectRepository(Menu)
    private readonly menuRepository: Repository<Menu>,
    @InjectRepository(MenuItem)
    private readonly menuItemRepository: Repository<MenuItem>,
    @InjectRepository(Wardrobes)
    private readonly wardrobeRepository: Repository<Wardrobes>,
    @InjectRepository(ClothingItem)
    private readonly clothingItemRepository: Repository<ClothingItem>,
  ) {}

  /**
   * Verificar si un usuario puede crear un nuevo menú
   */
  async canCreateMenu(userId: string): Promise<boolean> {
    const membership =
      await this.membershipProvider.getMembershipStatus(userId);

    // Si tiene un plan personalizado, usar sus límites
    if (membership.subscriptionPlanId) {
      const currentMenuCount = await this.getCurrentMenuCount(userId);
      return this.subscriptionPlanService.canCreateResource(
        membership.subscriptionPlanId,
        'maxMenus',
        currentMenuCount,
      );
    }

    // Usar límites del plan estándar
    const limit = await this.membershipProvider.getResourceLimit(
      userId,
      'maxMenuItems',
    );
    const currentCount = await this.getCurrentMenuCount(userId);

    return limit === -1 || currentCount < limit;
  }

  /**
   * Verificar si un usuario puede crear un nuevo item de menú
   */
  async canCreateMenuItem(
    userId: string,
    additionalItems: number = 1,
  ): Promise<boolean> {
    const membership =
      await this.membershipProvider.getMembershipStatus(userId);

    // Si tiene un plan personalizado, usar sus límites
    if (membership.subscriptionPlanId) {
      const currentItemCount = await this.getCurrentMenuItemCount(userId);
      return this.subscriptionPlanService.canCreateResource(
        membership.subscriptionPlanId,
        'maxMenuItems',
        currentItemCount + additionalItems,
      );
    }

    // Usar límites del plan estándar
    return this.membershipProvider.checkResourceLimit(
      userId,
      'maxMenuItems',
      additionalItems,
    );
  }

  /**
   * Verificar si un usuario puede crear un nuevo wardrobe
   */
  async canCreateWardrobe(userId: string): Promise<boolean> {
    const membership =
      await this.membershipProvider.getMembershipStatus(userId);

    // Si tiene un plan personalizado, usar sus límites
    if (membership.subscriptionPlanId) {
      const currentWardrobeCount = await this.getCurrentWardrobeCount(userId);
      return this.subscriptionPlanService.canCreateResource(
        membership.subscriptionPlanId,
        'maxWardrobes',
        currentWardrobeCount,
      );
    }

    // Para planes estándar, usar los nuevos límites
    const limit = await this.getWardrobeLimit(userId);
    const currentCount = await this.getCurrentWardrobeCount(userId);

    return limit === -1 || currentCount < limit;
  }

  /**
   * Verificar si un usuario puede crear un nuevo item de ropa
   */
  async canCreateClothingItem(
    userId: string,
    additionalItems: number = 1,
  ): Promise<boolean> {
    const membership =
      await this.membershipProvider.getMembershipStatus(userId);

    // Si tiene un plan personalizado, usar sus límites
    if (membership.subscriptionPlanId) {
      const currentItemCount = await this.getCurrentClothingItemCount(userId);
      return this.subscriptionPlanService.canCreateResource(
        membership.subscriptionPlanId,
        'maxClothingItems',
        currentItemCount + additionalItems,
      );
    }

    // Para planes estándar, usar los nuevos límites
    const limit = await this.getClothingItemLimit(userId);
    const currentCount = await this.getCurrentClothingItemCount(userId);

    return limit === -1 || currentCount + additionalItems <= limit;
  }

  /**
   * Obtener límites completos para un usuario
   */
  async getUserLimits(userId: string): Promise<any> {
    const membership =
      await this.membershipProvider.getMembershipStatus(userId);

    // Si tiene un plan personalizado, devolver sus límites
    if (membership.subscriptionPlanId) {
      const plan = await this.subscriptionPlanService.getPlanById(
        membership.subscriptionPlanId,
      );
      return {
        plan: plan.name,
        type: 'custom',
        limits: plan.limits,
        usage: {
          menus: await this.getCurrentMenuCount(userId),
          menuItems: await this.getCurrentMenuItemCount(userId),
          wardrobes: await this.getCurrentWardrobeCount(userId),
          clothingItems: await this.getCurrentClothingItemCount(userId),
        },
      };
    }

    // Límites del plan estándar
    const standardLimits = PLAN_LIMITS[membership.plan];
    return {
      plan: membership.plan,
      type: 'standard',
      limits: {
        ...standardLimits,
        maxWardrobes: await this.getWardrobeLimit(userId),
        maxClothingItems: await this.getClothingItemLimit(userId),
      },
      usage: {
        menus: await this.getCurrentMenuCount(userId),
        menuItems: await this.getCurrentMenuItemCount(userId),
        wardrobes: await this.getCurrentWardrobeCount(userId),
        clothingItems: await this.getCurrentClothingItemCount(userId),
      },
    };
  }

  /**
   * Validar y lanzar excepción si se exceden los límites
   */
  async validateResourceCreation(
    userId: string,
    resourceType: 'menu' | 'menuItem' | 'wardrobe' | 'clothingItem',
    quantity: number = 1,
  ): Promise<void> {
    let canCreate = false;
    let resourceName = '';

    switch (resourceType) {
      case 'menu':
        canCreate = await this.canCreateMenu(userId);
        resourceName = 'menú';
        break;
      case 'menuItem':
        canCreate = await this.canCreateMenuItem(userId, quantity);
        resourceName = 'items de menú';
        break;
      case 'wardrobe':
        canCreate = await this.canCreateWardrobe(userId);
        resourceName = 'wardrobe';
        break;
      case 'clothingItem':
        canCreate = await this.canCreateClothingItem(userId, quantity);
        resourceName = 'items de ropa';
        break;
    }

    if (!canCreate) {
      const limits = await this.getUserLimits(userId);
      throw new BadRequestException(
        `No puedes crear más ${resourceName}. Tu plan ${limits.plan} tiene límites específicos. Considera actualizar tu plan.`,
      );
    }
  }

  // Métodos privados para obtener conteos actuales
  private async getCurrentMenuCount(userId: string): Promise<number> {
    return await this.menuRepository.count({
      where: { idOwner: userId },
    });
  }

  private async getCurrentMenuItemCount(userId: string): Promise<number> {
    // Primero obtener todos los menús del usuario
    const userMenus = await this.menuRepository.find({
      where: { idOwner: userId },
      select: ['id'],
    });

    if (userMenus.length === 0) {
      return 0;
    }

    // Contar items en todos los menús del usuario
    const menuIds = userMenus.map((menu) => menu.id);
    return await this.menuItemRepository.count({
      where: { menu: { id: In(menuIds) } },
    });
  }

  private async getCurrentWardrobeCount(userId: string): Promise<number> {
    return await this.wardrobeRepository.count({
      where: { idOwner: userId },
    });
  }

  private async getCurrentClothingItemCount(userId: string): Promise<number> {
    // Primero obtener todos los wardrobes del usuario
    const userWardrobes = await this.wardrobeRepository.find({
      where: { idOwner: userId },
      select: ['id'],
    });

    if (userWardrobes.length === 0) {
      return 0;
    }

    // Contar items en todos los wardrobes del usuario
    const wardrobeIds = userWardrobes.map((wardrobe) => wardrobe.id);
    return await this.clothingItemRepository.count({
      where: { wardrobe: { id: In(wardrobeIds) } },
    });
  }

  private async getWardrobeLimit(userId: string): Promise<number> {
    const membership =
      await this.membershipProvider.getMembershipStatus(userId);
    // Mapear desde los límites estándar nuevos
    const limits = {
      free: 1,
      premium: 5,
      enterprise: -1,
    };
    return limits[membership.plan] || 1;
  }

  private async getClothingItemLimit(userId: string): Promise<number> {
    const membership =
      await this.membershipProvider.getMembershipStatus(userId);
    // Mapear desde los límites estándar nuevos
    const limits = {
      free: 10,
      premium: 500,
      enterprise: -1,
    };
    return limits[membership.plan] || 10;
  }
}
