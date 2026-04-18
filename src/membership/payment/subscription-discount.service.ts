import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  SubscriptionDiscount,
  DiscountType,
  DiscountStatus,
} from '../entities/subscription-discount.entity';
import {
  CreateSubscriptionDiscountDto,
  UpdateSubscriptionDiscountDto,
} from '../dto/subscription-discount.dto';

@Injectable()
export class SubscriptionDiscountService {
  private readonly logger = new Logger(SubscriptionDiscountService.name);

  constructor(
    @InjectRepository(SubscriptionDiscount)
    private discountRepository: Repository<SubscriptionDiscount>,
  ) {}

  async create(
    dto: CreateSubscriptionDiscountDto,
    createdByUserId: string,
  ): Promise<SubscriptionDiscount> {
    const existing = await this.discountRepository.findOne({
      where: { code: dto.code.toUpperCase() },
    });

    if (existing) {
      throw new BadRequestException(
        `Discount code "${dto.code}" already exists`,
      );
    }

    const discount = this.discountRepository.create({
      code: dto.code.toUpperCase(),
      displayName: dto.displayName,
      description: dto.description,
      type: dto.type,
      value: dto.value,
      validFrom: dto.validFrom ? new Date(dto.validFrom) : null,
      validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
      maxUses: dto.maxUses || 0,
      applicablePlans: dto.applicablePlans || null,
      applicableUsers: dto.applicableUsers || null,
      status: DiscountStatus.ACTIVE,
      createdByUserId,
    });

    const saved = await this.discountRepository.save(discount);
    this.logger.log(`Discount created: ${saved.code} by ${createdByUserId}`);
    return saved;
  }

  async findAll(): Promise<SubscriptionDiscount[]> {
    return this.discountRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findActive(): Promise<SubscriptionDiscount[]> {
    return this.discountRepository.find({
      where: { status: DiscountStatus.ACTIVE },
      order: { createdAt: 'DESC' },
    });
  }

  async findById(id: string): Promise<SubscriptionDiscount> {
    const discount = await this.discountRepository.findOne({ where: { id } });
    if (!discount) {
      throw new NotFoundException(`Discount with id "${id}" not found`);
    }
    return discount;
  }

  async findByCode(code: string): Promise<SubscriptionDiscount | null> {
    return this.discountRepository.findOne({
      where: { code: code.toUpperCase() },
    });
  }

  async update(
    id: string,
    dto: UpdateSubscriptionDiscountDto,
  ): Promise<SubscriptionDiscount> {
    const discount = await this.findById(id);

    if (dto.displayName !== undefined) discount.displayName = dto.displayName;
    if (dto.description !== undefined) discount.description = dto.description;
    if (dto.value !== undefined) discount.value = dto.value;
    if (dto.validFrom !== undefined)
      discount.validFrom = dto.validFrom ? new Date(dto.validFrom) : null;
    if (dto.validUntil !== undefined)
      discount.validUntil = dto.validUntil ? new Date(dto.validUntil) : null;
    if (dto.maxUses !== undefined) discount.maxUses = dto.maxUses;
    if (dto.applicablePlans !== undefined)
      discount.applicablePlans = dto.applicablePlans;
    if (dto.type !== undefined) discount.type = dto.type;

    const updated = await this.discountRepository.save(discount);
    this.logger.log(`Discount updated: ${updated.code}`);
    return updated;
  }

  async delete(id: string): Promise<void> {
    const discount = await this.findById(id);
    discount.status = DiscountStatus.INACTIVE;
    await this.discountRepository.save(discount);
    this.logger.log(`Discount deactivated: ${discount.code}`);
  }

  async validateDiscount(
    code: string,
    plan: string,
    userId?: string,
  ): Promise<{
    valid: boolean;
    discount?: SubscriptionDiscount;
    message?: string;
  }> {
    const discount = await this.findByCode(code);

    if (!discount) {
      return { valid: false, message: 'Código de descuento no válido' };
    }

    if (!discount.isValid()) {
      if (discount.status === DiscountStatus.INACTIVE) {
        return { valid: false, message: 'El descuento está inactivo' };
      }
      if (discount.status === DiscountStatus.EXPIRED) {
        return { valid: false, message: 'El descuento ha expirado' };
      }
      if (discount.status === DiscountStatus.EXHAUSTED) {
        return {
          valid: false,
          message: 'El descuento ha alcanzado su límite de usos',
        };
      }
      return { valid: false, message: 'El descuento no es válido' };
    }

    if (discount.validFrom && new Date() < discount.validFrom) {
      return { valid: false, message: 'El descuento aún no está activo' };
    }

    if (discount.validUntil && new Date() > discount.validUntil) {
      discount.status = DiscountStatus.EXPIRED;
      await this.discountRepository.save(discount);
      return { valid: false, message: 'El descuento ha expirado' };
    }

    if (discount.maxUses > 0 && discount.usedCount >= discount.maxUses) {
      discount.status = DiscountStatus.EXHAUSTED;
      await this.discountRepository.save(discount);
      return {
        valid: false,
        message: 'El descuento ha alcanzado su límite de usos',
      };
    }

    if (discount.applicablePlans && discount.applicablePlans.length > 0) {
      if (!discount.applicablePlans.includes(plan)) {
        return {
          valid: false,
          message: `El descuento no aplica para el plan ${plan}`,
        };
      }
    }

    if (discount.applicableUsers && discount.applicableUsers.length > 0) {
      if (!userId || !discount.applicableUsers.includes(userId)) {
        return {
          valid: false,
          message: 'El descuento no está disponible para este usuario',
        };
      }
    }

    return { valid: true, discount };
  }

  async applyDiscount(
    code: string,
    plan: string,
    userId?: string,
  ): Promise<{
    discountId: string;
    percentage: number;
    originalPrice: number;
    finalPrice: number;
  }> {
    const validation = await this.validateDiscount(code, plan, userId);

    if (!validation.valid || !validation.discount) {
      throw new BadRequestException(validation.message);
    }

    const discount = validation.discount;
    const originalPrice = 0;
    const discountAmount = discount.calculateDiscount(originalPrice);
    const finalPrice = discount.calculateFinalPrice(originalPrice);

    return {
      discountId: discount.id,
      percentage:
        discount.type === DiscountType.PERCENTAGE ? discount.value : 0,
      originalPrice,
      finalPrice,
    };
  }

  async incrementUsage(discountId: string): Promise<void> {
    const discount = await this.findById(discountId);
    discount.usedCount += 1;

    if (discount.maxUses > 0 && discount.usedCount >= discount.maxUses) {
      discount.status = DiscountStatus.EXHAUSTED;
    }

    await this.discountRepository.save(discount);
  }

  async getUsageStats(discountId: string): Promise<{
    usedCount: number;
    maxUses: number;
    remaining: number;
    percentageUsed: number;
  }> {
    const discount = await this.findById(discountId);
    const remaining =
      discount.maxUses > 0
        ? Math.max(0, discount.maxUses - discount.usedCount)
        : -1;
    const percentageUsed =
      discount.maxUses > 0 ? (discount.usedCount / discount.maxUses) * 100 : 0;

    return {
      usedCount: discount.usedCount,
      maxUses: discount.maxUses,
      remaining,
      percentageUsed,
    };
  }
}
