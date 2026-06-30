import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { UserRole } from '../../auth/entities/user-role.entity';
import { Catalog } from '../../catalog/entities/catalog.entity';
import { CatalogItem } from '../../catalog/entities/catalog-item.entity';
import { Order } from '../../orders/entities/order.entity';
import { Commerce } from '../../commerce/entities/commerce.entity';
import { RoleType } from '../../auth/models/permissions.model';
import {
  CatalogType,
  CatalogStatus,
  CatalogItemStatus,
} from '../../catalog/enums/catalog-type.enum';
import {
  MerchantListQueryDto,
  MerchantSortBy,
  PaginationMeta,
} from '../dto/merchant-list-query.dto';
import { MerchantListItem, MerchantDetail } from '../dto/merchant-response.dto';
import { CategoryResponse } from '../dto/category-response.dto';
import { StatsResponse, TopCategory } from '../dto/stats-response.dto';
import { SearchQueryDto, SearchResult } from '../dto/search-query.dto';

const CATEGORY_LABELS: Record<string, string> = {
  [CatalogType.MENU]: 'Restaurantes',
  [CatalogType.WARDROBE]: 'Tiendas de Ropa',
  [CatalogType.PRODUCT_LIST]: 'Productos',
  [CatalogType.SERVICE_LIST]: 'Servicios',
  [CatalogType.MARKETPLACE]: 'Marketplace',
};

@Injectable()
export class PublicService {
  private readonly logger = new Logger(PublicService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(UserRole)
    private readonly userRoleRepository: Repository<UserRole>,
    @InjectRepository(Catalog)
    private readonly catalogRepository: Repository<Catalog>,
    @InjectRepository(CatalogItem)
    private readonly catalogItemRepository: Repository<CatalogItem>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Commerce)
    private readonly commerceRepository: Repository<Commerce>,
  ) {}

  async getMerchants(
    query: MerchantListQueryDto,
  ): Promise<{ data: MerchantListItem[]; meta: PaginationMeta }> {
    const {
      page = 1,
      limit = 20,
      type,
      search,
      sort = MerchantSortBy.RECENT,
    } = query;
    const skip = (page - 1) * limit;

    const qb = this.userRepository
      .createQueryBuilder('user')
      .innerJoin(
        UserRole,
        'role',
        'role.userId = user.id AND role.role = :ownerRole',
        { ownerRole: RoleType.OWNER },
      )
      .innerJoin(
        Catalog,
        'catalog',
        'catalog.ownerId = user.id AND catalog.status = :active AND catalog.isPublic = :isPublic',
        { active: CatalogStatus.ACTIVE, isPublic: true },
      )
      .where((qb1) => {
        const subQb = qb1
          .subQuery()
          .select('ci."catalogId"')
          .from(CatalogItem, 'ci')
          .where('ci."isAvailable" = :available')
          .getQuery();
        return 'catalog.id IN ' + subQb;
      })
      .setParameter('available', true);

    if (type) {
      qb.andWhere('catalog.catalogType = :type', { type });
    }

    if (search) {
      qb.andWhere(
        '(user."businessName" ILIKE :search OR user.name ILIKE :search OR user."businessDescription" ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    switch (sort) {
      case MerchantSortBy.POPULAR:
        qb.orderBy('catalog.viewCount', 'DESC');
        break;
      case MerchantSortBy.NAME:
        qb.orderBy('user.businessName', 'ASC');
        break;
      default:
        qb.orderBy('user.createdAt', 'DESC');
    }

    qb.addSelect('COALESCE(SUM(catalog.viewCount), 0)', 'totalViews')
      .addSelect('COUNT(DISTINCT catalog.id)', 'catalogCount')
      .addSelect('COUNT(DISTINCT catalog."catalogType")', 'typeCount')
      .addSelect('ARRAY_AGG(DISTINCT catalog."catalogType")', 'catalogTypesArr')
      .groupBy('user.id');

    const totalQb = this.userRepository
      .createQueryBuilder('user')
      .innerJoin(
        UserRole,
        'role',
        'role.userId = user.id AND role.role = :ownerRole',
        { ownerRole: RoleType.OWNER },
      )
      .innerJoin(
        Catalog,
        'catalog',
        'catalog.ownerId = user.id AND catalog.status = :active AND catalog.isPublic = :isPublic',
        { active: CatalogStatus.ACTIVE, isPublic: true },
      )
      .where((qb1) => {
        const subQb = qb1
          .subQuery()
          .select('ci."catalogId"')
          .from(CatalogItem, 'ci')
          .where('ci."isAvailable" = :available')
          .getQuery();
        return 'catalog.id IN ' + subQb;
      })
      .setParameter('available', true);

    if (type) totalQb.andWhere('catalog.catalogType = :type', { type });
    if (search) {
      totalQb.andWhere(
        '(user."businessName" ILIKE :search OR user.name ILIKE :search OR user."businessDescription" ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    const [total] = await totalQb
      .select('COUNT(DISTINCT user.id)')
      .getRawMany();
    const totalCount = parseInt(total?.count || '0', 10);

    qb.offset(skip).limit(limit);
    const rawResults = await qb.getRawMany();

    const data: MerchantListItem[] = await Promise.all(
      rawResults.map(async (row) => {
        const user = await this.userRepository.findOne({
          where: { id: row.user_id },
        });

        const catalogs = await this.catalogRepository.find({
          where: {
            ownerId: row.user_id,
            status: CatalogStatus.ACTIVE,
            isPublic: true,
          },
        });

        const allTags = [...new Set(catalogs.flatMap((c) => c.tags || []))];

        const totalViews = catalogs.reduce(
          (sum, c) => sum + (c.viewCount || 0),
          0,
        );

        const commerceCount = await this.commerceRepository.count({
          where: { ownerId: row.user_id, isActive: true },
        });

        return {
          id: row.user_id,
          slug: user?.slug || undefined,
          businessName: user?.businessName || user?.name,
          description: user?.businessDescription || undefined,
          photoURL: user?.photoURL || '',
          coverImageUrl: user?.coverImageUrl || undefined,
          catalogTypes: [],
          catalogCount: catalogs.length,
          totalItems: 0,
          commerceCount,
          tags: allTags,
          viewCount: totalViews,
          createdAt: user?.createdAt || new Date(),
        };
      }),
    );

    return {
      data,
      meta: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
      },
    };
  }

  async getMerchantBySlug(slug: string): Promise<MerchantDetail> {
    const isUUID =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        slug,
      );

    const commerce = isUUID
      ? await this.commerceRepository.findOne({
          where: { id: slug, isActive: true },
        })
      : await this.commerceRepository.findOne({
          where: { slug, isActive: true },
        });

    if (!commerce) {
      throw new NotFoundException(
        `Comercio con identificador "${slug}" no encontrado`,
      );
    }

    const catalogs = await this.catalogRepository.find({
      where: {
        commerceId: commerce.id,
        status: CatalogStatus.ACTIVE,
        isPublic: true,
      },
      order: { createdAt: 'DESC' },
    });

    let totalViews = 0;
    let totalItems = 0;
    const catalogDetails = await Promise.all(
      catalogs.map(async (catalog) => {
        totalViews += catalog.viewCount || 0;

        const items = await this.catalogItemRepository.find({
          where: {
            catalogId: catalog.id,
            isAvailable: true,
            status: CatalogItemStatus.AVAILABLE,
          },
          order: { displayOrder: 'ASC', name: 'ASC' },
        });

        totalItems += items.length;

        return {
          id: catalog.id,
          name: catalog.name || undefined,
          slug: catalog.slug || undefined,
          type: catalog.catalogType,
          description: catalog.description || undefined,
          coverImageUrl: catalog.coverImageUrl || undefined,
          tags: catalog.tags || [],
          itemCount: items.length,
          viewCount: catalog.viewCount || 0,
          items: items.map((item) => ({
            id: item.id,
            name: item.name,
            description: item.description || undefined,
            price: item.price,
            discountPrice: item.discountPrice || undefined,
            photoURL: item.photoURL || undefined,
            category: item.category || undefined,
            isAvailable: item.isAvailable,
          })),
        };
      }),
    );

    return {
      id: commerce.id,
      slug: commerce.slug || undefined,
      businessName: commerce.businessName,
      description: commerce.description || undefined,
      photoURL: commerce.logoUrl || undefined,
      coverImageUrl: commerce.coverImageUrl || undefined,
      contactInfo: {
        phone: commerce.phone || undefined,
      },
      catalogTypes: [],
      catalogs: catalogDetails,
      stats: {
        totalCatalogs: catalogs.length,
        totalItems,
        totalViews,
        memberSince: commerce.createdAt,
      },
      membership: {
        plan: 'free',
        features: [],
      },
    };
  }

  async getFeaturedMerchants(limit: number = 6): Promise<MerchantListItem[]> {
    const users = await this.userRepository.find({
      where: { isFeatured: true },
      take: limit,
    });

    if (users.length === 0) {
      const popularUsers = await this.userRepository
        .createQueryBuilder('user')
        .innerJoin(
          UserRole,
          'role',
          'role.userId = user.id AND role.role = :ownerRole',
          { ownerRole: RoleType.OWNER },
        )
        .innerJoin(
          Catalog,
          'catalog',
          'catalog.ownerId = user.id AND catalog.status = :active AND catalog.isPublic = :isPublic',
          { active: CatalogStatus.ACTIVE, isPublic: true },
        )
        .innerJoin(
          CatalogItem,
          'item',
          'item.catalogId = catalog.id AND item.isAvailable = :available',
          { available: true },
        )
        .select('user.id', 'id')
        .addSelect('COALESCE(SUM(catalog.viewCount), 0)', 'views')
        .groupBy('user.id')
        .orderBy('views', 'DESC')
        .limit(limit)
        .getRawMany();

      const userIds = popularUsers.map((r) => r.id);
      if (userIds.length === 0) return [];

      const popularData = await this.getMerchantsByIds(userIds);
      return popularData;
    }

    return this.getMerchantsByIds(users.map((u) => u.id));
  }

  private async getMerchantsByIds(ids: string[]): Promise<MerchantListItem[]> {
    const results: MerchantListItem[] = [];

    for (const id of ids) {
      const user = await this.userRepository.findOne({ where: { id } });
      if (!user) continue;

      const catalogs = await this.catalogRepository.find({
        where: { ownerId: id, status: CatalogStatus.ACTIVE, isPublic: true },
      });

      if (catalogs.length === 0) continue;

      const commerceCount = await this.commerceRepository.count({
        where: { ownerId: id, isActive: true },
      });

      const allTags = [...new Set(catalogs.flatMap((c) => c.tags || []))];
      const totalViews = catalogs.reduce(
        (sum, c) => sum + (c.viewCount || 0),
        0,
      );

      results.push({
        id: user.id,
        slug: user.slug || undefined,
        businessName: user.businessName || user.name,
        description: user.businessDescription || undefined,
        photoURL: user.photoURL,
        coverImageUrl: user.coverImageUrl || undefined,
        catalogTypes: [],
        catalogCount: catalogs.length,
        totalItems: 0,
        commerceCount,
        tags: allTags,
        viewCount: totalViews,
        createdAt: user.createdAt,
      });
    }

    return results;
  }

  async getCategories(): Promise<CategoryResponse[]> {
    const results = await this.catalogRepository
      .createQueryBuilder('catalog')
      .innerJoin(
        UserRole,
        'role',
        'role.userId = catalog.ownerId AND role.role = :ownerRole',
        { ownerRole: RoleType.OWNER },
      )
      .innerJoin(
        CatalogItem,
        'item',
        'item.catalogId = catalog.id AND item.isAvailable = :available',
        { available: true },
      )
      .where('catalog.status = :status', { status: CatalogStatus.ACTIVE })
      .andWhere('catalog.isPublic = :isPublic', { isPublic: true })
      .select('catalog.catalogType', 'type')
      .addSelect('COUNT(DISTINCT catalog.ownerId)', 'merchantCount')
      .addSelect('COUNT(DISTINCT catalog.id)', 'catalogCount')
      .groupBy('catalog.catalogType')
      .orderBy('"merchantCount"', 'DESC')
      .getRawMany();

    return results.map((r) => ({
      type: r.type,
      label: CATEGORY_LABELS[r.type] || r.type,
      icon: this.getCategoryIcon(r.type),
      merchantCount: parseInt(r.merchantCount, 10),
      catalogCount: parseInt(r.catalogCount, 10),
    }));
  }

  async getStats(): Promise<StatsResponse> {
    const [merchantResult] = await this.userRepository
      .createQueryBuilder('user')
      .innerJoin(
        UserRole,
        'role',
        'role.userId = user.id AND role.role = :ownerRole',
        { ownerRole: RoleType.OWNER },
      )
      .select('COUNT(DISTINCT user.id)', 'count')
      .getRawMany();
    const totalMerchants = parseInt(merchantResult?.count || '0', 10);

    const catalogResult = await this.catalogRepository
      .createQueryBuilder('catalog')
      .innerJoin(
        UserRole,
        'role',
        'role.userId = catalog.ownerId AND role.role = :ownerRole',
        { ownerRole: RoleType.OWNER },
      )
      .where('catalog.status = :status', { status: CatalogStatus.ACTIVE })
      .andWhere('catalog.isPublic = :isPublic', { isPublic: true })
      .select('COUNT(DISTINCT catalog.id)', 'count')
      .getRawOne();
    const totalCatalogs = parseInt(catalogResult?.count || '0', 10);

    const itemsResult = await this.catalogItemRepository
      .createQueryBuilder('item')
      .innerJoin('item.catalog', 'ct')
      .where('ct.status = :status', { status: CatalogStatus.ACTIVE })
      .andWhere('ct.isPublic = :isPublic', { isPublic: true })
      .andWhere('item.isAvailable = :available', { available: true })
      .select('COUNT(item.id)', 'count')
      .getRawOne();
    const totalItems = parseInt(itemsResult?.count || '0', 10);

    const orderResult = await this.orderRepository
      .createQueryBuilder('order')
      .select('COUNT(order.id)', 'count')
      .getRawOne();
    const totalOrders = parseInt(orderResult?.count || '0', 10);

    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

    const recentMerchantResult = await this.userRepository
      .createQueryBuilder('user')
      .innerJoin(
        UserRole,
        'role',
        'role.userId = user.id AND role.role = :ownerRole',
        { ownerRole: RoleType.OWNER },
      )
      .where('user.createdAt >= :date', { date: oneMonthAgo })
      .select('COUNT(DISTINCT user.id)', 'count')
      .getRawOne();
    const recentMerchants = parseInt(recentMerchantResult?.count || '0', 10);
    const merchantGrowth =
      totalMerchants > 0
        ? Math.round((recentMerchants / totalMerchants) * 100)
        : 0;

    const topCatResults = await this.catalogRepository
      .createQueryBuilder('catalog')
      .innerJoin(
        UserRole,
        'role',
        'role.userId = catalog.ownerId AND role.role = :ownerRole',
        { ownerRole: RoleType.OWNER },
      )
      .where('catalog.status = :status', { status: CatalogStatus.ACTIVE })
      .andWhere('catalog.isPublic = :isPublic', { isPublic: true })
      .select('catalog.catalogType', 'type')
      .addSelect('COUNT(DISTINCT catalog.ownerId)', 'merchants')
      .groupBy('catalog.catalogType')
      .orderBy('merchants', 'DESC')
      .limit(5)
      .getRawMany();

    const topCategories: TopCategory[] = topCatResults.map((r) => ({
      type: r.type,
      merchants: parseInt(r.merchants, 10),
    }));

    return {
      totalMerchants,
      totalCatalogs,
      totalItems,
      totalOrders,
      merchantGrowth,
      topCategories,
    };
  }

  async search(query: SearchQueryDto): Promise<SearchResult> {
    const { q = '', type, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const merchants = q
      ? await this.userRepository
          .createQueryBuilder('u')
          .innerJoin(
            UserRole,
            'role',
            'role.userId = u.id AND role.role = :ownerRole',
            { ownerRole: RoleType.OWNER },
          )
          .innerJoin(
            Catalog,
            'catalog',
            'catalog.ownerId = u.id AND catalog.status = :active AND catalog.isPublic = :isPublic',
            { active: CatalogStatus.ACTIVE, isPublic: true },
          )
          .where(
            '(u."businessName" ILIKE :search OR u.name ILIKE :search OR u."businessDescription" ILIKE :search)',
            { search: `%${q}%` },
          )
          .select('u.id', 'user_id')
          .distinct(true)
          .limit(5)
          .getRawMany()
      : [];

    let catalogsQuery = this.catalogRepository
      .createQueryBuilder('catalog')
      .leftJoinAndSelect('catalog.commerce', 'commerce')
      .where('catalog.status = :status', { status: CatalogStatus.ACTIVE })
      .andWhere('catalog.isPublic = :isPublic', { isPublic: true });

    if (q) {
      catalogsQuery = catalogsQuery.andWhere(
        '(catalog.name ILIKE :search OR catalog.description ILIKE :search)',
        { search: `%${q}%` },
      );
    }
    if (type) {
      catalogsQuery = catalogsQuery.andWhere('catalog.catalogType = :type', {
        type,
      });
    }
    const catalogs = await catalogsQuery
      .orderBy('catalog.viewCount', 'DESC')
      .skip(skip)
      .take(limit)
      .getMany();

    let itemsQuery = this.catalogItemRepository
      .createQueryBuilder('item')
      .innerJoinAndSelect('item.catalog', 'ct')
      .leftJoinAndSelect('ct.commerce', 'itemCommerce')
      .where('ct.status = :status', { status: CatalogStatus.ACTIVE })
      .andWhere('ct.isPublic = :isPublic', { isPublic: true })
      .andWhere('item.isAvailable = :available', { available: true });

    if (q) {
      itemsQuery = itemsQuery.andWhere(
        '(item.name ILIKE :search OR item.description ILIKE :search)',
        { search: `%${q}%` },
      );
    }
    if (type) {
      itemsQuery = itemsQuery.andWhere('ct.catalogType = :type', { type });
    }
    const items = await itemsQuery
      .orderBy('item.viewCount', 'DESC')
      .skip(skip)
      .take(limit)
      .getMany();

    const merchantIds = merchants.map((m) => m.user_id);
    const merchantUsers =
      merchantIds.length > 0
        ? await this.userRepository.findByIds(merchantIds)
        : [];

    const merchantList = await Promise.all(
      merchantUsers.map(async (u) => {
        const cat = await this.catalogRepository.find({
          where: {
            ownerId: u.id,
            status: CatalogStatus.ACTIVE,
            isPublic: true,
          },
        });
        return {
          id: u.id,
          slug: u.slug,
          businessName: u.businessName || u.name,
          photoURL: u.photoURL,
          catalogCount: cat.length,
        };
      }),
    );

    const total = catalogs.length + items.length + merchantList.length;

    return {
      merchants: merchantList,
      catalogs: catalogs.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        type: c.catalogType,
        description: c.description,
        coverImageUrl: c.coverImageUrl,
        owner: c.commerce
          ? {
              id: c.commerce.id,
              name: c.commerce.businessName,
              photoURL: c.commerce.logoUrl,
              slug: c.commerce.slug,
            }
          : undefined,
        itemCount: c.items?.length || 0,
      })),
      items: items.map((i) => ({
        id: i.id,
        name: i.name,
        description: i.description,
        price: i.price,
        discountPrice: i.discountPrice,
        photoURL: i.photoURL,
        catalogId: i.catalogId,
        catalogName: i.catalog?.name,
        catalogSlug: i.catalog?.slug,
        catalogType: i.catalog?.catalogType,
        ownerId: i.catalog?.ownerId,
      })),
      meta: { total, page, limit },
    };
  }

  async getTrending(
    period: string = '24h',
    limit: number = 10,
  ): Promise<{ merchants: MerchantListItem[]; catalogs: any[] }> {
    let dateFrom: Date;
    const now = new Date();

    switch (period) {
      case '7d':
        dateFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        dateFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        dateFrom = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    const trendingCatalogs = await this.catalogRepository
      .createQueryBuilder('catalog')
      .leftJoinAndSelect('catalog.commerce', 'commerce')
      .where('catalog.status = :status', { status: CatalogStatus.ACTIVE })
      .andWhere('catalog.isPublic = :isPublic', { isPublic: true })
      .andWhere('catalog.lastViewedAt >= :dateFrom', { dateFrom })
      .orderBy('catalog.viewCount', 'DESC')
      .limit(limit)
      .getMany();

    const ownerIds = [...new Set(trendingCatalogs.map((c) => c.ownerId))];
    const merchantList =
      ownerIds.length > 0 ? await this.getMerchantsByIds(ownerIds) : [];

    return {
      merchants: merchantList.slice(0, limit),
      catalogs: trendingCatalogs.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        type: c.catalogType,
        coverImageUrl: c.coverImageUrl,
        viewCount: c.viewCount,
        owner: c.commerce
          ? {
              id: c.commerce.id,
              name: c.commerce.businessName,
              photoURL: c.commerce.logoUrl,
              slug: c.commerce.slug,
            }
          : undefined,
      })),
    };
  }

  async getMerchantCatalogs(slug: string): Promise<any[]> {
    const isUUID =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        slug,
      );

    const commerce = isUUID
      ? await this.commerceRepository.findOne({
          where: { id: slug, isActive: true },
        })
      : await this.commerceRepository.findOne({
          where: { slug, isActive: true },
        });

    if (!commerce) {
      throw new NotFoundException(
        `Comercio con identificador "${slug}" no encontrado`,
      );
    }

    const catalogs = await this.catalogRepository.find({
      where: {
        commerceId: commerce.id,
        status: CatalogStatus.ACTIVE,
        isPublic: true,
      },
      relations: ['commerce'],
      order: { createdAt: 'DESC' },
    });

    return Promise.all(
      catalogs.map(async (catalog) => {
        const items = await this.catalogItemRepository.find({
          where: {
            catalogId: catalog.id,
            isAvailable: true,
            status: CatalogItemStatus.AVAILABLE,
          },
          order: { displayOrder: 'ASC' },
        });

        return {
          id: catalog.id,
          name: catalog.name || undefined,
          slug: catalog.slug || undefined,
          type: catalog.catalogType,
          description: catalog.description || undefined,
          coverImageUrl: catalog.coverImageUrl || undefined,
          tags: catalog.tags || [],
          itemCount: items.length,
          viewCount: catalog.viewCount || 0,
          owner: catalog.commerce
            ? {
                id: catalog.commerce.id,
                name: catalog.commerce.businessName,
                photoURL: catalog.commerce.logoUrl,
                slug: catalog.commerce.slug,
              }
            : null,
          items: items.map((item) => ({
            id: item.id,
            name: item.name,
            price: item.price,
            discountPrice: item.discountPrice || undefined,
            photoURL: item.photoURL || undefined,
            category: item.category || undefined,
            isAvailable: item.isAvailable,
          })),
        };
      }),
    );
  }

  private getCategoryIcon(type: string): string {
    const icons: Record<string, string> = {
      [CatalogType.MENU]: 'restaurant',
      [CatalogType.WARDROBE]: 'clothes',
      [CatalogType.PRODUCT_LIST]: 'package',
      [CatalogType.SERVICE_LIST]: 'settings',
      [CatalogType.MARKETPLACE]: 'shopping-cart',
    };
    return icons[type] || 'folder';
  }
}
