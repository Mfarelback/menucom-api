import { HttpStatus } from '@nestjs/common';
import { BaseBusinessException } from './base.exception';

/**
 * Excepción para membresía no encontrada
 */
export class MembershipNotFoundException extends BaseBusinessException {
  constructor(identifier: string, context?: Record<string, any>) {
    super(
      `Membresía '${identifier}' no encontrada`,
      HttpStatus.NOT_FOUND,
      'MEMBERSHIP_NOT_FOUND',
      {
        membershipId: identifier,
        ...context,
      },
    );
  }
}

/**
 * Excepción para membresía duplicada
 */
export class DuplicateMembershipException extends BaseBusinessException {
  constructor(userId: string, context?: Record<string, any>) {
    super(
      `El usuario '${userId}' ya tiene una membresía activa`,
      HttpStatus.BAD_REQUEST,
      'DUPLICATE_MEMBERSHIP',
      {
        userId,
        ...context,
      },
    );
  }
}

/**
 * Excepción para errores de membresía
 */
export class MembershipException extends BaseBusinessException {
  constructor(message: string, context?: Record<string, any>) {
    super(message, HttpStatus.BAD_REQUEST, 'MEMBERSHIP_ERROR', context);
  }
}

/**
 * Excepción para cuando una funcionalidad requiere una membresía superior
 */
export class InsufficientMembershipException extends BaseBusinessException {
  constructor(
    requiredTier: string,
    currentTier: string,
    feature?: string,
    context?: Record<string, any>,
  ) {
    const featureMsg = feature ? ` para usar '${feature}'` : '';
    super(
      `Se requiere membresía '${requiredTier}'${featureMsg}. Membresía actual: '${currentTier}'`,
      HttpStatus.FORBIDDEN,
      'INSUFFICIENT_MEMBERSHIP',
      {
        requiredTier,
        currentTier,
        feature,
        ...context,
      },
    );
  }
}

/**
 * Excepción para límites de membresía excedidos
 */
export class MembershipLimitExceededException extends BaseBusinessException {
  constructor(
    limitType: string,
    limit: number,
    current: number,
    context?: Record<string, any>,
  ) {
    super(
      `Límite de '${limitType}' excedido. Máximo: ${limit}, Actual: ${current}`,
      HttpStatus.FORBIDDEN,
      'MEMBERSHIP_LIMIT_EXCEEDED',
      {
        limitType,
        limit,
        current,
        ...context,
      },
    );
  }
}

/**
 * Excepción para errores de suscripción
 */
export class SubscriptionException extends BaseBusinessException {
  constructor(message: string, context?: Record<string, any>) {
    super(message, HttpStatus.BAD_REQUEST, 'SUBSCRIPTION_ERROR', context);
  }
}
