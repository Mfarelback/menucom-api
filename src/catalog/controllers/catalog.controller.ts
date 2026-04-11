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
import { JwtAuthGuard } from '../../auth/guards/jwt.auth.gards';
import { CatalogService } from '../services/catalog.service';
import { CloudinaryService } from '../../cloudinary/services/cloudinary.service';
import { CreateCatalogDto, UpdateCatalogDto } from '../dto/catalog.dto';
import {
  CreateCatalogItemDto,
  UpdateCatalogItemDto,
} from '../dto/catalog-item.dto';
import { CatalogType } from '../enums/catalog-type.enum';

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
        catalogType: { type: 'string', enum: ['MENU', 'WARDROBE'] },
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
    @Request() req,
    @Body() createCatalogDto: CreateCatalogDto,
    @UploadedFile() coverImage?: Express.Multer.File,
  ) {
    const ownerId = req.user.userId;

    // Si hay imagen, subirla a Cloudinary
    if (coverImage) {
      const uploadResult = await this.cloudinaryService.uploadImage(coverImage);
      if (typeof uploadResult === 'string') {
        createCatalogDto.coverImageUrl = uploadResult;
      }
    }

    // Parsear campos JSON si vienen como strings
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

    // Parsear tags si vienen como string separado por comas
    if (typeof createCatalogDto.tags === 'string') {
      const tagsString = createCatalogDto.tags as any;
      createCatalogDto.tags = tagsString
        .split(',')
        .map((tag: string) => tag.trim())
        .filter((tag: string) => tag.length > 0);
    }

    return await this.catalogService.createCatalog(ownerId, createCatalogDto);
  }

  /**
   * Obtener todos los catálogos del usuario autenticado
   */
  @Get('my-catalogs')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener mis catálogos' })
  @ApiResponse({ status: 200, description: 'Lista de catálogos' })
  async getMyCatalogs(@Request() req, @Query('type') type?: CatalogType) {
    const ownerId = req.user.userId;
    return await this.catalogService.getCatalogsByOwner(ownerId, type);
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
  async getCatalogById(@Request() req, @Param('catalogId') catalogId: string) {
    const ownerId = req.user.userId;
    return await this.catalogService.getCatalogById(catalogId, ownerId);
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
    @Request() req,
    @Param('catalogId') catalogId: string,
    @Body() updateCatalogDto: UpdateCatalogDto,
    @UploadedFile() coverImage?: Express.Multer.File,
  ) {
    const ownerId = req.user.userId;

    // Si hay nueva imagen, subirla a Cloudinary
    if (coverImage) {
      const uploadResult = await this.cloudinaryService.uploadImage(coverImage);
      if (typeof uploadResult === 'string') {
        updateCatalogDto.coverImageUrl = uploadResult;
      }
    }

    // Las transformaciones ahora se manejan automáticamente en el DTO
    // No necesitamos parsing manual aquí

    return await this.catalogService.updateCatalog(
      catalogId,
      ownerId,
      updateCatalogDto,
    );
  }

  /**
   * Eliminar un catálogo
   */
  @Delete(':catalogId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Eliminar catálogo' })
  @ApiResponse({ status: 200, description: 'Catálogo eliminado' })
  @ApiResponse({ status: 404, description: 'Catálogo no encontrado' })
  async deleteCatalog(@Request() req, @Param('catalogId') catalogId: string) {
    const ownerId = req.user.userId;
    return await this.catalogService.deleteCatalog(catalogId, ownerId);
  }

  /**
   * Archivar un catálogo (soft delete)
   */
  @Put(':catalogId/archive')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Archivar catálogo' })
  @ApiResponse({ status: 200, description: 'Catálogo archivado' })
  async archiveCatalog(@Request() req, @Param('catalogId') catalogId: string) {
    const ownerId = req.user.userId;
    return await this.catalogService.archiveCatalog(catalogId, ownerId);
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
    @Request() req,
    @Param('catalogId') catalogId: string,
    @Body() createItemDto: CreateCatalogItemDto,
    @UploadedFile() photo?: Express.Multer.File,
  ) {
    const ownerId = req.user.userId;

    // Si hay imagen, subirla a Cloudinary
    if (photo) {
      const uploadResult = await this.cloudinaryService.uploadImage(photo);
      if (typeof uploadResult === 'string') {
        createItemDto.photoURL = uploadResult;
      }
    }

    // Las transformaciones se manejan automáticamente en el DTO
    // Aseguramos que el catalogId del DTO coincida con el parámetro
    createItemDto.catalogId = catalogId;
    return await this.catalogService.addItem(ownerId, createItemDto);
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
    @Request() req,
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
    @Request() req,
    @Param('catalogId') catalogId: string,
    @Param('itemId') itemId: string,
    @Body() updateItemDto: UpdateCatalogItemDto,
    @UploadedFile() photo?: Express.Multer.File,
  ) {
    const ownerId = req.user.userId;

    // Si hay nueva imagen, subirla a Cloudinary
    if (photo) {
      const uploadResult = await this.cloudinaryService.uploadImage(photo);
      if (typeof uploadResult === 'string') {
        updateItemDto.photoURL = uploadResult;
      }
    }

    // Parsear atributos si vienen como string
    if (typeof updateItemDto.attributes === 'string') {
      try {
        updateItemDto.attributes = JSON.parse(updateItemDto.attributes);
      } catch (error) {
        // Si hay error en el parsing, no modificar los atributos
        delete updateItemDto.attributes;
      }
    }

    return await this.catalogService.updateItem(itemId, ownerId, updateItemDto);
  }

  /**
   * Eliminar un item
   */
  @Delete(':catalogId/items/:itemId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Eliminar item' })
  @ApiResponse({ status: 200, description: 'Item eliminado' })
  async deleteItem(
    @Request() req,
    @Param('catalogId') catalogId: string,
    @Param('itemId') itemId: string,
  ) {
    const ownerId = req.user.userId;
    return await this.catalogService.deleteItem(itemId, ownerId);
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
   * Obtener catálogo público por slug
   */
  @Get('public/:slug')
  @ApiOperation({ summary: 'Obtener catálogo público por slug' })
  @ApiResponse({ status: 200, description: 'Catálogo encontrado' })
  @ApiResponse({ status: 404, description: 'Catálogo no encontrado' })
  async getPublicCatalog(@Param('slug') slug: string) {
    return await this.catalogService.getPublicCatalog(slug);
  }
}
