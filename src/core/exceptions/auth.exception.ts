import { HttpStatus } from '@nestjs/common';
import { BaseBusinessException } from './base.exception';

/**
 * Excepción para errores de autenticación
 */
export class AuthenticationException extends BaseBusinessException {
  constructor(message: string, context?: Record<string, any>) {
    super(message, HttpStatus.UNAUTHORIZED, 'AUTHENTICATION_ERROR', context);
  }
}

/**
 * Excepción para tokens inválidos o expirados
 */
export class InvalidTokenException extends BaseBusinessException {
  constructor(
    reason: string = 'Token inválido o expirado',
    context?: Record<string, any>,
  ) {
    super(reason, HttpStatus.UNAUTHORIZED, 'INVALID_TOKEN', context);
  }
}

/**
 * Excepción para errores en login social (Firebase)
 */
export class SocialLoginException extends BaseBusinessException {
  constructor(
    message: string,
    public readonly provider?: string,
    context?: Record<string, any>,
  ) {
    super(message, HttpStatus.UNAUTHORIZED, 'SOCIAL_LOGIN_ERROR', {
      provider,
      ...context,
    });
  }
}

/**
 * Excepción para credenciales inválidas
 */
export class InvalidCredentialsException extends BaseBusinessException {
  constructor(context?: Record<string, any>) {
    super(
      'Credenciales inválidas',
      HttpStatus.UNAUTHORIZED,
      'INVALID_CREDENTIALS',
      context,
    );
  }
}

/**
 * Excepción para usuarios no verificados
 */
export class UnverifiedUserException extends BaseBusinessException {
  constructor(message?: string, context?: Record<string, any>) {
    super(
      message || 'Usuario no verificado',
      HttpStatus.FORBIDDEN,
      'UNVERIFIED_USER',
      context,
    );
  }
}
