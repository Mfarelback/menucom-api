import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import * as admin from 'firebase-admin';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../user/entities/user.entity';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(User) private userRepository: Repository<User>,
  ) {}

  async sendNotificationToUser(
    userId: string,
    title: string,
    body: string,
    data?: { [key: string]: string },
  ): Promise<boolean> {
    try {
      const user = await this.userRepository.findOne({ where: { id: userId } });

      if (!user || !user.fcmToken) {
        this.logger.warn(
          `No se pudo enviar la notificación: Usuario ${userId} no encontrado o sin token FCM.`,
        );
        return false;
      }

      const message: admin.messaging.Message = {
        notification: {
          title,
          body,
        },
        data: data || {},
        token: user.fcmToken,
      };

      const response = await admin.messaging().send(message);
      this.logger.log(
        `Notificación enviada exitosamente al usuario ${userId}: ${response}`,
      );
      return true;
    } catch (error) {
      this.logger.error(
        `Error al enviar notificación al usuario ${userId}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Error al enviar notificación: ${error.message}`,
      );
    }
  }

  async sendNotificationToMultipleUsers(
    userIds: string[],
    title: string,
    body: string,
    data?: { [key: string]: string },
  ): Promise<admin.messaging.BatchResponse> {
    try {
      const users = await this.userRepository.find({
        where: userIds.map((id) => ({ id })),
      });

      const fcmTokens = users
        .filter((user) => user.fcmToken)
        .map((user) => user.fcmToken);

      if (fcmTokens.length === 0) {
        this.logger.warn(
          'No hay tokens FCM válidos para enviar notificaciones.',
        );
        return { responses: [], successCount: 0, failureCount: 0 };
      }

      const message: admin.messaging.MulticastMessage = {
        notification: {
          title,
          body,
        },
        data: data || {},
        tokens: fcmTokens,
      };

      const response = await admin.messaging().sendEachForMulticast(message);
      this.logger.log(
        `Notificaciones enviadas a múltiples usuarios. Éxitos: ${response.successCount}, Fallos: ${response.failureCount}`,
      );
      return response;
    } catch (error) {
      this.logger.error(
        `Error al enviar notificaciones a múltiples usuarios: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Error al enviar notificaciones: ${error.message}`,
      );
    }
  }
}
