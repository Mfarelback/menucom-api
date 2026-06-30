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
import { ActivityLogService } from './activity-log.service';
import { ActivityAction } from '../entities/activity-log.entity';
import { NotificationsService } from '../../notifications/notifications.service';

@Injectable()
export class CommerceService {
  private readonly logger = new Logger(CommerceService.name);

  constructor(
    @InjectRepository(Commerce)
    private readonly commerceRepository: Repository<Commerce>,
    private readonly userRoleService: UserRoleService,
    private readonly membershipService: MembershipService,
    private readonly activityLogService: ActivityLogService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(
    ownerId: string,
    dto: CreateCommerceDto,
    isAdmin = false,
  ): Promise<Commerce> {
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
      throw new ConflictException(
        `Ya existe un comercio con el slug: ${dto.slug}`,
      );
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

    await this.userRoleService.assignRole(
      ownerId,
      RoleType.OWNER,
      dto.context,
      {
        resourceId: saved.id,
      },
    );

    try {
      await this.userRoleService.deactivateRole(
        ownerId,
        RoleType.OWNER,
        dto.context,
        undefined,
      );
    } catch {
      // No existía rol previo sin resourceId, todo bien
    }

    await this.activityLogService.log({
      commerceId: saved.id,
      userId: ownerId,
      userRole: 'OWNER',
      action: ActivityAction.CREATE,
      entityType: 'Commerce',
      entityId: saved.id,
      summary: `Comercio "${saved.businessName}" creado`,
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

    const isOwner = commerce.ownerId === userId;

    if (!isAdmin) {
      if (!isOwner) {
        const hasAccess = await this.userRoleService.hasAccessToCommerce(
          userId,
          id,
        );
        if (!hasAccess) {
          throw new ForbiddenException(
            'No tienes permiso para modificar este comercio',
          );
        }
      }
    }

    // 0.2: Solo OWNER o ADMIN pueden modificar campos sensibles de identidad
    if (!isAdmin && !isOwner) {
      const forbiddenFields: (keyof UpdateCommerceDto)[] = [
        'businessName',
        'slug',
        'businessType',
        'context',
      ];
      const attempted = forbiddenFields.filter(
        (field) => dto[field] !== undefined,
      );
      if (attempted.length > 0) {
        throw new ForbiddenException(
          `Solo el propietario puede modificar: ${attempted.join(', ')}`,
        );
      }
    }

    if (dto.slug && dto.slug !== commerce.slug) {
      const existingSlug = await this.commerceRepository.findOne({
        where: { slug: dto.slug },
      });
      if (existingSlug) {
        throw new ConflictException(
          `Ya existe un comercio con el slug: ${dto.slug}`,
        );
      }
    }

    const oldValues: Record<string, any> = {};
    const trackedFields = [
      'businessName',
      'slug',
      'description',
      'address',
      'phone',
      'businessType',
      'context',
    ];
    for (const field of trackedFields) {
      if (dto[field] !== undefined && dto[field] !== commerce[field]) {
        oldValues[field] = { from: commerce[field], to: dto[field] };
      }
    }

    Object.assign(commerce, dto);
    const updated = await this.commerceRepository.save(commerce);

    const userRoleName = isAdmin ? 'ADMIN' : isOwner ? 'OWNER' : 'MANAGER';

    if (Object.keys(oldValues).length > 0) {
      await this.activityLogService.log({
        commerceId: id,
        userId,
        userRole: userRoleName,
        action: ActivityAction.UPDATE,
        entityType: 'Commerce',
        entityId: id,
        changes: oldValues,
        summary: `Comercio actualizado: ${Object.keys(oldValues).join(', ')}`,
      });
    }

    if (!isAdmin && !isOwner) {
      await this.notificationsService
        .sendNotificationToUser(
          commerce.ownerId,
          'Cambios en tu comercio',
          `Un MANAGER modificó el comercio "${commerce.businessName}"`,
          { commerceId: id, type: 'commerce_updated', updatedBy: userId },
        )
        .catch(() => {});
    }

    return updated;
  }

  async deactivate(id: string, userId: string, isAdmin = false): Promise<void> {
    const commerce = await this.findById(id);

    // 0.1: Solo OWNER o ADMIN pueden desactivar el comercio
    if (!isAdmin && commerce.ownerId !== userId) {
      throw new ForbiddenException(
        'Solo el propietario del comercio puede desactivarlo.',
      );
    }

    commerce.isActive = false;
    await this.commerceRepository.save(commerce);

    const userRoleName = isAdmin ? 'ADMIN' : 'OWNER';
    await this.activityLogService.log({
      commerceId: id,
      userId,
      userRole: userRoleName,
      action: ActivityAction.DEACTIVATE,
      entityType: 'Commerce',
      entityId: id,
      summary: `Comercio "${commerce.businessName}" desactivado`,
    });
  }

  async getUserContexts(
    userId: string,
  ): Promise<{ commerce: Commerce; role: string }[]> {
    const qb = this.commerceRepository
      .createQueryBuilder('commerce')
      .innerJoin(
        UserRole,
        'ur',
        'ur.resourceId = CAST(commerce.id AS varchar) AND ur.userId = :userId AND ur.isActive = true',
        { userId },
      )
      .addSelect('ur.role', 'userRole')
      .where('commerce.isActive = :active', { active: true })
      .orderBy('commerce.createdAt', 'DESC')
      .distinct(true);

    const { entities, raw } = await qb.getRawAndEntities();

    return entities.map((commerce, i) => ({
      commerce,
      role: raw[i]?.userRole ?? 'owner',
    }));
  }
}
