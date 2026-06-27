import { Injectable, ConflictException, ForbiddenException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { Catalog } from '../entities/catalog.entity';
import { CatalogItem } from '../entities/catalog-item.entity';
import {
  CatalogType,
  CatalogStatus,
  CatalogItemStatus,
} from '../enums/catalog-type.enum';
import { v4 as uuidv4 } from 'uuid';
import { CreateCatalogDto, UpdateCatalogDto } from '../dto/catalog.dto';
import {
  CreateCatalogItemDto,
  UpdateCatalogItemDto,
} from '../dto/catalog-item.dto';
import { ResourceLimitService } from '../../membership/services/resource-limit.service';
import { UserRoleService } from '../../auth/services/user-role.service';
import { Permission, BusinessContext } from '../../auth/models/permissions.model';
import { Commerce } from '../../commerce/entities/commerce.entity';
import {
  CatalogNotFoundException,
  CatalogItemNotFoundException,
  CatalogUnauthorizedException,
  InvalidCatalogDataException,
} from '../../core/exceptions';
@Injectable()
export class CatalogService {
  private readonly logger = new Logger(CatalogService.name);

  constructor(
    @InjectRepository(Catalog)
    private readonly catalogRepository: Repository<Catalog>,
    @InjectRepository(CatalogItem)
    private readonly catalogItemRepository: Repository<CatalogItem>,
    @InjectRepository(Commerce)
    private readonly commerceRepository: Repository<Commerce>,
    private readonly resourceLimitService: ResourceLimitService,
    private readonly userRoleService: UserRoleService,
  ) {}

  /**
   * Crea un nuevo catálogo
   */
  async createCatalog(
    ownerId: string,
    createCatalogDto: CreateCatalogDto,
    commerceId?: string,
  ): Promise<Catalog> {
    try {
      if (commerceId) {
        await this.validateCatalogPermission(ownerId, commerceId, Permission.CREATE_CATALOG);
      }

      await this.resourceLimitService.validateResourceCreation(
        { userId: ownerId, commerceId },
        'catalog',
      );

      const slug =
        createCatalogDto.slug || this.generateSlug(createCatalogDto.name || '');

      if (slug) {
        const existingCatalog = await this.catalogRepository.findOne({
          where: { slug },
        });

        if (existingCatalog) {
          throw new ConflictException(
            `Ya existe un catálogo con el slug: ${slug}`,
          );
        }
      }

      const limits = await this.resourceLimitService.getUserLimits({
        userId: ownerId,
        commerceId,
      });
      const capacity = limits.limits.maxCatalogItems;

      const catalog = this.catalogRepository.create({
        id: uuidv4(),
        ownerId,
        commerceId: commerceId || null,
        catalogType: createCatalogDto.catalogType,
        name: createCatalogDto.name,
        description: createCatalogDto.description,
        capacity: capacity,
        coverImageUrl: createCatalogDto.coverImageUrl,
        slug: slug || null,
        isPublic: createCatalogDto.isPublic !== false,
        metadata: createCatalogDto.metadata || {},
        settings: createCatalogDto.settings || {},
        tags: createCatalogDto.tags || [],
        status: CatalogStatus.ACTIVE,
      });

      const savedCatalog = await this.catalogRepository.save(catalog);

      this.logger.log(
        `Catálogo creado: ${savedCatalog.id} por usuario ${ownerId}${commerceId ? ` en comercio ${commerceId}` : ''}`,
      );

      return savedCatalog;
    } catch (error) {
      this.logger.error(
        `Error creando catálogo: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Obtiene todos los catálogos de un tenant, opcionalmente filtrados por tipo
   */
  async getCatalogsByOwner(
    ownerId: string,
    catalogType?: CatalogType,
    includeItems: boolean = false,
    commerceId?: string,
  ): Promise<Catalog[]> {
    const where: FindOptionsWhere<Catalog> = {
      status: CatalogStatus.ACTIVE,
    };

    if (commerceId) {
      where.commerceId = commerceId;
    } else {
      where.ownerId = ownerId;
    }

    if (catalogType) {
      where.catalogType = catalogType;
    }

    const relations = includeItems ? ['items'] : [];

    return await this.catalogRepository.find({
      where,
      relations,
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Obtiene catálogos agrupados por vinculación al comercio
   */
  async getMyCatalogsGrouped(
    ownerId: string,
    commerceId: string,
    catalogType?: CatalogType,
  ): Promise<{ linked: Catalog[]; unlinked: Catalog[] }> {
    const baseWhere: FindOptionsWhere<Catalog> = {
      status: CatalogStatus.ACTIVE,
    };

    if (catalogType) {
      baseWhere.catalogType = catalogType;
    }

    this.logger.log(
      `getMyCatalogsGrouped: ownerId=${ownerId}, commerceId=${commerceId}, catalogType=${catalogType || 'all'}`,
    );

    const linked = await this.catalogRepository.find({
      where: { ...baseWhere, commerceId },
      order: { createdAt: 'DESC' },
    });

    this.logger.log(`getMyCatalogsGrouped: linked=${linked.length} catalogs`);

    const unlinked = await this.catalogRepository
      .createQueryBuilder('catalog')
      .where('catalog.ownerId = :ownerId', { ownerId })
      .andWhere('catalog.status = :status', { status: CatalogStatus.ACTIVE })
      .andWhere(
        catalogType
          ? 'catalog.catalogType = :catalogType AND (catalog.commerceId IS NULL OR catalog.commerceId NOT IN (SELECT id FROM commerce WHERE "ownerId" = :ownerId))'
          : '(catalog.commerceId IS NULL OR catalog.commerceId NOT IN (SELECT id FROM commerce WHERE "ownerId" = :ownerId))',
        catalogType ? { catalogType, ownerId } : { ownerId },
      )
      .orderBy('catalog.createdAt', 'DESC')
      .getMany();

    this.logger.log(`getMyCatalogsGrouped: unlinked=${unlinked.length} catalogs`);

    return { linked, unlinked };
  }

  /**
   * Vincula un catálogo sin comercio al comercio del usuario
   */
  async assignCatalogToCommerce(
    catalogId: string,
    ownerId: string,
    commerceId: string,
  ): Promise<Catalog> {
    const catalog = await this.catalogRepository.findOne({
      where: { id: catalogId },
    });

    if (!catalog) {
      throw new CatalogNotFoundException(catalogId);
    }

    if (catalog.ownerId !== ownerId) {
      throw new CatalogUnauthorizedException(catalogId, ownerId);
    }

    if (catalog.commerceId) {
      throw new InvalidCatalogDataException(
        'El catálogo ya está vinculado a un comercio',
        { catalogId, currentCommerceId: catalog.commerceId },
      );
    }

    catalog.commerceId = commerceId;

    const updated = await this.catalogRepository.save(catalog);

    this.logger.log(
      `Catálogo ${catalogId} vinculado al comercio ${commerceId} por usuario ${ownerId}`,
    );

    return updated;
  }

  /**
   * Obtiene un catálogo específico con validación de ownership o commerceId
   */
  async getCatalogById(
    catalogId: string,
    ownerId?: string,
    includeItems: boolean = true,
    commerceId?: string,
  ): Promise<Catalog> {
    const relations = includeItems ? ['items'] : [];
    const catalog = await this.catalogRepository.findOne({
      where: { id: catalogId },
      relations,
    });

    if (!catalog) {
      throw new CatalogNotFoundException(catalogId);
    }

    if (commerceId && catalog.commerceId && catalog.commerceId !== commerceId) {
      throw new CatalogUnauthorizedException(catalogId, ownerId, {
        commerceId,
        catalogCommerceId: catalog.commerceId,
      });
    }

    if (ownerId && !commerceId && catalog.ownerId !== ownerId) {
      throw new CatalogUnauthorizedException(catalogId, ownerId);
    }

    return catalog;
  }

  /**
   * Obtiene un catálogo por slug
   */
  async getCatalogBySlug(
    slug: string,
    includeItems: boolean = true,
  ): Promise<any> {
    const relations = includeItems ? ['items', 'owner'] : ['owner'];
    const catalog = await this.catalogRepository.findOne({
      where: { slug, status: CatalogStatus.ACTIVE },
      relations,
    });

    if (!catalog) {
      throw new CatalogNotFoundException(slug, { searchType: 'slug' });
    }

    const availableItems = catalog.items
      ? catalog.items.filter(
          (item) =>
            item.isAvailable && item.status === CatalogItemStatus.AVAILABLE,
        )
      : [];

    catalog.viewCount += 1;
    catalog.lastViewedAt = new Date();
    await this.catalogRepository.save(catalog);

    return {
      id: catalog.id,
      type: catalog.catalogType,
      name: catalog.name,
      description: catalog.description,
      coverImageUrl: catalog.coverImageUrl,
      tags: catalog.tags,
      slug: catalog.slug,
      metadata: catalog.metadata,
      owner: {
        id: catalog.owner.id,
        name: catalog.owner.name,
        photoURL: catalog.owner.photoURL,
      },
      items: availableItems,
      itemCount: availableItems.length,
      viewCount: catalog.viewCount,
      createdAt: catalog.createdAt,
    };
  }

  /**
   * Actualiza un catálogo
   */
  async updateCatalog(
    catalogId: string,
    ownerId: string,
    updateCatalogDto: UpdateCatalogDto,
    commerceId?: string,
  ): Promise<Catalog> {
    const catalog = await this.getCatalogById(
      catalogId,
      ownerId,
      false,
      commerceId,
    );

    if (commerceId || catalog.commerceId) {
      await this.validateCatalogPermission(
        ownerId,
        commerceId || catalog.commerceId,
        Permission.UPDATE_CATALOG,
      );
    }

    if ('slug' in updateCatalogDto && updateCatalogDto.slug) {
      const existingCatalog = await this.catalogRepository.findOne({
        where: { slug: updateCatalogDto.slug },
      });

      if (existingCatalog && existingCatalog.id !== catalogId) {
        throw new ConflictException(
          `Ya existe un catálogo con el slug: ${updateCatalogDto.slug}`,
        );
      }
    }

    Object.assign(catalog, {
      ...updateCatalogDto,
      updatedAt: new Date(),
    });

    const updatedCatalog = await this.catalogRepository.save(catalog);

    this.logger.log(`Catálogo actualizado: ${catalogId}`);

    return updatedCatalog;
  }

  /**
   * Elimina un catálogo y todos sus items
   */
  async deleteCatalog(
    catalogId: string,
    ownerId: string,
    commerceId?: string,
  ): Promise<void> {
    const catalog = await this.getCatalogById(
      catalogId,
      ownerId,
      false,
      commerceId,
    );

    if (commerceId || catalog.commerceId) {
      await this.validateCatalogPermission(
        ownerId,
        commerceId || catalog.commerceId,
        Permission.DELETE_CATALOG,
      );
    }

    await this.catalogRepository.remove(catalog);

    this.logger.log(`Catálogo eliminado: ${catalogId} por usuario ${ownerId}`);
  }

  /**
   * Archiva un catálogo (soft delete)
   */
  async archiveCatalog(
    catalogId: string,
    ownerId: string,
    commerceId?: string,
  ): Promise<Catalog> {
    const catalog = await this.getCatalogById(
      catalogId,
      ownerId,
      false,
      commerceId,
    );

    if (commerceId || catalog.commerceId) {
      await this.validateCatalogPermission(
        ownerId,
        commerceId || catalog.commerceId,
        Permission.UPDATE_CATALOG,
      );
    }

    catalog.status = CatalogStatus.ARCHIVED;
    catalog.archivedAt = new Date();

    return await this.catalogRepository.save(catalog);
  }

  /**
   * Añade un item a un catálogo
   */
  async addItem(
    ownerId: string,
    createItemDto: CreateCatalogItemDto,
    commerceId?: string,
  ): Promise<CatalogItem> {
    if (commerceId) {
      await this.validateCatalogPermission(ownerId, commerceId, Permission.CREATE_ITEM);
    }

    await this.resourceLimitService.validateResourceCreation(
      { userId: ownerId, commerceId },
      'catalogItem',
    );

    const catalog = await this.getCatalogById(
      createItemDto.catalogId,
      ownerId,
      true,
      commerceId,
    );

    const currentItemCount = catalog.items?.length || 0;
    if (currentItemCount >= catalog.capacity) {
      throw new InvalidCatalogDataException(
        `El catálogo ha alcanzado su capacidad máxima de ${catalog.capacity} items`,
        {
          catalogId: createItemDto.catalogId,
          currentItemCount,
          capacity: catalog.capacity,
        },
      );
    }

    const item = this.catalogItemRepository.create({
      id: uuidv4(),
      catalogId: catalog.id,
      name: createItemDto.name,
      description: createItemDto.description,
      photoURL: createItemDto.photoURL,
      price: createItemDto.price,
      discountPrice: createItemDto.discountPrice,
      quantity: createItemDto.quantity || 0,
      sku: createItemDto.sku,
      isAvailable: createItemDto.isAvailable !== false,
      isFeatured: createItemDto.isFeatured || false,
      attributes: createItemDto.attributes || {},
      additionalImages: createItemDto.additionalImages || [],
      category: createItemDto.category,
      tags: createItemDto.tags || [],
      displayOrder: createItemDto.displayOrder || 0,
      status: CatalogItemStatus.AVAILABLE,
    });

    const savedItem = await this.catalogItemRepository.save(item);

    this.logger.log(`Item creado: ${savedItem.id} en catálogo ${catalog.id}`);

    return savedItem;
  }

  /**
   * Obtiene un item específico
   */
  async getItemById(itemId: string): Promise<CatalogItem> {
    const item = await this.catalogItemRepository.findOne({
      where: { id: itemId },
      relations: ['catalog'],
    });

    if (!item) {
      throw new CatalogItemNotFoundException(itemId);
    }

    item.viewCount += 1;
    await this.catalogItemRepository.save(item);

    return item;
  }

  /**
   * Actualiza un item
   */
  async updateItem(
    itemId: string,
    catalogOwnerId: string,
    updateItemDto: UpdateCatalogItemDto,
    commerceId?: string,
  ): Promise<CatalogItem> {
    const item = await this.catalogItemRepository.findOne({
      where: { id: itemId },
      relations: ['catalog'],
    });

    if (!item) {
      throw new CatalogItemNotFoundException(itemId);
    }

    // Validar ownership: por commerceId o por ownerId
    if (commerceId && item.catalog.commerceId) {
      if (item.catalog.commerceId !== commerceId) {
        throw new CatalogUnauthorizedException(
          item.catalog.id,
          catalogOwnerId,
          {
            operation: 'update',
            itemId,
            commerceId,
          },
        );
      }
    } else if (item.catalog.ownerId !== catalogOwnerId) {
      throw new CatalogUnauthorizedException(item.catalog.id, catalogOwnerId, {
        operation: 'update',
        itemId,
      });
    }

    const resolvedCommerceId = commerceId || item.catalog.commerceId;
    if (resolvedCommerceId) {
      await this.validateCatalogPermission(catalogOwnerId, resolvedCommerceId, Permission.UPDATE_ITEM);
    }

    Object.assign(item, {
      ...updateItemDto,
      updatedAt: new Date(),
    });

    const updatedItem = await this.catalogItemRepository.save(item);

    this.logger.log(`Item actualizado: ${itemId}`);

    return updatedItem;
  }

  /**
   * Elimina un item
   */
  async deleteItem(
    itemId: string,
    catalogOwnerId: string,
    commerceId?: string,
  ): Promise<void> {
    const item = await this.catalogItemRepository.findOne({
      where: { id: itemId },
      relations: ['catalog'],
    });

    if (!item) {
      throw new CatalogItemNotFoundException(itemId);
    }

    // Validar ownership: por commerceId o por ownerId
    if (commerceId && item.catalog.commerceId) {
      if (item.catalog.commerceId !== commerceId) {
        throw new CatalogUnauthorizedException(
          item.catalog.id,
          catalogOwnerId,
          {
            operation: 'delete',
            itemId,
            commerceId,
          },
        );
      }
    } else if (item.catalog.ownerId !== catalogOwnerId) {
      throw new CatalogUnauthorizedException(item.catalog.id, catalogOwnerId, {
        operation: 'delete',
        itemId,
      });
    }

    const resolvedCommerceId = commerceId || item.catalog.commerceId;
    if (resolvedCommerceId) {
      await this.validateCatalogPermission(catalogOwnerId, resolvedCommerceId, Permission.DELETE_ITEM);
    }

    await this.catalogItemRepository.remove(item);

    this.logger.log(`Item eliminado: ${itemId}`);
  }

  /**
   * Obtiene catálogo público (sin validación de ownership)
   */
  async getPublicCatalog(catalogId: string): Promise<any> {
    const catalog = await this.catalogRepository.findOne({
      where: { id: catalogId, status: CatalogStatus.ACTIVE, isPublic: true },
      relations: ['items', 'owner'],
    });

    if (!catalog) {
      throw new CatalogNotFoundException(catalogId, {
        searchType: 'public',
        isPublic: true,
      });
    }

    const availableItems = catalog.items
      ? catalog.items.filter(
          (item) =>
            item.isAvailable && item.status === CatalogItemStatus.AVAILABLE,
        )
      : [];

    catalog.viewCount += 1;
    catalog.lastViewedAt = new Date();
    await this.catalogRepository.save(catalog);

    return {
      id: catalog.id,
      type: catalog.catalogType,
      name: catalog.name,
      description: catalog.description,
      coverImageUrl: catalog.coverImageUrl,
      tags: catalog.tags,
      slug: catalog.slug,
      metadata: catalog.metadata,
      owner: {
        id: catalog.owner.id,
        name: catalog.owner.name,
        photoURL: catalog.owner.photoURL,
      },
      items: availableItems,
      itemCount: availableItems.length,
      viewCount: catalog.viewCount,
      createdAt: catalog.createdAt,
    };
  }

  /**
   * Obtiene catálogo público por ID (sin validación de ownership)
   */
  async getPublicCatalogById(catalogId: string): Promise<any> {
    const catalog = await this.catalogRepository.findOne({
      where: { id: catalogId, status: CatalogStatus.ACTIVE, isPublic: true },
      relations: ['items', 'owner'],
    });

    if (!catalog) {
      throw new CatalogNotFoundException(catalogId, {
        searchType: 'public',
        isPublic: true,
      });
    }

    const availableItems = catalog.items
      ? catalog.items.filter(
          (item) =>
            item.isAvailable && item.status === CatalogItemStatus.AVAILABLE,
        )
      : [];

    catalog.viewCount += 1;
    catalog.lastViewedAt = new Date();
    await this.catalogRepository.save(catalog);

    return {
      id: catalog.id,
      type: catalog.catalogType,
      name: catalog.name,
      description: catalog.description,
      coverImageUrl: catalog.coverImageUrl,
      tags: catalog.tags,
      slug: catalog.slug,
      metadata: catalog.metadata,
      owner: {
        id: catalog.owner.id,
        name: catalog.owner.name,
        photoURL: catalog.owner.photoURL,
      },
      items: availableItems,
      itemCount: availableItems.length,
      viewCount: catalog.viewCount,
      createdAt: catalog.createdAt,
    };
  }

  /**
   * Obtiene todos los catálogos públicos de un owner (sin validación de ownership)
   */
  async getPublicCatalogsByOwnerId(ownerId: string): Promise<any> {
    const catalogs = await this.catalogRepository.find({
      where: { ownerId, status: CatalogStatus.ACTIVE, isPublic: true },
      relations: ['items', 'owner'],
      order: { createdAt: 'DESC' },
    });

    if (!catalogs || catalogs.length === 0) {
      throw new CatalogNotFoundException(ownerId, {
        searchType: 'public',
        isPublic: true,
      });
    }

    return catalogs.map((catalog) => {
      const availableItems = catalog.items
        ? catalog.items.filter(
            (item) =>
              item.isAvailable && item.status === CatalogItemStatus.AVAILABLE,
          )
        : [];

      return {
        id: catalog.id,
        type: catalog.catalogType,
        name: catalog.name,
        description: catalog.description,
        coverImageUrl: catalog.coverImageUrl,
        tags: catalog.tags,
        slug: catalog.slug,
        metadata: catalog.metadata,
        owner: {
          id: catalog.owner.id,
          name: catalog.owner.name,
          photoURL: catalog.owner.photoURL,
        },
        items: availableItems,
        itemCount: availableItems.length,
        viewCount: catalog.viewCount,
        createdAt: catalog.createdAt,
      };
    });
  }

  /**
   * Obtiene catálogos públicos de un comercio por slug o UUID
   */
  async getPublicCatalogsByCommerce(identifier: string): Promise<any> {
    const isUUID =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        identifier,
      );

    const commerce = isUUID
      ? await this.commerceRepository.findOne({
          where: { id: identifier, isActive: true },
        })
      : await this.commerceRepository.findOne({
          where: { slug: identifier, isActive: true },
        });

    if (!commerce) {
      throw new CatalogNotFoundException(identifier, {
        searchType: 'commerce',
        isPublic: true,
      });
    }

    const catalogs = await this.catalogRepository.find({
      where: {
        commerceId: commerce.id,
        status: CatalogStatus.ACTIVE,
        isPublic: true,
      },
      relations: ['items'],
      order: { createdAt: 'DESC' },
    });

    if (!catalogs || catalogs.length === 0) {
      throw new CatalogNotFoundException(identifier, {
        searchType: 'commerce',
        isPublic: true,
      });
    }

    return catalogs.map((catalog) => {
      const availableItems = catalog.items
        ? catalog.items.filter(
            (item) =>
              item.isAvailable && item.status === CatalogItemStatus.AVAILABLE,
          )
        : [];

      return {
        id: catalog.id,
        type: catalog.catalogType,
        name: catalog.name,
        description: catalog.description,
        coverImageUrl: catalog.coverImageUrl,
        tags: catalog.tags,
        slug: catalog.slug,
        commerceId: commerce.id,
        metadata: catalog.metadata,
        commerce: {
          id: commerce.id,
          name: commerce.businessName,
          slug: commerce.slug,
          logoUrl: commerce.logoUrl,
          description: commerce.description,
          address: commerce.address,
          phone: commerce.phone,
        },
        items: availableItems,
        itemCount: availableItems.length,
        viewCount: catalog.viewCount,
        createdAt: catalog.createdAt,
      };
    });
  }

  /**
   * Busca catálogos públicos por tipo y/o tags
   */
  async searchPublicCatalogs(
    catalogType?: CatalogType,
    tags?: string[],
    limit: number = 20,
  ): Promise<any> {
    const queryBuilder = this.catalogRepository
      .createQueryBuilder('catalog')
      .leftJoinAndSelect('catalog.owner', 'owner')
      .leftJoin(
        'catalog.items',
        'item',
        'item.isAvailable = :itemAvailable AND item.status = :itemStatus',
        { itemAvailable: true, itemStatus: CatalogItemStatus.AVAILABLE },
      )
      .addSelect('COUNT(item.id)', 'itemCount')
      .where('catalog.status = :status', { status: CatalogStatus.ACTIVE })
      .andWhere('catalog.isPublic = :isPublic', { isPublic: true })
      .groupBy('catalog.id')
      .addGroupBy('owner.id');

    if (catalogType) {
      queryBuilder.andWhere('catalog.catalogType = :catalogType', {
        catalogType,
      });
    }

    if (tags && tags.length > 0) {
      queryBuilder.andWhere('catalog.tags && :tags', { tags });
    }

    const catalogs = await queryBuilder
      .orderBy('catalog.viewCount', 'DESC')
      .take(limit)
      .getRawAndEntities();

    return catalogs.entities.map((catalog, index) => ({
      id: catalog.id,
      type: catalog.catalogType,
      name: catalog.name,
      description: catalog.description,
      coverImageUrl: catalog.coverImageUrl,
      tags: catalog.tags,
      slug: catalog.slug,
      metadata: catalog.metadata,
      owner: {
        id: catalog.owner.id,
        name: catalog.owner.name,
        photoURL: catalog.owner.photoURL,
      },
      itemCount: parseInt(catalogs.raw[index]?.itemCount || '0', 10),
      viewCount: catalog.viewCount,
      createdAt: catalog.createdAt,
    }));
  }

  /**
   * Helper para generar slug desde un nombre
   */
  private generateSlug(name: string): string {
    if (!name) return '';

    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private async validateCatalogPermission(
    userId: string,
    commerceId: string,
    permission: Permission,
  ): Promise<void> {
    const commerce = await this.commerceRepository.findOne({
      where: { id: commerceId },
      select: ['context'],
    });

    const context = commerce?.context as BusinessContext || BusinessContext.GENERAL;

    const hasPermission = await this.userRoleService.userHasPermission(
      userId,
      context,
      permission,
    );

    if (!hasPermission) {
      throw new ForbiddenException(
        `No tienes permiso para realizar esta acción (${permission}) en el comercio`,
      );
    }
  }
}
