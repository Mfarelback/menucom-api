import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
} from '@nestjs/swagger';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../auth/guards/jwt.auth.gards';
import { CommerceService } from '../services/commerce.service';
import { ActivityLogService } from '../services/activity-log.service';
import { CloudinaryService } from '../../cloudinary/services/cloudinary.service';
import { CreateCommerceDto } from '../dto/create-commerce.dto';
import { UpdateCommerceDto } from '../dto/update-commerce.dto';

@ApiTags('Commerce')
@Controller('commerce')
export class CommerceController {
  constructor(
    private readonly commerceService: CommerceService,
    private readonly cloudinaryService: CloudinaryService,
    private readonly activityLogService: ActivityLogService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'logo', maxCount: 1 },
      { name: 'coverImage', maxCount: 1 },
    ]),
  )
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Crear un nuevo comercio' })
  @ApiResponse({ status: 201, description: 'Comercio creado exitosamente' })
  @ApiResponse({ status: 409, description: 'Slug ya existe' })
  async create(
    @Request() req,
    @Body() dto: CreateCommerceDto,
    @UploadedFiles()
    files: { logo?: Express.Multer.File[]; coverImage?: Express.Multer.File[] },
  ) {
    if (files?.logo?.[0]) {
      const url = await this.cloudinaryService.uploadImage(files.logo[0]);
      if (typeof url === 'string') dto.logoUrl = url;
    }
    if (files?.coverImage?.[0]) {
      const url = await this.cloudinaryService.uploadImage(files.coverImage[0]);
      if (typeof url === 'string') dto.coverImageUrl = url;
    }
    const isAdmin = req.user.role === 'admin';
    return this.commerceService.create(req.user.userId, dto, isAdmin);
  }

  @Get('my')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar comercios donde tengo acceso' })
  @ApiResponse({ status: 200, description: 'Lista de comercios' })
  async getMyCommerces(@Request() req) {
    const contexts = await this.commerceService.getUserContexts(
      req.user.userId,
    );
    return contexts.map(({ commerce: c, role }) => ({
      id: c.id,
      businessName: c.businessName,
      slug: c.slug,
      context: c.context,
      businessType: c.businessType,
      role,
      logoUrl: c.logoUrl,
      coverImageUrl: c.coverImageUrl,
      isActive: c.isActive,
    }));
  }

  @Get(':commerceId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener comercio por ID' })
  @ApiResponse({ status: 200, description: 'Comercio encontrado' })
  @ApiResponse({ status: 404, description: 'Comercio no encontrado' })
  async getById(@Param('commerceId') id: string) {
    return this.commerceService.findById(id);
  }

  @Put(':commerceId')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'logo', maxCount: 1 },
      { name: 'coverImage', maxCount: 1 },
    ]),
  )
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Actualizar comercio' })
  @ApiResponse({ status: 200, description: 'Comercio actualizado' })
  @ApiResponse({ status: 400, description: 'Sin contexto activo' })
  @ApiResponse({ status: 403, description: 'No puedes editar otro comercio' })
  @ApiResponse({ status: 404, description: 'Comercio no encontrado' })
  async update(
    @Request() req,
    @Param('commerceId') id: string,
    @Body() dto: UpdateCommerceDto,
    @UploadedFiles()
    files: { logo?: Express.Multer.File[]; coverImage?: Express.Multer.File[] },
  ) {
    const isAdmin = req.user.role === 'admin';

    if (!isAdmin) {
      if (!req.user.commerceId) {
        throw new BadRequestException('No hay un comercio activo en tu sesión');
      }
      if (id !== req.user.commerceId) {
        throw new ForbiddenException(
          'Solo puedes editar el comercio en el que estás logueado',
        );
      }
    }

    const targetCommerceId = isAdmin ? id : req.user.commerceId;

    if (files?.logo?.[0]) {
      const url = await this.cloudinaryService.uploadImage(files.logo[0]);
      if (typeof url === 'string') dto.logoUrl = url;
    }
    if (files?.coverImage?.[0]) {
      const url = await this.cloudinaryService.uploadImage(files.coverImage[0]);
      if (typeof url === 'string') dto.coverImageUrl = url;
    }
    return this.commerceService.update(
      targetCommerceId,
      req.user.userId,
      dto,
      isAdmin,
    );
  }

  @Delete(':commerceId')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 3, ttl: 300000 } })
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Desactivar comercio (soft delete)' })
  @ApiResponse({ status: 200, description: 'Comercio desactivado' })
  @ApiResponse({ status: 400, description: 'Sin contexto activo' })
  @ApiResponse({
    status: 403,
    description: 'No puedes desactivar otro comercio',
  })
  async deactivate(@Request() req, @Param('commerceId') id: string) {
    const isAdmin = req.user.role === 'admin';

    if (!isAdmin) {
      if (!req.user.commerceId) {
        throw new BadRequestException('No hay un comercio activo en tu sesión');
      }
      if (id !== req.user.commerceId) {
        throw new ForbiddenException(
          'Solo puedes desactivar el comercio en el que estás logueado',
        );
      }
    }

    const targetCommerceId = isAdmin ? id : req.user.commerceId;
    await this.commerceService.deactivate(
      targetCommerceId,
      req.user.userId,
      isAdmin,
    );
    return { message: 'Comercio desactivado exitosamente' };
  }

  @Get(':commerceId/activity')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener historial de actividad del comercio' })
  @ApiResponse({ status: 200, description: 'Lista de actividad' })
  async getActivity(@Request() req, @Param('commerceId') id: string) {
    const isAdmin = req.user.role === 'admin';
    const userId = req.user.userId;

    if (!isAdmin) {
      const hasAccess = await this.commerceService[
        'userRoleService'
      ].hasAccessToCommerce(userId, id);
      const commerce = await this.commerceService.findById(id);
      const isOwner = commerce.ownerId === userId;
      if (!hasAccess && !isOwner) {
        throw new ForbiddenException(
          'No tienes acceso a la actividad de este comercio',
        );
      }
    }

    return this.activityLogService.getActivity(id, 50);
  }
}
