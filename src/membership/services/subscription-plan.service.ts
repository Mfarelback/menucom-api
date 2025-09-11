import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  SubscriptionPlan,
  PlanStatus,
  PlanType,
} from '../entities/subscription-plan.entity';
import { CreateSubscriptionPlanDto } from '../dto/create-subscription-plan.dto';
import { UpdateSubscriptionPlanDto } from '../dto/update-subscription-plan.dto';
import {
  MembershipPlan,
  MembershipFeature,
  PLAN_FEATURES,
  PLAN_LIMITS,
} from '../enums/membership-plan.enum';

@Injectable()
export class SubscriptionPlanService {
  private readonly logger = new Logger(SubscriptionPlanService.name);

  constructor(
    @InjectRepository(SubscriptionPlan)
    private readonly subscriptionPlanRepository: Repository<SubscriptionPlan>,
  ) {}

  /**
   * Crear planes estándar predefinidos (FREE, PREMIUM, ENTERPRISE)
   */
  async seedStandardPlans(): Promise<void> {
    const standardPlans = [
      {
        name: MembershipPlan.FREE,
        displayName: 'Plan Gratuito',
        description: 'Perfecto para empezar con funcionalidades básicas',
        type: PlanType.STANDARD,
        price: 0,
        currency: 'ARS',
        billingCycle: 'monthly',
        features: PLAN_FEATURES[MembershipPlan.FREE],
        limits: {
          maxMenus: 1,
          maxMenuItems: PLAN_LIMITS[MembershipPlan.FREE].maxMenuItems,
          maxWardrobes: 1,
          maxClothingItems: 10,
          maxLocations: PLAN_LIMITS[MembershipPlan.FREE].maxLocations,
          analyticsRetention:
            PLAN_LIMITS[MembershipPlan.FREE].analyticsRetention,
          maxUsers: 1,
          maxApiCalls: 100,
          storageLimit: 100, // 100MB
        },
        metadata: {
          color: '#6B7280',
          icon: 'free',
          popular: false,
        },
      },
      {
        name: MembershipPlan.PREMIUM,
        displayName: 'Plan Premium',
        description:
          'Para negocios en crecimiento con funcionalidades avanzadas',
        type: PlanType.STANDARD,
        price: 15000,
        currency: 'ARS',
        billingCycle: 'monthly',
        features: PLAN_FEATURES[MembershipPlan.PREMIUM],
        limits: {
          maxMenus: 5,
          maxMenuItems: PLAN_LIMITS[MembershipPlan.PREMIUM].maxMenuItems,
          maxWardrobes: 5,
          maxClothingItems: 500,
          maxLocations: PLAN_LIMITS[MembershipPlan.PREMIUM].maxLocations,
          analyticsRetention:
            PLAN_LIMITS[MembershipPlan.PREMIUM].analyticsRetention,
          maxUsers: 3,
          maxApiCalls: 10000,
          storageLimit: 1000, // 1GB
        },
        metadata: {
          color: '#3B82F6',
          icon: 'premium',
          popular: true,
          trial: {
            enabled: true,
            days: 14,
          },
        },
      },
      {
        name: MembershipPlan.ENTERPRISE,
        displayName: 'Plan Empresarial',
        description: 'Para empresas que necesitan todas las funcionalidades',
        type: PlanType.STANDARD,
        price: 45000,
        currency: 'ARS',
        billingCycle: 'monthly',
        features: PLAN_FEATURES[MembershipPlan.ENTERPRISE],
        limits: {
          maxMenus: -1, // Unlimited
          maxMenuItems: -1,
          maxWardrobes: -1,
          maxClothingItems: -1,
          maxLocations: -1,
          analyticsRetention: 365,
          maxUsers: -1,
          maxApiCalls: -1,
          storageLimit: -1,
        },
        metadata: {
          color: '#7C3AED',
          icon: 'enterprise',
          popular: false,
          customizations: {
            branding: true,
            whiteLabel: true,
            customDomain: true,
            prioritySupport: true,
          },
        },
      },
    ];

    for (const planData of standardPlans) {
      const existingPlan = await this.subscriptionPlanRepository.findOne({
        where: { name: planData.name },
      });

      if (!existingPlan) {
        const plan = this.subscriptionPlanRepository.create(planData);
        await this.subscriptionPlanRepository.save(plan);
        this.logger.log(`Created standard plan: ${planData.name}`);
      }
    }
  }

  /**
   * Crear un nuevo plan personalizado
   */
  async createPlan(
    createPlanDto: CreateSubscriptionPlanDto,
    createdByUserId: string,
  ): Promise<SubscriptionPlan> {
    // Verificar que el nombre del plan no exista
    const existingPlan = await this.subscriptionPlanRepository.findOne({
      where: { name: createPlanDto.name },
    });

    if (existingPlan) {
      throw new BadRequestException(
        `Plan with name '${createPlanDto.name}' already exists`,
      );
    }

    const plan = this.subscriptionPlanRepository.create({
      ...createPlanDto,
      createdByUserId,
      status: PlanStatus.ACTIVE,
    });

    const savedPlan = await this.subscriptionPlanRepository.save(plan);
    this.logger.log(
      `Created custom plan: ${savedPlan.name} by user: ${createdByUserId}`,
    );

    return savedPlan;
  }

  /**
   * Obtener todos los planes activos
   */
  async getActivePlans(): Promise<SubscriptionPlan[]> {
    return this.subscriptionPlanRepository.find({
      where: { status: PlanStatus.ACTIVE },
      order: { type: 'ASC', price: 'ASC' },
    });
  }

  /**
   * Obtener planes por tipo
   */
  async getPlansByType(type: PlanType): Promise<SubscriptionPlan[]> {
    return this.subscriptionPlanRepository.find({
      where: { type, status: PlanStatus.ACTIVE },
      order: { price: 'ASC' },
    });
  }

  /**
   * Obtener un plan por ID
   */
  async getPlanById(id: string): Promise<SubscriptionPlan> {
    const plan = await this.subscriptionPlanRepository.findOne({
      where: { id },
    });

    if (!plan) {
      throw new NotFoundException(`Plan with ID '${id}' not found`);
    }

    return plan;
  }

  /**
   * Obtener un plan por nombre
   */
  async getPlanByName(name: string): Promise<SubscriptionPlan> {
    const plan = await this.subscriptionPlanRepository.findOne({
      where: { name },
    });

    if (!plan) {
      throw new NotFoundException(`Plan with name '${name}' not found`);
    }

    return plan;
  }

  /**
   * Actualizar un plan
   */
  async updatePlan(
    id: string,
    updatePlanDto: UpdateSubscriptionPlanDto,
  ): Promise<SubscriptionPlan> {
    const plan = await this.getPlanById(id);

    // No permitir cambiar el tipo de plan estándar
    if (
      plan.type === PlanType.STANDARD &&
      updatePlanDto.type === PlanType.CUSTOM
    ) {
      throw new BadRequestException(
        'Cannot change standard plan to custom plan',
      );
    }

    Object.assign(plan, updatePlanDto);
    const updatedPlan = await this.subscriptionPlanRepository.save(plan);

    this.logger.log(`Updated plan: ${updatedPlan.name}`);
    return updatedPlan;
  }

  /**
   * Archivar un plan (soft delete)
   */
  async archivePlan(id: string): Promise<SubscriptionPlan> {
    const plan = await this.getPlanById(id);

    if (plan.type === PlanType.STANDARD) {
      throw new BadRequestException('Cannot archive standard plans');
    }

    plan.status = PlanStatus.ARCHIVED;
    const archivedPlan = await this.subscriptionPlanRepository.save(plan);

    this.logger.log(`Archived plan: ${archivedPlan.name}`);
    return archivedPlan;
  }

  /**
   * Verificar si un usuario puede crear un recurso específico
   */
  async canCreateResource(
    planId: string,
    resourceType: keyof SubscriptionPlan['limits'],
    currentCount: number,
  ): Promise<boolean> {
    const plan = await this.getPlanById(planId);
    return plan.canCreateResource(resourceType, currentCount);
  }

  /**
   * Obtener límite de un recurso específico
   */
  async getResourceLimit(
    planId: string,
    resourceType: keyof SubscriptionPlan['limits'],
  ): Promise<number> {
    const plan = await this.getPlanById(planId);
    return plan.getLimit(resourceType);
  }

  /**
   * Verificar si un plan tiene una característica específica
   */
  async hasFeature(
    planId: string,
    feature: MembershipFeature,
  ): Promise<boolean> {
    const plan = await this.getPlanById(planId);
    return plan.hasFeature(feature);
  }

  /**
   * Obtener estadísticas de planes
   */
  async getPlanStats(): Promise<any> {
    const totalPlans = await this.subscriptionPlanRepository.count();
    const activePlans = await this.subscriptionPlanRepository.count({
      where: { status: PlanStatus.ACTIVE },
    });
    const customPlans = await this.subscriptionPlanRepository.count({
      where: { type: PlanType.CUSTOM },
    });

    return {
      totalPlans,
      activePlans,
      customPlans,
      standardPlans: totalPlans - customPlans,
    };
  }
}
