import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Excepción base para todas las excepciones personalizadas del negocio
 */
export abstract class BaseBusinessException extends HttpException {
  constructor(
    message: string,
    statusCode: HttpStatus = HttpStatus.BAD_REQUEST,
    public readonly errorCode?: string,
    public readonly context?: Record<string, any>,
  ) {
    super(
      {
        message,
        errorCode,
        context,
        timestamp: new Date().toISOString(),
      },
      statusCode,
    );
  }
}

/**
 * Excepción para errores de validación de negocio
 */
export class BusinessValidationException extends BaseBusinessException {
  constructor(
    message: string,
    errorCode?: string,
    context?: Record<string, any>,
  ) {
    super(message, HttpStatus.BAD_REQUEST, errorCode, context);
  }
}

/**
 * Excepción para recursos no encontrados
 */
export class ResourceNotFoundException extends BaseBusinessException {
  constructor(
    resourceType: string,
    identifier: string | number,
    context?: Record<string, any>,
  ) {
    super(
      `${resourceType} con identificador '${identifier}' no encontrado`,
      HttpStatus.NOT_FOUND,
      'RESOURCE_NOT_FOUND',
      { resourceType, identifier, ...context },
    );
  }
}

/**
 * Excepción para operaciones no autorizadas
 */
export class UnauthorizedOperationException extends BaseBusinessException {
  constructor(message: string, context?: Record<string, any>) {
    super(message, HttpStatus.FORBIDDEN, 'UNAUTHORIZED_OPERATION', context);
  }
}

/**
 * Excepción para conflictos de negocio (ej: recurso ya existe)
 */
export class BusinessConflictException extends BaseBusinessException {
  constructor(message: string, context?: Record<string, any>) {
    super(message, HttpStatus.CONFLICT, 'BUSINESS_CONFLICT', context);
  }
}
