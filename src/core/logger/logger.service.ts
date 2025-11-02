import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';

/**
 * Servicio centralizado de logging con soporte para:
 * - Filtrado por entorno (desarrollo vs producción)
 * - Sanitización de datos sensibles
 * - Contexto estructurado
 * - Niveles de logging estándar
 */
@Injectable()
export class LoggerService implements NestLoggerService {
  private context?: string;
  private readonly isDevelopment = process.env.NODE_ENV !== 'production';

  /**
   * Establece el contexto para todos los logs de esta instancia
   * @param context Nombre del servicio o módulo
   */
  setContext(context: string) {
    this.context = context;
  }

  /**
   * Log de nivel informativo (solo en desarrollo)
   * @param message Mensaje a loggear
   * @param context Contexto opcional (sobreescribe el por defecto)
   */
  log(message: string, context?: string) {
    if (this.isDevelopment) {
      const ctx = context || this.context || 'App';
      console.log(`[${this.getTimestamp()}] [INFO] [${ctx}] ${message}`);
    }
  }

  /**
   * Log de errores (siempre se registra, incluso en producción)
   * @param message Mensaje de error
   * @param trace Stack trace del error
   * @param context Contexto opcional
   */
  error(message: string, trace?: string, context?: string) {
    const ctx = context || this.context || 'App';
    console.error(`[${this.getTimestamp()}] [ERROR] [${ctx}] ${message}`);
    if (trace) {
      console.error(`[${this.getTimestamp()}] [TRACE] ${trace}`);
    }
  }

  /**
   * Log de advertencias (siempre se registra)
   * @param message Mensaje de advertencia
   * @param context Contexto opcional
   */
  warn(message: string, context?: string) {
    const ctx = context || this.context || 'App';
    console.warn(`[${this.getTimestamp()}] [WARN] [${ctx}] ${message}`);
  }

  /**
   * Log de debug (solo en desarrollo)
   * @param message Mensaje de debug
   * @param context Contexto opcional
   */
  debug(message: string, context?: string) {
    if (this.isDevelopment) {
      const ctx = context || this.context || 'App';
      console.debug(`[${this.getTimestamp()}] [DEBUG] [${ctx}] ${message}`);
    }
  }

  /**
   * Log verbose (solo en desarrollo)
   * @param message Mensaje verbose
   * @param context Contexto opcional
   */
  verbose(message: string, context?: string) {
    if (this.isDevelopment) {
      const ctx = context || this.context || 'App';
      console.log(`[${this.getTimestamp()}] [VERBOSE] [${ctx}] ${message}`);
    }
  }

  /**
   * Sanitiza datos sensibles antes de loggear
   * Reemplaza campos sensibles con '***REDACTED***'
   * @param data Objeto a sanitizar
   * @returns Objeto sanitizado
   */
  sanitize(data: any): any {
    if (!data) return data;

    // Lista de campos sensibles a redactar
    const sensitiveFields = [
      'password',
      'token',
      'socialToken',
      'accessToken',
      'access_token',
      'refreshToken',
      'refresh_token',
      'secret',
      'apiKey',
      'api_key',
      'privateKey',
      'fcmToken',
      'authorization',
    ];

    // Si es un string, verificar si parece un token
    if (typeof data === 'string') {
      // Si es muy largo o tiene formato de JWT/token, redactar
      if (
        data.length > 50 ||
        data.includes('Bearer') ||
        data.split('.').length === 3
      ) {
        return '***REDACTED***';
      }
      return data;
    }

    // Si es un array, sanitizar cada elemento
    if (Array.isArray(data)) {
      return data.map((item) => this.sanitize(item));
    }

    // Si es un objeto, sanitizar campos sensibles
    if (typeof data === 'object') {
      const sanitized: any = {};

      for (const key of Object.keys(data)) {
        const lowerKey = key.toLowerCase();
        const isSensitive = sensitiveFields.some((field) =>
          lowerKey.includes(field.toLowerCase()),
        );

        if (isSensitive) {
          sanitized[key] = '***REDACTED***';
        } else if (typeof data[key] === 'object') {
          sanitized[key] = this.sanitize(data[key]);
        } else {
          sanitized[key] = data[key];
        }
      }

      return sanitized;
    }

    return data;
  }

  /**
   * Helper para loggear objetos de forma segura
   * @param message Mensaje descriptivo
   * @param data Objeto a loggear (será sanitizado)
   * @param context Contexto opcional
   */
  logObject(message: string, data: any, context?: string) {
    const sanitizedData = this.sanitize(data);
    this.log(`${message}: ${JSON.stringify(sanitizedData)}`, context);
  }

  /**
   * Helper para loggear errores de forma estructurada
   * @param message Mensaje de error
   * @param error Error object
   * @param context Contexto opcional
   */
  logError(message: string, error: Error, context?: string) {
    this.error(
      `${message}: ${error.message}`,
      error.stack,
      context || this.context,
    );
  }

  /**
   * Obtiene timestamp formateado para logs
   * @returns Timestamp en formato ISO
   */
  private getTimestamp(): string {
    return new Date().toISOString();
  }
}
