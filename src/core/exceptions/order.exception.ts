import { HttpStatus } from '@nestjs/common';
import { BaseBusinessException } from './base.exception';

/**
 * Excepción para errores en el cálculo de órdenes
 */
export class OrderCalculationException extends BaseBusinessException {
  constructor(message: string, context?: Record<string, any>) {
    super(message, HttpStatus.BAD_REQUEST, 'ORDER_CALCULATION_ERROR', context);
  }
}

/**
 * Excepción para órdenes inválidas
 */
export class InvalidOrderException extends BaseBusinessException {
  constructor(
    reason: string,
    public readonly orderId?: string,
    context?: Record<string, any>,
  ) {
    super(
      `Orden inválida: ${reason}`,
      HttpStatus.BAD_REQUEST,
      'INVALID_ORDER',
      {
        reason,
        orderId,
        ...context,
      },
    );
  }
}

/**
 * Excepción para cuando una orden no puede ser procesada
 */
export class OrderProcessingException extends BaseBusinessException {
  constructor(
    message: string,
    public readonly orderId?: string,
    context?: Record<string, any>,
  ) {
    super(message, HttpStatus.UNPROCESSABLE_ENTITY, 'ORDER_PROCESSING_ERROR', {
      orderId,
      ...context,
    });
  }
}

/**
 * Excepción para transiciones de estado inválidas
 */
export class InvalidOrderStateTransitionException extends BaseBusinessException {
  constructor(
    currentState: string,
    targetState: string,
    context?: Record<string, any>,
  ) {
    super(
      `Transición de estado inválida: de '${currentState}' a '${targetState}'`,
      HttpStatus.CONFLICT,
      'INVALID_STATE_TRANSITION',
      {
        currentState,
        targetState,
        ...context,
      },
    );
  }
}

/**
 * Excepción para errores en marketplace fee
 */
export class MarketplaceFeeException extends BaseBusinessException {
  constructor(message: string, context?: Record<string, any>) {
    super(message, HttpStatus.BAD_REQUEST, 'MARKETPLACE_FEE_ERROR', context);
  }
}
