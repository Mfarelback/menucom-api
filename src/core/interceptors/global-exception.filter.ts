import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { LoggerService } from '../logger/logger.service';
import { BaseBusinessException } from '../exceptions/base.exception';

/**
 * Filtro global de excepciones que:
 * 1. Captura todas las excepciones HTTP y errores no controlados
 * 2. Formatea la respuesta de error de manera consistente
 * 3. Registra errores con LoggerService (con sanitización automática)
 * 4. Oculta detalles de errores internos en producción
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: LoggerService) {
    this.logger.setContext('GlobalExceptionFilter');
  }

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Determinar status code y mensaje
    let status: number;
    let errorResponse: any;

    if (exception instanceof BaseBusinessException) {
      // Excepciones de negocio personalizadas
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse() as any;

      errorResponse = {
        statusCode: status,
        message: exceptionResponse.message,
        errorCode: exceptionResponse.errorCode,
        timestamp: exceptionResponse.timestamp,
        path: request.url,
        ...(exceptionResponse.context && {
          context: this.sanitizeContext(exceptionResponse.context),
        }),
      };

      // Log según severidad
      if (status >= 500) {
        this.logger.error(
          `Business Exception: ${exceptionResponse.message}`,
          exception.stack,
        );
      } else {
        this.logger.warn(
          `Business Exception [${exceptionResponse.errorCode}]: ${exceptionResponse.message}`,
        );
      }
    } else if (exception instanceof HttpException) {
      // Excepciones HTTP estándar de NestJS
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      errorResponse = {
        statusCode: status,
        message:
          typeof exceptionResponse === 'string'
            ? exceptionResponse
            : (exceptionResponse as any).message || 'Error desconocido',
        timestamp: new Date().toISOString(),
        path: request.url,
      };

      // Log solo errores 5xx
      if (status >= 500) {
        this.logger.error(
          `HTTP Exception: ${errorResponse.message}`,
          exception.stack,
        );
      } else {
        this.logger.warn(`HTTP ${status}: ${errorResponse.message}`);
      }
    } else {
      // Errores no controlados (500)
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      const isProduction = process.env.NODE_ENV === 'production';

      errorResponse = {
        statusCode: status,
        message: isProduction
          ? 'Error interno del servidor'
          : exception instanceof Error
            ? exception.message
            : 'Error desconocido',
        timestamp: new Date().toISOString(),
        path: request.url,
        ...(!isProduction &&
          exception instanceof Error && {
            stack: exception.stack?.split('\n').slice(0, 5), // Solo primeras 5 líneas
          }),
      };

      // Log completo del error no controlado
      this.logger.error(
        `Unhandled Exception: ${exception instanceof Error ? exception.message : 'Unknown error'}`,
        exception instanceof Error ? exception.stack : undefined,
      );
      this.logger.logObject('Request details', {
        method: request.method,
        url: request.url,
        body: request.body,
        params: request.params,
        query: request.query,
      });
    }

    // Enviar respuesta
    response.status(status).json(errorResponse);
  }

  /**
   * Sanitiza el contexto para eliminar datos sensibles antes de enviar al cliente
   */
  private sanitizeContext(context: Record<string, any>): Record<string, any> {
    const sanitized = { ...context };
    const sensitiveFields = [
      'password',
      'token',
      'accessToken',
      'refreshToken',
      'socialToken',
      'apiKey',
      'secret',
    ];

    for (const field of sensitiveFields) {
      if (field in sanitized) {
        delete sanitized[field];
      }
    }

    return sanitized;
  }
}
