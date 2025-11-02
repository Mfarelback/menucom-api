import { HttpStatus } from '@nestjs/common';
import { BaseBusinessException } from './base.exception';

/**
 * Excepción para errores relacionados con usuarios
 */
export class UserException extends BaseBusinessException {
  constructor(message: string, context?: Record<string, any>) {
    super(message, HttpStatus.BAD_REQUEST, 'USER_ERROR', context);
  }
}

/**
 * Excepción para cuando un usuario ya existe
 */
export class UserAlreadyExistsException extends BaseBusinessException {
  constructor(
    identifier: string,
    field: string = 'email',
    context?: Record<string, any>,
  ) {
    super(
      `Usuario con ${field} '${identifier}' ya existe`,
      HttpStatus.CONFLICT,
      'USER_ALREADY_EXISTS',
      {
        identifier,
        field,
        ...context,
      },
    );
  }
}

/**
 * Excepción para cuando no se encuentra un usuario
 */
export class UserNotFoundException extends BaseBusinessException {
  constructor(identifier: string | number, context?: Record<string, any>) {
    super(
      `Usuario '${identifier}' no encontrado`,
      HttpStatus.NOT_FOUND,
      'USER_NOT_FOUND',
      {
        identifier,
        ...context,
      },
    );
  }
}

/**
 * Excepción para errores en códigos de verificación
 */
export class VerificationCodeException extends BaseBusinessException {
  constructor(message: string, context?: Record<string, any>) {
    super(message, HttpStatus.BAD_REQUEST, 'VERIFICATION_CODE_ERROR', context);
  }
}

/**
 * Excepción para cambios de contraseña inválidos
 */
export class InvalidPasswordChangeException extends BaseBusinessException {
  constructor(reason: string, context?: Record<string, any>) {
    super(
      `Cambio de contraseña inválido: ${reason}`,
      HttpStatus.BAD_REQUEST,
      'INVALID_PASSWORD_CHANGE',
      {
        reason,
        ...context,
      },
    );
  }
}
