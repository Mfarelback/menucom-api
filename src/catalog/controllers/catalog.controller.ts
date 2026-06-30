import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../auth/guards/jwt.auth.gards';
import { CatalogService } from '../services/catalog.service';
import { CloudinaryService } from '../../cloudinary/services/cloudinary.service';
import { CreateCatalogDto, UpdateCatalogDto } from '../dto/catalog.dto';
import {
  CreateCatalogItemDto,
  UpdateCatalogItemDto,
} from '../dto/catalog-item.dto';
import { CatalogType } from '../enums/catalog-type.enum';
import { AuthenticatedRequest } from '../../auth/types/request.types';

@ApiTags('Catalogs')
@Controller('catalogs')
export class CatalogController {
  constructor(
    private readonly catalogService: CatalogService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  /**
   * Crear un nuevo catálogo
   */
  @Post()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('coverImage'))
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Crear un nuevo catálogo',
    description:
      'La capacidad del catálogo se determina automáticamente según tu plan de membresía: FREE=10, PREMIUM=500, ENTERPRISE=unlimited',
  })
  @ApiResponse({ status: 201, description: 'Catálogo creado exitosamente' })
  @ApiBody({
    description: 'Datos del catálogo con imagen opcional',
    schema: {
      type: 'object',
      properties: {
        catalogType: {
          type: 'string',
          enum: ['MENU', 'RESTAURANT', 'WARDROBE'],
        },
        name: { type: 'string' },
        description: { type: 'string' },
        isPublic: { type: 'boolean' },
        metadata: { type: 'string', description: 'JSON string' },
        settings: { type: 'string', description: 'JSON string' },
        tags: { type: 'string', description: 'Comma-separated tags' },
        coverImage: {
          type: 'string',
          format: 'binary',
          description: 'Imagen de portada',
        },
      },
      required: ['catalogType', 'name'],
    },
  })
  async createCatalog(
    @Request() req: AuthenticatedRequest,
    @Body() createCatalogDto: CreateCatalogDto,
    @UploadedFile() coverImage?: Express.Multer.File,
  ) {
    const ownerId = req.user.userId;
    const commerceId = req.tenantId;

    if (coverImage) {
      const uploadResult = await this.cloudinaryService.uploadImage(coverImage);
      if (typeof uploadResult === 'string') {
        createCatalogDto.coverImageUrl = uploadResult;
      }
    }

    if (typeof createCatalogDto.metadata === 'string') {
      try {
        createCatalogDto.metadata = JSON.parse(createCatalogDto.metadata);
      } catch (error) {
        createCatalogDto.metadata = {};
      }
    }

    if (typeof createCatalogDto.settings === 'string') {
      try {
        createCatalogDto.settings = JSON.parse(createCatalogDto.settings);
      } catch (error) {
        createCatalogDto.settings = {};
      }
    }

    if (typeof createCatalogDto.tags === 'string') {
      const tagsString = createCatalogDto.tags as any;
      createCatalogDto.tags = tagsString
        .split(',')
        .map((tag: string) => tag.trim())
        .filter((tag: string) => tag.length > 0);
    }

    return await this.catalogService.createCatalog(
      ownerId,
      createCatalogDto,
      commerceId,
    );
  }

  /**
   * Obtener todos los catálogos del usuario autenticado
   * Agrupados en linked (vinculados a comercio) y unlinked (sin comercio)
   */
  @Get('my-catalogs')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener mis catálogos' })
  @ApiResponse({
    status: 200,
    description: 'Lista de catálogos agrupados por vinculación',
  })
  async getMyCatalogs(
    @Request() req: AuthenticatedRequest,
    @Query('type') type?: string,
  ) {
    const ownerId = req.user.userId;
    const commerceId = req.tenantId;

    const catalogType = this.validateCatalogType(type);

    if (commerceId) {
      return await this.catalogService.getMyCatalogsGrouped(
        ownerId,
        commerceId,
        catalogType,
      );
    }

    const catalogs = await this.catalogService.getCatalogsByOwner(
      ownerId,
      catalogType,
    );
    return { linked: [], unlinked: catalogs };
  }

  private validateCatalogType(raw?: string): CatalogType | undefined {
    if (!raw) return undefined;

    const validCatalogTypes = Object.values(CatalogType) as string[];
    if (validCatalogTypes.includes(raw)) return raw as CatalogType;

    return undefined;
  }

  /**
   * Obtener un catálogo por ID
   */
  @Get(':catalogId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener catálogo por ID' })
  @ApiResponse({ status: 200, description: 'Catálogo encontrado' })
  @ApiResponse({ status: 404, description: 'Catálogo no encontrado' })
  async getCatalogById(
    @Request() req: AuthenticatedRequest,
    @Param('catalogId') catalogId: string,
  ) {
    const ownerId = req.user.userId;
    const commerceId = req.tenantId;
    return await this.catalogService.getCatalogById(
      catalogId,
      ownerId,
      true,
      commerceId,
    );
  }

  /**
   * Actualizar un catálogo
   */
  @Put(':catalogId')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('coverImage'))
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Actualizar catálogo' })
  @ApiResponse({ status: 200, description: 'Catálogo actualizado' })
  @ApiResponse({ status: 404, description: 'Catálogo no encontrado' })
  @ApiBody({
    description: 'Datos del catálogo a actualizar con imagen opcional',
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
        status: { type: 'string', enum: ['ACTIVE', 'ARCHIVED', 'DRAFT'] },
        slug: { type: 'string' },
        isPublic: { type: 'boolean' },
        metadata: { type: 'string', description: 'JSON string' },
        settings: { type: 'string', description: 'JSON string' },
        tags: { type: 'string', description: 'Comma-separated tags' },
        coverImage: {
          type: 'string',
          format: 'binary',
          description: 'Nueva imagen de portada (opcional)',
        },
      },
    },
  })
  async updateCatalog(
    @Request() req: AuthenticatedRequest,
    @Param('catalogId') catalogId: string,
    @Body() updateCatalogDto: UpdateCatalogDto,
    @UploadedFile() coverImage?: Express.Multer.File,
  ) {
    const ownerId = req.user.userId;
    const commerceId = req.tenantId;

    if (coverImage) {
      const uploadResult = await this.cloudinaryService.uploadImage(coverImage);
      if (typeof uploadResult === 'string') {
        updateCatalogDto.coverImageUrl = uploadResult;
      }
    }

    return await this.catalogService.updateCatalog(
      catalogId,
      ownerId,
      updateCatalogDto,
      commerceId,
    );
  }

  /**
   * Eliminar un catálogo
   */
  @Delete(':catalogId')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 300000 } })
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Eliminar catálogo' })
  @ApiResponse({ status: 200, description: 'Catálogo eliminado' })
  @ApiResponse({ status: 404, description: 'Catálogo no encontrado' })
  async deleteCatalog(
    @Request() req: AuthenticatedRequest,
    @Param('catalogId') catalogId: string,
  ) {
    const ownerId = req.user.userId;
    const commerceId = req.tenantId;
    return await this.catalogService.deleteCatalog(
      catalogId,
      ownerId,
      commerceId,
    );
  }

  /**
   * Archivar un catálogo (soft delete)
   */
  @Put(':catalogId/archive')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Archivar catálogo' })
  @ApiResponse({ status: 200, description: 'Catálogo archivado' })
  async archiveCatalog(
    @Request() req: AuthenticatedRequest,
    @Param('catalogId') catalogId: string,
  ) {
    const ownerId = req.user.userId;
    const commerceId = req.tenantId;
    return await this.catalogService.archiveCatalog(
      catalogId,
      ownerId,
      commerceId,
    );
  }

  /**
   * Vincular catálogo sin comercio al comercio actual
   */
  @Post(':catalogId/assign-to-commerce')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Vincular catálogo a comercio' })
  @ApiResponse({ status: 200, description: 'Catálogo vinculado exitosamente' })
  @ApiResponse({
    status: 400,
    description: 'Catálogo ya vinculado o sin contexto de comercio',
  })
  @ApiResponse({ status: 404, description: 'Catálogo no encontrado' })
  async assignToCommerce(
    @Request() req: AuthenticatedRequest,
    @Param('catalogId') catalogId: string,
  ) {
    const ownerId = req.user.userId;
    const commerceId = req.tenantId;

    if (!commerceId) {
      throw new BadRequestException(
        'No se encontró un comercio para vincular el catálogo',
      );
    }

    return await this.catalogService.assignCatalogToCommerce(
      catalogId,
      ownerId,
      commerceId,
    );
  }

  /**
   * Agregar un item al catálogo
   */
  @Post(':catalogId/items')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('photo'))
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Agregar item al catálogo' })
  @ApiResponse({ status: 201, description: 'Item creado' })
  @ApiBody({
    description: 'Datos del item con imagen opcional',
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
        price: { type: 'number' },
        discountPrice: { type: 'number' },
        status: {
          type: 'string',
          enum: ['ACTIVE', 'INACTIVE', 'OUT_OF_STOCK'],
        },
        isAvailable: { type: 'boolean' },
        attributes: { type: 'string', description: 'JSON string' },
        photo: {
          type: 'string',
          format: 'binary',
          description: 'Imagen del item',
        },
      },
      required: ['name'],
    },
  })
  async addItem(
    @Request() req: AuthenticatedRequest,
    @Param('catalogId') catalogId: string,
    @Body() createItemDto: CreateCatalogItemDto,
    @UploadedFile() photo?: Express.Multer.File,
  ) {
    const ownerId = req.user.userId;
    const commerceId = req.tenantId;

    if (photo) {
      const uploadResult = await this.cloudinaryService.uploadImage(photo);
      if (typeof uploadResult === 'string') {
        createItemDto.photoURL = uploadResult;
      }
    }

    createItemDto.catalogId = catalogId;
    return await this.catalogService.addItem(
      ownerId,
      createItemDto,
      commerceId,
    );
  }

  /**
   * Obtener un item por ID
   */
  @Get(':catalogId/items/:itemId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener item por ID' })
  @ApiResponse({ status: 200, description: 'Item encontrado' })
  async getItem(
    @Request() req: AuthenticatedRequest,
    @Param('catalogId') catalogId: string,
    @Param('itemId') itemId: string,
  ) {
    return await this.catalogService.getItemById(itemId);
  }

  /**
   * Actualizar un item
   */
  @Put(':catalogId/items/:itemId')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('photo'))
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Actualizar item' })
  @ApiResponse({ status: 200, description: 'Item actualizado' })
  @ApiBody({
    description: 'Datos del item a actualizar con imagen opcional',
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
        price: { type: 'number' },
        discountPrice: { type: 'number' },
        status: {
          type: 'string',
          enum: ['ACTIVE', 'INACTIVE', 'OUT_OF_STOCK'],
        },
        isAvailable: { type: 'boolean' },
        attributes: { type: 'string', description: 'JSON string' },
        photo: {
          type: 'string',
          format: 'binary',
          description: 'Nueva imagen del item (opcional)',
        },
      },
    },
  })
  async updateItem(
    @Request() req: AuthenticatedRequest,
    @Param('catalogId') catalogId: string,
    @Param('itemId') itemId: string,
    @Body() updateItemDto: UpdateCatalogItemDto,
    @UploadedFile() photo?: Express.Multer.File,
  ) {
    const ownerId = req.user.userId;
    const commerceId = req.tenantId;

    if (photo) {
      const uploadResult = await this.cloudinaryService.uploadImage(photo);
      if (typeof uploadResult === 'string') {
        updateItemDto.photoURL = uploadResult;
      }
    }

    if (typeof updateItemDto.attributes === 'string') {
      try {
        updateItemDto.attributes = JSON.parse(updateItemDto.attributes);
      } catch (error) {
        delete updateItemDto.attributes;
      }
    }

    return await this.catalogService.updateItem(
      itemId,
      ownerId,
      updateItemDto,
      commerceId,
    );
  }

  /**
   * Eliminar un item
   */
  @Delete(':catalogId/items/:itemId')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 300000 } })
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Eliminar item' })
  @ApiResponse({ status: 200, description: 'Item eliminado' })
  async deleteItem(
    @Request() req: AuthenticatedRequest,
    @Param('catalogId') catalogId: string,
    @Param('itemId') itemId: string,
  ) {
    const ownerId = req.user.userId;
    const commerceId = req.tenantId;
    return await this.catalogService.deleteItem(itemId, ownerId, commerceId);
  }

  /**
   * Buscar catálogos públicos
   */
  @Get('public/search')
  @ApiOperation({ summary: 'Buscar catálogos públicos' })
  @ApiResponse({ status: 200, description: 'Resultados de búsqueda' })
  async searchPublic(
    @Query('type') typeStr?: string,
    @Query('tags') tags?: string,
  ) {
    const type = typeStr ? (typeStr as CatalogType) : undefined;
    const tagsArray = tags ? tags.split(',') : undefined;
    return await this.catalogService.searchPublicCatalogs(type, tagsArray, 20);
  }

  /**
   * Obtener catálogo público por ID
   */
  @Get('public/id/:catalogId')
  @ApiOperation({ summary: 'Obtener catálogo público por ID' })
  @ApiResponse({ status: 200, description: 'Catálogo encontrado' })
  @ApiResponse({ status: 404, description: 'Catálogo no encontrado' })
  async getPublicCatalogById(@Param('catalogId') catalogId: string) {
    return await this.catalogService.getPublicCatalogById(catalogId);
  }

  /**
   * Obtener catálogos públicos de un comercio por slug o UUID
   */
  @Get('public/commerce/:identifier')
  @ApiOperation({ summary: 'Obtener catálogos públicos de un comercio' })
  @ApiResponse({ status: 200, description: 'Catálogos encontrados' })
  @ApiResponse({ status: 404, description: 'No se encontraron catálogos' })
  async getPublicCatalogsByCommerce(@Param('identifier') identifier: string) {
    return await this.catalogService.getPublicCatalogsByCommerce(identifier);
  }

  /**
   * Obtener datos OG (Open Graph) para social preview de un comercio
   */
  @Get('public/commerce/:identifier/og')
  @ApiOperation({
    summary: 'Obtener datos OG para social preview de un comercio',
  })
  @ApiResponse({ status: 200, description: 'Datos OG encontrados' })
  async getCommerceOGData(@Param('identifier') identifier: string) {
    return await this.catalogService.getCommerceOGData(identifier);
  }

  /**
   * Obtener PWA Web App Manifest para un comercio
   */
  @Get('public/commerce/:identifier/manifest')
  @ApiOperation({ summary: 'Obtener PWA Manifest de un comercio' })
  @ApiResponse({ status: 200, description: 'Manifest generado' })
  async getCommerceManifest(@Param('identifier') identifier: string) {
    return await this.catalogService.getCommerceManifest(identifier);
  }

  /**
   * Obtener catálogo público por slug
   */
  @Get('public/:slug')
  @ApiOperation({ summary: 'Obtener catálogo público por slug' })
  @ApiResponse({ status: 200, description: 'Catálogo encontrado' })
  @ApiResponse({ status: 404, description: 'Catálogo no encontrado' })
  async getPublicCatalog(@Param('slug') slug: string) {
    return await this.catalogService.getCatalogBySlug(slug);
  }

  /**
   * Obtener catálogos públicos por ownerId (sin autenticación)
   * @deprecated Usar getPublicCatalogsByCommerce en su lugar
   */
  @Get('public/owner/:ownerId')
  @ApiOperation({
    summary: 'Obtener catálogos públicos por ownerId sin autenticación',
  })
  @ApiResponse({ status: 200, description: 'Catálogos encontrados' })
  @ApiResponse({ status: 404, description: 'No se encontraron catálogos' })
  async getPublicCatalogsByOwnerId(@Param('ownerId') ownerId: string) {
    return await this.catalogService.getPublicCatalogsByOwnerId(ownerId);
  }
}
