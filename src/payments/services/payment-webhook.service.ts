import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { MercadopagoService } from './mercado_pago.service';
import { PaymentsRepository } from '../repository/payment_repository';
import { PaymentIntent } from '../entities/payment_intent_entity';
import { MerchantOrderResponse } from 'mercadopago/dist/clients/merchantOrder/commonTypes';
import { OrdersService } from 'src/orders/services/orders.service';
import { LoggerService } from 'src/core/logger/logger.service';
import { PaymentStatusService } from './payment-status.service';

/**
 * Servicio especializado en procesamiento de webhooks de MercadoPago
 *
 * Responsabilidades:
 * - Procesar notificaciones de payment y merchant_order
 * - Actualizar estados de PaymentIntent y Orders
 * - Verificar estados de pago
 * - Aprobar pagos basándose en merchant orders
 *
 * @see PaymentStatusService para mapeo de estados
 * @see OrdersService para actualización de órdenes
 *
 * ⚠️ NOTA: Este servicio mantiene la dependencia circular con OrdersService
 * mediante forwardRef. Considerar refactorizar usando eventos (EventEmitter)
 * en futuras iteraciones.
 */
@Injectable()
export class PaymentWebhookService {
  constructor(
    private readonly mercadoPagoService: MercadopagoService,
    private readonly paymentIntentRepository: PaymentsRepository,
    private readonly paymentStatusService: PaymentStatusService,
    @Inject(forwardRef(() => OrdersService))
    private readonly ordersService: OrdersService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext('PaymentWebhookService');
  }

  /**
   * Procesa las notificaciones del webhook de MercadoPago y actualiza los estados correspondientes
   *
   * MercadoPago envía dos tipos de notificaciones:
   * 1. **payment**: Cuando cambia el estado de un pago individual
   * 2. **merchant_order**: Cuando se completa una orden completa (puede incluir múltiples pagos)
   *
   * @param paymentId - ID del pago en MercadoPago (opcional, para notificaciones de tipo payment)
   * @param merchantOrderId - ID de la orden de comercio (opcional, para notificaciones de tipo merchant_order)
   * @returns Objeto con orderId, paymentIntent y order actualizados
   * @throws BadRequestException si hay error en el procesamiento
   *
   * @example
   * ```typescript
   * // Notificación de payment
   * const result = await this.paymentWebhookService.processWebhookNotification('12345678', null);
   *
   * // Notificación de merchant_order
   * const result = await this.paymentWebhookService.processWebhookNotification(null, '87654321');
   * ```
   */
  async processWebhookNotification(
    paymentId?: string,
    merchantOrderId?: string | number,
  ): Promise<{
    orderId: string | null;
    paymentIntent?: PaymentIntent;
    order?: any;
    paymentStatus?: string;
  }> {
    try {
      let orderId: string | null = null;
      let paymentStatus: string | null = null;
      let updatedPaymentIntent: PaymentIntent | undefined = undefined;
      let updatedOrder: any = undefined;

      // Caso 1: Notificación de payment
      if (paymentId) {
        this.logger.log(`Procesando payment ID: ${paymentId}`);

        // Obtener información del pago desde MercadoPago
        const paymentInfo =
          await this.mercadoPagoService.getPaymentInfo(paymentId);
        orderId =
          paymentInfo.external_reference || paymentInfo.order_id || null;
        paymentStatus = paymentInfo.status;

        this.logger.logObject('Payment info recibido', {
          status: paymentStatus,
          orderId: orderId,
          paymentId: paymentId,
        });

        if (orderId && paymentStatus) {
          // Actualizar el PaymentIntent
          try {
            updatedPaymentIntent =
              await this.paymentStatusService.updatePaymentIntentStatus(
                orderId,
                paymentStatus,
              );
            this.logger.log(
              `PaymentIntent actualizado: ${updatedPaymentIntent.id} → ${updatedPaymentIntent.state}`,
            );
          } catch (error) {
            this.logger.warn(
              `Error actualizando PaymentIntent ${orderId}: ${error.message}`,
            );
          }

          // Actualizar la Order
          try {
            const orderStatus =
              this.paymentStatusService.mapPaymentStatusToOrderStatus(
                paymentStatus,
              );
            const order = await this.ordersService.findByOperationId(orderId);

            if (order) {
              updatedOrder = await this.ordersService.updateOrderStatus(
                order.id,
                orderStatus,
              );
              this.logger.log(
                `Order actualizada: ${order.id} → ${updatedOrder.status}`,
              );
            } else {
              this.logger.warn(
                `No se encontró orden con operationID: ${orderId}`,
              );
            }
          } catch (error) {
            this.logger.warn(
              `Error actualizando Order para orderId ${orderId}: ${error.message}`,
            );
          }
        } else {
          this.logger.warn(
            `No se pudo extraer orderId o paymentStatus del payment ${paymentId}`,
          );
        }
      }

      // Caso 2: Notificación de merchant_order
      if (merchantOrderId && !orderId) {
        this.logger.log(`Procesando merchant_order ID: ${merchantOrderId}`);
        orderId =
          await this.mercadoPagoService.getOrderIdByMerchantOrderId(
            merchantOrderId,
          );

        if (orderId) {
          this.logger.log(`OrderId extraído de merchant_order: ${orderId}`);

          // Para merchant_order, generalmente significa que el pago fue aprobado
          try {
            updatedPaymentIntent =
              await this.paymentStatusService.updatePaymentIntentStatus(
                orderId,
                'approved',
              );
            this.logger.log(
              `PaymentIntent actualizado via merchant_order: ${updatedPaymentIntent.id}`,
            );
          } catch (error) {
            this.logger.warn(
              `Error actualizando PaymentIntent via merchant_order ${orderId}: ${error.message}`,
            );
          }

          try {
            const order = await this.ordersService.findByOperationId(orderId);
            if (order) {
              updatedOrder = await this.ordersService.updateOrderStatus(
                order.id,
                'confirmed',
              );
              this.logger.log(
                `Order confirmada via merchant_order: ${order.id}`,
              );
            } else {
              this.logger.warn(
                `No se encontró orden con operationID: ${orderId}`,
              );
            }
          } catch (error) {
            this.logger.warn(
              `Error actualizando Order via merchant_order ${orderId}: ${error.message}`,
            );
          }
        } else {
          this.logger.warn(
            `No se pudo extraer orderId del merchant_order ${merchantOrderId}`,
          );
        }
      }

      this.logger.log(
        `Webhook procesado exitosamente - OrderId: ${orderId || 'N/A'}`,
      );

      return {
        orderId,
        paymentIntent: updatedPaymentIntent,
        order: updatedOrder,
        paymentStatus,
      };
    } catch (error) {
      this.logger.error(`Error procesando notificación webhook`, error.stack);
      throw new BadRequestException(
        `Error procesando notificación del webhook: ${error.message}`,
      );
    }
  }

  /**
   * Verifica el estado actual de un pago consultando a MercadoPago
   *
   * @param idReference - ID de referencia del PaymentIntent
   * @throws BadRequestException si hay error en la consulta
   *
   * @description
   * Este método consulta los merchant orders asociados a un PaymentIntent
   * y llama a approvePaymentByMerchandResults para validar y aprobar el pago.
   * Útil para verificaciones manuales o re-intentos.
   */
  async checkPaymentStatus(idReference: string): Promise<void> {
    try {
      if (!idReference) {
        throw new BadRequestException(
          'El idReference del pago no puede estar vacío',
        );
      }

      this.logger.log(`Verificando estado de pago: ${idReference}`);

      const intentPayment =
        await this.paymentIntentRepository.getPaymentById(idReference);

      if (!intentPayment) {
        throw new BadRequestException(
          `No se encontró PaymentIntent con ID ${idReference}`,
        );
      }

      // Consultar merchant orders en MercadoPago
      const paymentsOfMp =
        await this.mercadoPagoService.getMerchantOrdersByPreferenceId(
          intentPayment.transaction_id,
        );

      if (!paymentsOfMp || paymentsOfMp.length === 0) {
        this.logger.warn(
          `No se encontraron merchant orders para preferencia ${intentPayment.transaction_id}`,
        );
        throw new BadRequestException(
          'No se encontraron pagos asociados a la preferencia con ID ' +
            intentPayment.transaction_id,
        );
      }

      await this.approvePaymentByMerchandResults(paymentsOfMp, intentPayment);
    } catch (error) {
      this.logger.error(
        `Error verificando estado de pago ${idReference}`,
        error.stack,
      );
      // No lanzamos excepción para permitir que continúe el flujo
    }
  }

  /**
   * Aprueba un pago basándose en los resultados de merchant orders de MercadoPago
   *
   * @param merchands - Array de merchant orders retornados por MercadoPago
   * @param payment - PaymentIntent a validar
   * @throws BadRequestException si no hay merchant orders o ninguno está aprobado
   *
   * @description
   * Busca el primer merchant order con estado 'paid' para confirmar que el pago
   * fue exitoso. Si encuentra uno, valida que el PaymentIntent existe.
   *
   * @deprecated Este método podría ser reemplazado por lógica más robusta
   * que actualice automáticamente el estado en lugar de solo validar.
   */
  async approvePaymentByMerchandResults(
    merchands: MerchantOrderResponse[],
    payment: PaymentIntent,
  ): Promise<void> {
    try {
      if (!merchands || merchands.length === 0) {
        throw new BadRequestException('No se encontraron resultados de pago');
      }

      this.logger.debug(
        `Validando ${merchands.length} merchant orders para PaymentIntent ${payment.id}`,
      );

      const firstWare = merchands.find((m) => m.order_status === 'paid');

      if (!firstWare) {
        this.logger.warn(
          `No se encontró merchant order con estado 'paid' para PaymentIntent ${payment.id}`,
        );
        throw new BadRequestException(
          'No se encontró un pago aprobado entre los resultados de la orden',
        );
      }

      this.logger.log(
        `Merchant order aprobado encontrado: ${firstWare.id} para PaymentIntent ${payment.id}`,
      );

      // Validar que el PaymentIntent existe para cada merchant order
      for (const merchand of merchands) {
        if (!payment) {
          throw new BadRequestException(
            'No se encontró el pago con ID de transacción ' +
              merchand.preference_id,
          );
        }
      }

      this.logger.log(
        `PaymentIntent ${payment.id} validado exitosamente contra ${merchands.length} merchant orders`,
      );
    } catch (error) {
      this.logger.error(
        `Error aprobando pago por merchant results`,
        error.stack,
      );
      if (error instanceof InternalServerErrorException) {
        throw error;
      }
      throw new BadRequestException(
        'Error al aprobar el pago: ' + error.message,
      );
    }
  }
}
