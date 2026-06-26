import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ServiceUnavailableException,
} from '@nestjs/common';
import * as admin from 'firebase-admin';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { User } from '../user/entities/user.entity';
import { FirebaseAdminService } from '../auth/firebase-admin.service';
import { NotificationTemplate } from './entities/notification-template.entity';
import { CreateNotificationTemplateDto } from './dto/create-notification-template.dto';
import { UpdateNotificationTemplateDto } from './dto/update-notification-template.dto';
import { SendAdminNotificationDto } from './dto/send-admin-notification.dto';
import { SendFromTemplateDto } from './dto/send-from-template.dto';
import { containsSensitiveDataKey } from './dto/create-notification-template.dto';

const MAX_PARAM_VALUE_LENGTH = 1000;
const FCM_TITLE_MAX = 200;
const FCM_BODY_MAX = 4000;
const FCM_DATA_MAX_BYTES = 4096;

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly MAX_FCM_TOKENS = 500;

  constructor(
    @InjectRepository(User) private userRepository: Repository<User>,
    @InjectRepository(NotificationTemplate)
    private templateRepository: Repository<NotificationTemplate>,
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
        this.logger.warn(
          `Clave sensible detectada en data FCM: ${key}. Eliminando.`,
        );
        delete sanitized[key];
      }
    });

    return sanitized;
  }

  // ============================================================
  //  Admin: Templates y envíos desde el dashboard
  // ============================================================

  extractPlaceholders(
    title: string,
    body: string,
    deepLink: string | null | undefined,
  ): string[] {
    const placeholderRegex = /\{\{(\w+)\}\}/g;
    const set = new Set<string>();
    const fields = [title, body];
    if (deepLink) fields.push(deepLink);

    for (const field of fields) {
      let match: RegExpExecArray | null;
      placeholderRegex.lastIndex = 0;
      while ((match = placeholderRegex.exec(field)) !== null) {
        set.add(match[1]);
      }
    }

    return Array.from(set).sort();
  }

  private escapeFcmValue(value: string): string {
    return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }

  resolvePlaceholders(
    text: string,
    params: Record<string, string>,
  ): { resolved: string; unresolved: string[] } {
    const unresolved: string[] = [];
    const placeholderRegex = /\{\{(\w+)\}\}/g;
    const resolved = text.replace(placeholderRegex, (match, key: string) => {
      const value = params[key];
      if (value === undefined || value === null) {
        unresolved.push(key);
        return match;
      }
      let strValue = String(value);
      if (strValue.length > MAX_PARAM_VALUE_LENGTH) {
        this.logger.warn(
          `Valor de placeholder '${key}' truncado: ${strValue.length} > ${MAX_PARAM_VALUE_LENGTH} chars.`,
        );
        strValue = strValue.slice(0, MAX_PARAM_VALUE_LENGTH);
      }
      return this.escapeFcmValue(strValue);
    });
    return { resolved, unresolved: Array.from(new Set(unresolved)) };
  }

  async createTemplate(dto: CreateNotificationTemplateDto) {
    if (dto.data && containsSensitiveDataKey(dto.data)) {
      throw new BadRequestException(
        'data contiene claves sensibles no permitidas',
      );
    }

    const existing = await this.templateRepository.findOne({
      where: { name: dto.name },
    });
    if (existing) {
      throw new ConflictException(
        `Ya existe un template con el nombre '${dto.name}'`,
      );
    }

    const template = this.templateRepository.create(dto);
    return this.templateRepository.save(template);
  }

  async listTemplates(query: {
    page: number;
    limit: number;
    search?: string;
    isActive?: boolean;
    sortBy?: 'name' | 'createdAt' | 'updatedAt';
    sortOrder?: 'ASC' | 'DESC';
  }) {
    const qb = this.templateRepository.createQueryBuilder('t');

    if (query.isActive !== undefined) {
      qb.andWhere('t.isActive = :isActive', { isActive: query.isActive });
    }
    if (query.search) {
      qb.andWhere('(t.name ILIKE :s OR t.title ILIKE :s OR t.body ILIKE :s)', {
        s: `%${query.search}%`,
      });
    }

    const sortBy = query.sortBy ?? 'updatedAt';
    const sortOrder = query.sortOrder === 'ASC' ? 'ASC' : 'DESC';
    qb.orderBy(`t.${sortBy}`, sortOrder);
    qb.skip((query.page - 1) * query.limit).take(query.limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data: data.map((t) => ({
        ...t,
        placeholderCount: this.extractPlaceholders(t.title, t.body, t.deepLink)
          .length,
      })),
      total,
      page: query.page,
      limit: query.limit,
      meta: {
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async getTemplate(id: string) {
    const template = await this.templateRepository.findOne({
      where: { id } as FindOptionsWhere<NotificationTemplate>,
    });
    if (!template) {
      throw new NotFoundException(`Template '${id}' no encontrado`);
    }
    return template;
  }

  async updateTemplate(id: string, dto: UpdateNotificationTemplateDto) {
    const template = await this.getTemplate(id);

    if (dto.data && containsSensitiveDataKey(dto.data)) {
      throw new BadRequestException(
        'data contiene claves sensibles no permitidas',
      );
    }

    if (dto.name && dto.name !== template.name) {
      const existing = await this.templateRepository.findOne({
        where: { name: dto.name },
      });
      if (existing) {
        throw new ConflictException(
          `Ya existe un template con el nombre '${dto.name}'`,
        );
      }
    }

    Object.assign(template, dto);
    return this.templateRepository.save(template);
  }

  async deleteTemplate(id: string) {
    const result = await this.templateRepository.update(id, {
      isActive: false,
    });
    if (result.affected === 0) {
      throw new NotFoundException(`Template '${id}' no encontrado`);
    }
    return { success: true, message: 'Template desactivado' };
  }

  async sendFromTemplate(templateId: string, dto: SendFromTemplateDto) {
    if (!this.firebaseAdminService.isInitialized()) {
      throw new ServiceUnavailableException(
        'Servicio de notificaciones no disponible',
      );
    }

    const template = await this.templateRepository.findOne({
      where: { id: templateId } as FindOptionsWhere<NotificationTemplate>,
    });
    if (!template) {
      throw new NotFoundException(`Template '${templateId}' no encontrado`);
    }
    if (!template.isActive) {
      throw new BadRequestException(
        `Template '${template.name}' está inactivo`,
      );
    }

    if (!dto.params || Object.keys(dto.params).length === 0) {
      throw new BadRequestException('params no puede estar vacío');
    }

    const titleResult = this.resolvePlaceholders(template.title, dto.params);
    const bodyResult = this.resolvePlaceholders(template.body, dto.params);
    const deepLinkResult = template.deepLink
      ? this.resolvePlaceholders(template.deepLink, dto.params)
      : { resolved: null as string | null, unresolved: [] as string[] };

    const allUnresolved = [
      ...titleResult.unresolved,
      ...bodyResult.unresolved,
      ...deepLinkResult.unresolved,
    ];

    if (titleResult.resolved.length > FCM_TITLE_MAX) {
      throw new BadRequestException(
        'title exceeds 200 chars after resolving placeholders',
      );
    }
    if (bodyResult.resolved.length > FCM_BODY_MAX) {
      throw new BadRequestException(
        'body exceeds 4000 chars after resolving placeholders',
      );
    }

    const resolvedData: Record<string, string> = {
      ...(template.data ?? {}),
      click_action: 'FLUTTER_NOTIFICATION_CLICK',
      ...(deepLinkResult.resolved
        ? { deep_link: deepLinkResult.resolved }
        : {}),
    };

    const serialized = JSON.stringify(resolvedData);
    if (Buffer.byteLength(serialized, 'utf8') > FCM_DATA_MAX_BYTES) {
      throw new BadRequestException('data payload exceeds 4KB limit');
    }

    const results = await this.sendNotificationToMultipleUsers(
      dto.userIds,
      titleResult.resolved,
      bodyResult.resolved,
      resolvedData,
      template.imageUrl ?? undefined,
    );

    return {
      success: true,
      templateUsed: template.name,
      resolvedTitle: titleResult.resolved,
      resolvedBody: bodyResult.resolved,
      resolvedDeepLink: deepLinkResult.resolved,
      resolvedData,
      ...(allUnresolved.length > 0
        ? {
            unresolvedPlaceholders: [...new Set(allUnresolved)],
            warning: `${allUnresolved.length} placeholder(s) sin resolver: ${[...new Set(allUnresolved)].join(', ')}`,
          }
        : {}),
      results,
    };
  }

  async sendDirectNotification(dto: SendAdminNotificationDto) {
    if (!this.firebaseAdminService.isInitialized()) {
      throw new ServiceUnavailableException(
        'Servicio de notificaciones no disponible',
      );
    }
    return this.sendNotificationToMultipleUsers(
      dto.userIds,
      dto.title,
      dto.body,
      dto.data,
      dto.imageUrl,
    );
  }

  async getUsersWithTokens(page: number, limit: number, search?: string) {
    const qb = this.userRepository
      .createQueryBuilder('user')
      .where('user.fcmToken IS NOT NULL')
      .select(['user.id', 'user.name', 'user.email']);

    if (search) {
      qb.andWhere('(user.name ILIKE :search OR user.email ILIKE :search)', {
        search: `%${search}%`,
      });
    }

    const [data, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('user.name', 'ASC')
      .getManyAndCount();

    return {
      data: data.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        hasFcmToken: true,
      })),
      total,
      page,
      limit,
      meta: { totalPages: Math.ceil(total / limit) },
    };
  }
}
