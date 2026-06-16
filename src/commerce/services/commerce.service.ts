import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Commerce } from '../entities/commerce.entity';
import { CreateCommerceDto } from '../dto/create-commerce.dto';
import { UpdateCommerceDto } from '../dto/update-commerce.dto';
import { UserRoleService } from '../../auth/services/user-role.service';
import { UserRole } from '../../auth/entities/user-role.entity';
import { RoleType } from '../../auth/models/permissions.model';
import { MembershipService } from '../../membership/membership.service';

@Injectable()
export class CommerceService {
  private readonly logger = new Logger(CommerceService.name);

  constructor(
    @InjectRepository(Commerce)
    private readonly commerceRepository: Repository<Commerce>,
    private readonly userRoleService: UserRoleService,
    private readonly membershipService: MembershipService,
  ) {}

  async create(ownerId: string, dto: CreateCommerceDto, isAdmin = false): Promise<Commerce> {
    if (!isAdmin) {
      const limits = await this.membershipService.getPlanLimits(ownerId);
      const maxCommerces = limits.maxCommerces;
      if (maxCommerces !== -1 && maxCommerces !== undefined) {
        const currentCount = await this.commerceRepository.count({
          where: { ownerId },
        });
        if (currentCount >= maxCommerces) {
          throw new BadRequestException(
            'Has alcanzado el límite de comercios permitido por tu plan. Actualiza tu membresía para crear más comercios.',
          );
        }
      }
    }

    const existingSlug = await this.commerceRepository.findOne({
      where: { slug: dto.slug },
    });
    if (existingSlug) {
      throw new ConflictException(`Ya existe un comercio con el slug: ${dto.slug}`);
    }

    const commerce = this.commerceRepository.create({
      id: uuidv4(),
      ownerId,
      businessName: dto.businessName,
      slug: dto.slug,
      businessType: dto.businessType,
      context: dto.context,
      logoUrl: dto.logoUrl,
      coverImageUrl: dto.coverImageUrl,
      description: dto.description,
      address: dto.address,
      phone: dto.phone,
      isActive: dto.isActive ?? true,
      metadata: dto.metadata,
    });

    const saved = await this.commerceRepository.save(commerce);

    await this.userRoleService.assignRole(ownerId, RoleType.OWNER, dto.context, {
      resourceId: saved.id,
    });

    return saved;
  }

  async findByOwner(ownerId: string): Promise<Commerce[]> {
    return this.commerceRepository.find({
      where: { ownerId, isActive: true },
      order: { createdAt: 'DESC' },
    });
  }

  async findById(id: string): Promise<Commerce> {
    const commerce = await this.commerceRepository.findOne({ where: { id } });
    if (!commerce) {
      throw new NotFoundException(`Comercio no encontrado: ${id}`);
    }
    return commerce;
  }

  async findBySlug(slug: string): Promise<Commerce> {
    const commerce = await this.commerceRepository.findOne({ where: { slug } });
    if (!commerce) {
      throw new NotFoundException(`Comercio no encontrado: ${slug}`);
    }
    return commerce;
  }

  async update(
    id: string,
    userId: string,
    dto: UpdateCommerceDto,
    isAdmin = false,
  ): Promise<Commerce> {
    const commerce = await this.findById(id);

    if (!isAdmin) {
      if (commerce.ownerId !== userId) {
        const hasAccess = await this.userRoleService.hasAccessToCommerce(userId, id);
        if (!hasAccess) {
          throw new ForbiddenException('No tienes permiso para modificar este comercio');
        }
      }
    }

    if (dto.slug && dto.slug !== commerce.slug) {
      const existingSlug = await this.commerceRepository.findOne({
        where: { slug: dto.slug },
      });
      if (existingSlug) {
        throw new ConflictException(`Ya existe un comercio con el slug: ${dto.slug}`);
      }
    }

    Object.assign(commerce, dto);
    return this.commerceRepository.save(commerce);
  }

  async deactivate(id: string, userId: string, isAdmin = false): Promise<void> {
    const commerce = await this.findById(id);

    if (!isAdmin) {
      if (commerce.ownerId !== userId) {
        const hasAccess = await this.userRoleService.hasAccessToCommerce(userId, id);
        if (!hasAccess) {
          throw new ForbiddenException('No tienes permiso para desactivar este comercio');
        }
      }
    }

    commerce.isActive = false;
    await this.commerceRepository.save(commerce);
  }

  async getUserContexts(userId: string): Promise<Commerce[]> {
    return this.commerceRepository
      .createQueryBuilder('commerce')
      .innerJoin(UserRole, 'ur', 'ur.resourceId = CAST(commerce.id AS varchar) AND ur.userId = :userId', { userId })
      .where('commerce.isActive = :active', { active: true })
      .orderBy('commerce.createdAt', 'DESC')
      .distinct(true)
      .getMany();
  }
}
