import { Injectable, ConflictException, Logger } from '@nestjs/common';
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
import { MembershipProvider } from '../../membership/membership.provider';
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
    private readonly membershipProvider: MembershipProvider,
  ) {}

  /**
   * Crea un nuevo catálogo
   */
  async createCatalog(
    ownerId: string,
    createCatalogDto: CreateCatalogDto,
  ): Promise<Catalog> {
    try {
      // Generar slug si no se proporciona
      const slug =
        createCatalogDto.slug || this.generateSlug(createCatalogDto.name || '');

      // Verificar si el slug ya existe
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

      // Obtener capacidad basada en la membresía y tipo de catálogo
      let capacity: number;
      if (createCatalogDto.catalogType === CatalogType.MENU) {
        capacity = await this.membershipProvider.getResourceLimit(
          ownerId,
          'maxMenuItems',
        );
      } else if (createCatalogDto.catalogType === CatalogType.WARDROBE) {
        // Por ahora usar el mismo límite que menu items
        capacity = await this.membershipProvider.getResourceLimit(
          ownerId,
          'maxMenuItems',
        );
      } else {
        capacity = 50; // Fallback
      }

      const catalog = this.catalogRepository.create({
        id: uuidv4(),
        ownerId,
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
        `Catálogo creado: ${savedCatalog.id} por usuario ${ownerId}`,
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
   * Obtiene todos los catálogos de un usuario, opcionalmente filtrados por tipo
   */
  async getCatalogsByOwner(
    ownerId: string,
    catalogType?: CatalogType,
    includeItems: boolean = false,
  ): Promise<Catalog[]> {
    const where: FindOptionsWhere<Catalog> = {
      ownerId,
      status: CatalogStatus.ACTIVE,
    };

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
   * Obtiene un catálogo específico con validación de ownership
   */
  async getCatalogById(
    catalogId: string,
    ownerId?: string,
    includeItems: boolean = true,
  ): Promise<Catalog> {
    const relations = includeItems ? ['items', 'owner'] : ['owner'];
    const catalog = await this.catalogRepository.findOne({
      where: { id: catalogId },
      relations,
    });

    if (!catalog) {
      throw new CatalogNotFoundException(catalogId);
    }

    // Validar ownership si se proporciona
    if (ownerId && catalog.ownerId !== ownerId) {
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
  ): Promise<Catalog> {
    const relations = includeItems ? ['items', 'owner'] : ['owner'];
    const catalog = await this.catalogRepository.findOne({
      where: { slug, status: CatalogStatus.ACTIVE },
      relations,
    });

    if (!catalog) {
      throw new CatalogNotFoundException(slug, { searchType: 'slug' });
    }

    // Incrementar contador de vistas
    catalog.viewCount += 1;
    catalog.lastViewedAt = new Date();
    await this.catalogRepository.save(catalog);

    return catalog;
  }

  /**
   * Actualiza un catálogo
   */
  async updateCatalog(
    catalogId: string,
    ownerId: string,
    updateCatalogDto: UpdateCatalogDto,
  ): Promise<Catalog> {
    const catalog = await this.getCatalogById(catalogId, ownerId, false);

    // Si se actualiza el slug, verificar que no exista
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
  async deleteCatalog(catalogId: string, ownerId: string): Promise<void> {
    const catalog = await this.getCatalogById(catalogId, ownerId, false);

    await this.catalogRepository.remove(catalog);

    this.logger.log(`Catálogo eliminado: ${catalogId} por usuario ${ownerId}`);
  }

  /**
   * Archiva un catálogo (soft delete)
   */
  async archiveCatalog(catalogId: string, ownerId: string): Promise<Catalog> {
    const catalog = await this.getCatalogById(catalogId, ownerId, false);

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
  ): Promise<CatalogItem> {
    const catalog = await this.getCatalogById(
      createItemDto.catalogId,
      ownerId,
      true,
    );

    // Verificar capacidad
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

    // Incrementar contador de vistas
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
  ): Promise<CatalogItem> {
    const item = await this.catalogItemRepository.findOne({
      where: { id: itemId },
      relations: ['catalog'],
    });

    if (!item) {
      throw new CatalogItemNotFoundException(itemId);
    }

    // Validar ownership
    if (item.catalog.ownerId !== catalogOwnerId) {
      throw new CatalogUnauthorizedException(item.catalog.id, catalogOwnerId, {
        operation: 'update',
        itemId,
      });
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
  async deleteItem(itemId: string, catalogOwnerId: string): Promise<void> {
    const item = await this.catalogItemRepository.findOne({
      where: { id: itemId },
      relations: ['catalog'],
    });

    if (!item) {
      throw new CatalogItemNotFoundException(itemId);
    }

    if (item.catalog.ownerId !== catalogOwnerId) {
      throw new CatalogUnauthorizedException(item.catalog.id, catalogOwnerId, {
        operation: 'delete',
        itemId,
      });
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

    // Filtrar solo items disponibles
    const availableItems = catalog.items
      ? catalog.items.filter(
          (item) =>
            item.isAvailable && item.status === CatalogItemStatus.AVAILABLE,
        )
      : [];

    // Incrementar contador de vistas
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
      metadata: catalog.metadata,
      owner: {
        id: catalog.owner.id,
        name: catalog.owner.name,
        photoURL: catalog.owner.photoURL,
      },
      items: availableItems,
      viewCount: catalog.viewCount,
      createdAt: catalog.createdAt,
    };
  }

  /**
   * Busca catálogos públicos por tipo y/o tags
   */
  async searchPublicCatalogs(
    catalogType?: CatalogType,
    tags?: string[],
    limit: number = 20,
  ): Promise<Catalog[]> {
    const queryBuilder = this.catalogRepository
      .createQueryBuilder('catalog')
      .leftJoinAndSelect('catalog.owner', 'owner')
      .where('catalog.status = :status', { status: CatalogStatus.ACTIVE })
      .andWhere('catalog.isPublic = :isPublic', { isPublic: true });

    if (catalogType) {
      queryBuilder.andWhere('catalog.catalogType = :catalogType', {
        catalogType,
      });
    }

    if (tags && tags.length > 0) {
      queryBuilder.andWhere('catalog.tags && :tags', { tags });
    }

    return await queryBuilder
      .orderBy('catalog.viewCount', 'DESC')
      .take(limit)
      .getMany();
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
}
