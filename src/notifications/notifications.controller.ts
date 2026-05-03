import {
  Controller,
  Post,
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
} from '@nestjs/swagger';
import { Request } from 'express';

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
    this.logger.log(`Iniciando envío de notificación de prueba para el usuario ${userId}`);

    const success = await this.notificationsService.sendNotificationToUser(
      userId,
      'Prueba de Notificación 🔔',
      '¡Hola! Esta es una notificación de prueba desde el backend de MenuCom.',
      { 
        type: 'test', 
        timestamp: new Date().toISOString(),
        click_action: 'FLUTTER_NOTIFICATION_CLICK'
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
      timestamp: new Date().toISOString()
    };
  }
}
