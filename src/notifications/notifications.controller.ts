import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt.auth.gards';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { Request } from 'express';
import { CanManageUsers } from '../auth/decorators/role-helpers.decorator';
import { CreateNotificationTemplateDto } from './dto/create-notification-template.dto';
import { UpdateNotificationTemplateDto } from './dto/update-notification-template.dto';
import { SendAdminNotificationDto } from './dto/send-admin-notification.dto';
import { SendFromTemplateDto } from './dto/send-from-template.dto';
import { QueryTemplatesDto } from './dto/query-templates.dto';
import { QueryUsersWithTokensDto } from './dto/query-users-with-tokens.dto';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  private readonly logger = new Logger(NotificationsController.name);

  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('test')
  @ApiOperation({
    summary: 'Enviar una notificación de prueba al usuario actual',
    description:
      'Envía una notificación push de prueba al token FCM registrado para el usuario autenticado.',
  })
  @ApiResponse({
    status: 200,
    description: 'Notificación enviada exitosamente.',
  })
  @ApiResponse({
    status: 400,
    description: 'El usuario no tiene un token FCM registrado.',
  })
  async sendTestNotification(@Req() req: Request) {
    const userId = req['user']['userId'];
    this.logger.log(
      `Iniciando envío de notificación de prueba para el usuario ${userId}`,
    );

    const success = await this.notificationsService.sendNotificationToUser(
      userId,
      'Prueba de Notificación 🔔',
      '¡Hola! Esta es una notificación de prueba desde el backend de MenuCom.',
      {
        type: 'test',
        timestamp: new Date().toISOString(),
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
      },
    );

    if (!success) {
      throw new BadRequestException(
        'No se pudo enviar la notificación. Asegúrate de haber registrado tu token FCM primero usando PATCH /user/fcm-token',
      );
    }

    return {
      success: true,
      message: 'Notificación de prueba enviada exitosamente al dispositivo.',
      timestamp: new Date().toISOString(),
    };
  }

  // ============================================================
  //  Admin: Templates CRUD
  // ============================================================

  @Post('admin/templates')
  @CanManageUsers()
  @ApiOperation({ summary: 'Crear template de notificación (Admin)' })
  @ApiResponse({ status: 201, description: 'Template creado exitosamente.' })
  @ApiResponse({
    status: 409,
    description: 'Ya existe un template con ese name.',
  })
  async createTemplate(@Body() dto: CreateNotificationTemplateDto) {
    return this.notificationsService.createTemplate(dto);
  }

  @Get('admin/templates')
  @CanManageUsers()
  @ApiOperation({ summary: 'Listar templates (paginado, con filtros) (Admin)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    enum: ['name', 'createdAt', 'updatedAt'],
  })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['ASC', 'DESC'] })
  async listTemplates(@Query() query: QueryTemplatesDto) {
    return this.notificationsService.listTemplates({
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      search: query.search,
      isActive: query.isActive,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    });
  }

  @Get('admin/templates/:id')
  @CanManageUsers()
  @ApiOperation({ summary: 'Obtener un template por ID (Admin)' })
  @ApiResponse({ status: 404, description: 'Template no encontrado.' })
  async getTemplate(@Param('id') id: string) {
    return this.notificationsService.getTemplate(id);
  }

  @Patch('admin/templates/:id')
  @CanManageUsers()
  @ApiOperation({ summary: 'Actualizar template (Admin)' })
  @ApiResponse({ status: 404, description: 'Template no encontrado.' })
  @ApiResponse({ status: 409, description: 'name duplicado.' })
  async updateTemplate(
    @Param('id') id: string,
    @Body() dto: UpdateNotificationTemplateDto,
  ) {
    return this.notificationsService.updateTemplate(id, dto);
  }

  @Delete('admin/templates/:id')
  @CanManageUsers()
  @ApiOperation({
    summary: 'Soft-delete de template (set isActive=false) (Admin)',
  })
  @ApiResponse({ status: 404, description: 'Template no encontrado.' })
  async deleteTemplate(@Param('id') id: string) {
    return this.notificationsService.deleteTemplate(id);
  }

  // ============================================================
  //  Admin: Envío de notificaciones
  // ============================================================

  @Get('admin/users-with-tokens')
  @CanManageUsers()
  @ApiOperation({
    summary: 'Lista usuarios con FCM token (paginado, con búsqueda) (Admin)',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  async getUsersWithTokens(@Query() query: QueryUsersWithTokensDto) {
    return this.notificationsService.getUsersWithTokens(
      query.page ?? 1,
      query.limit ?? 20,
      query.search,
    );
  }

  @Post('admin/send')
  @CanManageUsers()
  @ApiOperation({ summary: 'Notificación personalizada directa (Admin)' })
  @ApiResponse({ status: 200, description: 'Resultado del envío.' })
  @ApiResponse({
    status: 503,
    description: 'Servicio de notificaciones no disponible.',
  })
  async sendDirectNotification(@Body() dto: SendAdminNotificationDto) {
    return this.notificationsService.sendDirectNotification(dto);
  }

  @Post('admin/send-from-template/:templateId')
  @CanManageUsers()
  @ApiOperation({
    summary: 'Notificación desde template con parámetros (Admin)',
  })
  @ApiResponse({ status: 200, description: 'Resultado del envío resuelto.' })
  @ApiResponse({ status: 404, description: 'Template no encontrado.' })
  @ApiResponse({
    status: 400,
    description: 'Template inactivo o params vacío.',
  })
  async sendFromTemplate(
    @Param('templateId') templateId: string,
    @Body() dto: SendFromTemplateDto,
  ) {
    return this.notificationsService.sendFromTemplate(templateId, dto);
  }
}
