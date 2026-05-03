import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import * as admin from 'firebase-admin';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../user/entities/user.entity';
import { FirebaseAdminService } from '../auth/firebase-admin.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly MAX_FCM_TOKENS = 500;

  constructor(
    @InjectRepository(User) private userRepository: Repository<User>,
    private firebaseAdminService: FirebaseAdminService,
  ) {}

  async sendNotificationToUser(
    userId: string,
    title: string,
    body: string,
    data?: { [key: string]: string },
    imageUrl?: string,
  ): Promise<boolean> {
    try {
      if (!this.firebaseAdminService.isInitialized()) {
        this.logger.warn(
          'Firebase no está inicializado. Omitiendo envío de notificación.',
        );
        return false;
      }

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
          ...(imageUrl ? { imageUrl } : {}),
        },
        data: this.sanitizeData(data || {}),
        token: user.fcmToken,
      };

      const response = await this.retry(() =>
        this.firebaseAdminService.messaging.send(message),
      );
      this.logger.log(
        `Notificación enviada exitosamente al usuario ${userId}. ID: ${response}`,
      );
      return true;
    } catch (error) {
      // Manejar errores de token inválido para un solo usuario
      if (
        error.code === 'messaging/registration-token-not-registered' ||
        error.code === 'messaging/invalid-registration-token'
      ) {
        this.logger.warn(
          `Token FCM inválido para el usuario ${userId}. Limpiando token.`,
        );
        await this.clearUserFcmToken(userId);
      }

      this.logger.error(
        `Error al enviar notificación al usuario ${userId} tras reintentos: ${error.message}`,
        error.stack,
      );
      return false;
    }
  }

  private async retry<T>(
    fn: () => Promise<T>,
    retries = 2,
    delay = 1000,
  ): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (retries <= 0) throw error;

      // No reintentar si el error es por token inválido o problemas de argumento
      const nonRetryableErrors = [
        'messaging/registration-token-not-registered',
        'messaging/invalid-registration-token',
        'messaging/invalid-argument',
      ];

      if (nonRetryableErrors.includes(error.code)) {
        throw error;
      }

      this.logger.warn(
        `Error en envío FCM. Reintentando en ${delay}ms... (${retries} intentos restantes)`,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
      return this.retry(fn, retries - 1, delay * 2);
    }
  }

  async sendNotificationToMultipleUsers(
    userIds: string[],
    title: string,
    body: string,
    data?: { [key: string]: string },
    imageUrl?: string,
  ): Promise<{ successCount: number; failureCount: number }> {
    try {
      if (!this.firebaseAdminService.isInitialized()) {
        this.logger.warn(
          'Firebase no está inicializado. Omitiendo envío de notificaciones.',
        );
        return { successCount: 0, failureCount: 0 };
      }

      const users = await this.userRepository.find({
        where: userIds.map((id) => ({ id })),
      });

      // Mapear tokens a usuarios para poder limpiar los fallidos después
      const userTokens = users
        .filter((user) => user.fcmToken)
        .map((user) => ({ userId: user.id, token: user.fcmToken }));

      if (userTokens.length === 0) {
        this.logger.warn(
          'No hay tokens FCM válidos para enviar notificaciones.',
        );
        return { successCount: 0, failureCount: 0 };
      }

      const tokens = userTokens.map((ut) => ut.token);
      let successCount = 0;
      let failureCount = 0;

      // Dividir en batches de 500 (límite de FCM)
      for (let i = 0; i < tokens.length; i += this.MAX_FCM_TOKENS) {
        const tokenBatch = tokens.slice(i, i + this.MAX_FCM_TOKENS);
        const userBatch = userTokens.slice(i, i + this.MAX_FCM_TOKENS);

        const message: admin.messaging.MulticastMessage = {
          notification: {
            title,
            body,
            ...(imageUrl ? { imageUrl } : {}),
          },
          data: this.sanitizeData(data || {}),
          tokens: tokenBatch,
        };

        const response =
          await this.firebaseAdminService.messaging.sendEachForMulticast(
            message,
          );

        successCount += response.successCount;
        failureCount += response.failureCount;

        // Procesar fallos para limpiar tokens
        if (response.failureCount > 0) {
          await this.handleBatchFailures(userBatch, response.responses);
        }
      }

      this.logger.log(
        `Notificaciones enviadas. Éxitos: ${successCount}, Fallos: ${failureCount}`,
      );

      return { successCount, failureCount };
    } catch (error) {
      this.logger.error(
        `Error crítico al enviar notificaciones múltiples: ${error.message}`,
        error.stack,
      );
      return { successCount: 0, failureCount: 0 };
    }
  }

  private async handleBatchFailures(
    userBatch: { userId: string; token: string }[],
    responses: admin.messaging.SendResponse[],
  ) {
    const idsToClean: string[] = [];

    responses.forEach((res, index) => {
      if (!res.success) {
        const error = res.error as any;
        if (
          error?.code === 'messaging/registration-token-not-registered' ||
          error?.code === 'messaging/invalid-registration-token'
        ) {
          idsToClean.push(userBatch[index].userId);
        }
      }
    });

    if (idsToClean.length > 0) {
      this.logger.log(`Limpiando ${idsToClean.length} tokens FCM inválidos.`);
      await this.userRepository.update(idsToClean, { fcmToken: null });
    }
  }

  private async clearUserFcmToken(userId: string) {
    await this.userRepository.update(userId, { fcmToken: null });
  }

  private sanitizeData(data: { [key: string]: string }): {
    [key: string]: string;
  } {
    const sensitiveKeys = [
      'password',
      'token',
      'secret',
      'key',
      'auth',
      'credential',
    ];
    const sanitized = { ...data };

    Object.keys(sanitized).forEach((key) => {
      if (sensitiveKeys.some((sk) => key.toLowerCase().includes(sk))) {
        this.logger.warn(`Clave sensible detectada en data FCM: ${key}. Eliminando.`);
        delete sanitized[key];
      }
    });

    return sanitized;
  }
}
