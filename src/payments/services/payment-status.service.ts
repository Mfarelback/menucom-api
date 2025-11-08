import { Injectable, BadRequestException } from '@nestjs/common';
import { PaymentsRepository } from '../repository/payment_repository';
import { PaymentIntent } from '../entities/payment_intent_entity';
import { PaymentStatusType } from 'src/config';
import { LoggerService } from 'src/core/logger/logger.service';

/**
 * Servicio especializado en manejo de estados de pagos
 *
 * Responsabilidades:
 * - Actualizar estado de PaymentIntent basado en respuestas de MercadoPago
 * - Mapear estados de MercadoPago a estados internos
 * - Mapear estados de pago a estados de orden
 *
 * @see PaymentIntent entity para estados posibles
 * @see PaymentStatusType enum para tipos de estado
 */
@Injectable()
export class PaymentStatusService {
  constructor(
    private readonly paymentIntentRepository: PaymentsRepository,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext('PaymentStatusService');
  }

  /**
   * Actualiza el estado del PaymentIntent basado en el estado del pago de MercadoPago
   *
   * @param paymentIntentId - ID del PaymentIntent a actualizar
   * @param mpPaymentStatus - Estado del pago en MercadoPago (approved, pending, rejected, etc.)
   * @returns PaymentIntent actualizado
   * @throws BadRequestException si hay error al actualizar
   *
   * @example
   * ```typescript
   * const updated = await this.paymentStatusService.updatePaymentIntentStatus(
   *   'uuid-123',
   *   'approved'
   * );
   * ```
   */
  async updatePaymentIntentStatus(
    paymentIntentId: string,
    mpPaymentStatus: string,
  ): Promise<PaymentIntent> {
    try {
      const newStatus =
        this.mapMercadoPagoStatusToPaymentStatus(mpPaymentStatus);

      this.logger.log(
        `Actualizando PaymentIntent ${paymentIntentId}: ${mpPaymentStatus} → ${newStatus}`,
      );

      return await this.paymentIntentRepository.changeStatusPayment(
        paymentIntentId,
        newStatus,
      );
    } catch (error) {
      this.logger.error(
        `Error actualizando estado del PaymentIntent ${paymentIntentId}`,
        error.stack,
      );
      throw new BadRequestException(
        `Error al actualizar el estado del PaymentIntent: ${error.message}`,
      );
    }
  }

  /**
   * Mapea el estado del pago de MercadoPago al estado interno de PaymentIntent
   *
   * @param mpPaymentStatus - Estado de MercadoPago
   * @returns Estado interno de PaymentIntent
   *
   * Estados de MercadoPago:
   * - approved: Pago aprobado
   * - pending: Pago pendiente de procesamiento
   * - in_process: Pago en proceso de revisión
   * - rejected: Pago rechazado
   * - cancelled: Pago cancelado por el usuario
   * - refunded: Pago reembolsado
   */
  private mapMercadoPagoStatusToPaymentStatus(mpPaymentStatus: string): string {
    switch (mpPaymentStatus) {
      case 'approved':
        return PaymentStatusType.APPROVED;
      case 'pending':
      case 'in_process':
        return PaymentStatusType.IN_PROCESS;
      case 'rejected':
      case 'cancelled':
        return PaymentStatusType.REJECTED;
      case 'refunded':
        return PaymentStatusType.REFUNDED;
      default:
        this.logger.warn(
          `Estado de MercadoPago desconocido: ${mpPaymentStatus}, usando PENDING por defecto`,
        );
        return PaymentStatusType.PENDING;
    }
  }

  /**
   * Mapea el estado del pago de MercadoPago al estado de la orden
   *
   * @param mpPaymentStatus - Estado del pago en MercadoPago
   * @returns Estado correspondiente de la orden
   *
   * Mapeo de estados:
   * - approved → confirmed (orden confirmada)
   * - pending/in_process → pending (orden pendiente)
   * - rejected/cancelled/refunded → cancelled (orden cancelada)
   */
  mapPaymentStatusToOrderStatus(mpPaymentStatus: string): string {
    switch (mpPaymentStatus) {
      case 'approved':
        return 'confirmed';
      case 'pending':
      case 'in_process':
        return 'pending';
      case 'rejected':
      case 'cancelled':
      case 'refunded':
        return 'cancelled';
      default:
        this.logger.warn(
          `Estado de pago desconocido para mapeo a orden: ${mpPaymentStatus}`,
        );
        return 'pending';
    }
  }
}
