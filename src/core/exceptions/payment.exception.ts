import { HttpStatus } from '@nestjs/common';
import { BaseBusinessException } from './base.exception';

/**
 * Excepción para errores en el procesamiento de pagos
 */
export class PaymentProcessingException extends BaseBusinessException {
  constructor(
    message: string,
    public readonly paymentId?: string,
    context?: Record<string, any>,
  ) {
    super(message, HttpStatus.PAYMENT_REQUIRED, 'PAYMENT_PROCESSING_ERROR', {
      paymentId,
      ...context,
    });
  }
}

/**
 * Excepción para errores de integración con MercadoPago
 */
export class MercadoPagoException extends BaseBusinessException {
  constructor(
    message: string,
    public readonly mpErrorCode?: string,
    context?: Record<string, any>,
  ) {
    super(message, HttpStatus.BAD_GATEWAY, 'MERCADOPAGO_ERROR', {
      mpErrorCode,
      ...context,
    });
  }
}

/**
 * Excepción para pagos rechazados
 */
export class PaymentRejectedException extends BaseBusinessException {
  constructor(
    reason: string,
    public readonly paymentId?: string,
    context?: Record<string, any>,
  ) {
    super(
      `Pago rechazado: ${reason}`,
      HttpStatus.PAYMENT_REQUIRED,
      'PAYMENT_REJECTED',
      {
        reason,
        paymentId,
        ...context,
      },
    );
  }
}

/**
 * Excepción para errores en webhooks de pago
 */
export class PaymentWebhookException extends BaseBusinessException {
  constructor(
    message: string,
    public readonly webhookType?: string,
    context?: Record<string, any>,
  ) {
    super(message, HttpStatus.UNPROCESSABLE_ENTITY, 'WEBHOOK_ERROR', {
      webhookType,
      ...context,
    });
  }
}

/**
 * Excepción para saldo insuficiente
 */
export class InsufficientBalanceException extends BaseBusinessException {
  constructor(
    required: number,
    available: number,
    context?: Record<string, any>,
  ) {
    super(
      `Saldo insuficiente. Requerido: ${required}, Disponible: ${available}`,
      HttpStatus.PAYMENT_REQUIRED,
      'INSUFFICIENT_BALANCE',
      {
        required,
        available,
        ...context,
      },
    );
  }
}
