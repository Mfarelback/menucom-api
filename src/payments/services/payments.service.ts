import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { MercadopagoService } from './mercado_pago.service';
import { MercadoPagoOAuthService } from './mercado-pago-oauth.service';
import { PaymentsRepository } from '../repository/payment_repository';
import { PaymentIntent } from '../entities/payment_intent_entity';
import { v4 as uuidv4 } from 'uuid';
// import { PaymentStatusType } from 'src/core/constants';
import { MerchantOrderResponse } from 'mercadopago/dist/clients/merchantOrder/commonTypes';
import { PaymentStatusType } from 'src/config';
import { OrdersService } from 'src/orders/services/orders.service';
// import { PaymentSearchResult } from 'mercadopago/dist/clients/payment/search/types';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly mercadoPagoService: MercadopagoService,
    private readonly mercadoPagoOAuthService: MercadoPagoOAuthService,
    private readonly paymentIntentRepository: PaymentsRepository,
    @Inject(forwardRef(() => OrdersService))
    private readonly ordersService: OrdersService,
  ) {}

  async createPayment(
    phone: string,
    amount: number,
    description?: string,
    ownerId?: string,
  ): Promise<PaymentIntent> {
    try {
      if (!phone || !amount) {
        throw new BadRequestException(
          'El teléfono del usuario y el monto de la orden no pueden estar vacíos',
        );
      }

      const paymentCreated = new PaymentIntent();

      paymentCreated.id = uuidv4();
      paymentCreated.state = PaymentStatusType.PENDING;
      paymentCreated.user_id = phone;
      paymentCreated.amount = amount;

      // Crear items para MercadoPago
      const items = [
        {
          title: description || 'Pago de servicio',
          description:
            description || 'Pago realizado a través de la plataforma',
          quantity: 1,
          currency_id: 'ARS',
          unit_price: amount,
        },
      ];

      // Buscar collector_id si se proporciona ownerId
      let collectorId: number | null = null;
      if (ownerId) {
        try {
          collectorId =
            await this.mercadoPagoOAuthService.getCollectorIdByUserId(ownerId);
        } catch (error) {
          // Log el error pero continúa sin collector_id para compatibilidad
          console.warn(
            `Could not get collector_id for owner ${ownerId}:`,
            error.message,
          );
        }
      }

      // Crear la preferencia con o sin collector_id
      let paymentMpID;
      if (collectorId) {
        console.log(
          `Creating preference with collector_id: ${collectorId} for owner: ${ownerId}`,
        );
        // Usar createPreference con collector_id para pagos con vendedor específico
        paymentMpID = await this.mercadoPagoService.createPreference({
          items,
          external_reference: paymentCreated.id,
          collector_id: collectorId,
        });
      } else {
        console.log(
          `Creating preference without collector_id for owner: ${ownerId || 'no owner'}`,
        );
        // Usar createSimplePreference para pagos normales (sin vendedor específico)
        paymentMpID = await this.mercadoPagoService.createSimplePreference(
          paymentCreated.id,
          items,
        );
      }

      paymentCreated.transaction_id = paymentMpID.id;
      paymentCreated.init_point =
        process.env.ENV === 'qa'
          ? paymentMpID.init_point
          : paymentMpID.sandbox_init_point;

      const payment =
        await this.paymentIntentRepository.createPayment(paymentCreated);

      return payment;

      return payment;
    } catch (error) {
      if (error instanceof InternalServerErrorException) {
        throw error;
      }
      throw new BadRequestException(
        'Error al crear el pago con Mercado Pago: ' + error,
      );
    }
  }

  async getIntentPaymentById(id: string): Promise<PaymentIntent> {
    try {
      if (!id) {
        throw new BadRequestException('El ID del pago no puede estar vacío');
      }

      const intentPayment =
        await this.paymentIntentRepository.getPaymentById(id);

      if (!intentPayment) {
        throw new BadRequestException(
          'No se encontró un pago con el ID proporcionado',
        );
      }

      return intentPayment;
    } catch (error) {
      if (error instanceof InternalServerErrorException) {
        throw error;
      }
      throw new BadRequestException(
        'Error al obtener el pago con ID ' + id + ': ' + error,
      );
    }
  }

  async getPaymentById(id: string): Promise<any> {
    try {
      if (!id) {
        throw new BadRequestException('El ID del pago no puede estar vacío');
      }

      const intentPayment =
        await this.paymentIntentRepository.getPaymentById(id);

      // Si no es array, se asume que es un solo pago (uno)
      const paymentsOfMp =
        await this.mercadoPagoService.getMerchantOrdersByPreferenceId(
          intentPayment.transaction_id,
        );

      return {
        paymentIntent: intentPayment,
        paymentsOfMp: paymentsOfMp,
      };
    } catch (error) {
      if (error instanceof InternalServerErrorException) {
        throw error;
      }
      throw new BadRequestException(
        'Error al obtener el pago con ID ' + id + ': ' + error,
      );
    }
  }

  async consultPaymentByPreferenceID(preferenceId: string): Promise<any> {
    try {
      if (!preferenceId) {
        throw new BadRequestException(
          'El ID de preferencia no puede estar vacío',
        );
      }

      const paymentsOfMp =
        await this.mercadoPagoService.getMerchantOrdersByPreferenceId(
          preferenceId,
        );

      if (!paymentsOfMp || paymentsOfMp.length === 0) {
        throw new BadRequestException(
          'No se encontraron pagos asociados a la preferencia con ID ' +
            preferenceId,
        );
      }

      return paymentsOfMp;
    } catch (error) {
      if (error instanceof InternalServerErrorException) {
        throw error;
      }
      throw new BadRequestException(
        'Error al consultar el pago con ID de preferencia ' +
          preferenceId +
          ': ' +
          error,
      );
    }
  }

  async checkPaymentStatus(idReference: string): Promise<void> {
    try {
      if (!idReference) {
        throw new BadRequestException(
          'El idReference del pago no puede estar vacío',
        );
      }

      const intentPayment =
        await this.paymentIntentRepository.getPaymentById(idReference);

      // Si no es array, se asume que es un solo pago (uno)
      const paymentsOfMp =
        await this.mercadoPagoService.getMerchantOrdersByPreferenceId(
          intentPayment.transaction_id,
        );
      if (!paymentsOfMp || paymentsOfMp.length === 0) {
        throw new BadRequestException(
          'No se encontraron pagos asociados a la preferencia con ID ' +
            intentPayment.transaction_id,
        );
      }

      await this.approvePaymentByMerchandResults(paymentsOfMp, intentPayment);
    } catch (error) {}
  }

  async approvePaymentByMerchandResults(
    merchands: MerchantOrderResponse[],
    payment: PaymentIntent,
  ): Promise<void> {
    try {
      if (!merchands || merchands.length === 0) {
        throw new BadRequestException('No se encontraron resultados de pago');
      }

      const firstWare = merchands.find((m) => m.order_status === 'paid');

      if (!firstWare) {
        throw new BadRequestException(
          'No se encontró un pago aprobado entre los resultados de la orden',
        );
      }

      for (const merchand of merchands) {
        if (!payment) {
          throw new BadRequestException(
            'No se encontró el pago con ID de transacción ' +
              merchand.preference_id,
          );
        }
      }
    } catch (error) {
      if (error instanceof InternalServerErrorException) {
        throw error;
      }
      throw new BadRequestException('Error al aprobar el pago: ' + error);
    }
  }

  /**
   * Actualiza el estado del PaymentIntent basado en el estado del pago de MercadoPago
   */
  async updatePaymentIntentStatus(
    paymentIntentId: string,
    mpPaymentStatus: string,
  ): Promise<PaymentIntent> {
    try {
      let newStatus: string;

      // Mapear estados de MercadoPago a nuestros estados
      switch (mpPaymentStatus) {
        case 'approved':
          newStatus = PaymentStatusType.APPROVED;
          break;
        case 'pending':
        case 'in_process':
          newStatus = PaymentStatusType.IN_PROCESS;
          break;
        case 'rejected':
        case 'cancelled':
          newStatus = PaymentStatusType.REJECTED;
          break;
        case 'refunded':
          newStatus = PaymentStatusType.REFUNDED;
          break;
        default:
          newStatus = PaymentStatusType.PENDING;
      }

      return await this.paymentIntentRepository.changeStatusPayment(
        paymentIntentId,
        newStatus,
      );
    } catch (error) {
      throw new BadRequestException(
        `Error al actualizar el estado del PaymentIntent: ${error.message}`,
      );
    }
  }

  /**
   * Procesa las notificaciones del webhook de MercadoPago y actualiza los estados correspondientes
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
        console.log('[Webhook Processor] Procesando payment ID:', paymentId);

        // Obtener información del pago desde MercadoPago
        const paymentInfo =
          await this.mercadoPagoService.getPaymentInfo(paymentId);
        orderId =
          paymentInfo.external_reference || paymentInfo.order_id || null;
        paymentStatus = paymentInfo.status;

        console.log(
          '[Webhook Processor] Payment status:',
          paymentStatus,
          'OrderId:',
          orderId,
        );

        if (orderId && paymentStatus) {
          // Actualizar el PaymentIntent
          try {
            updatedPaymentIntent = await this.updatePaymentIntentStatus(
              orderId,
              paymentStatus,
            );
            console.log(
              '[Webhook Processor] PaymentIntent actualizado:',
              updatedPaymentIntent.state,
            );
          } catch (error) {
            console.warn(
              '[Webhook Processor] Error actualizando PaymentIntent:',
              error.message,
            );
          }

          // Actualizar la Order
          try {
            const orderStatus =
              this.mapPaymentStatusToOrderStatus(paymentStatus);
            const order = await this.ordersService.findByOperationId(orderId);

            if (order) {
              updatedOrder = await this.ordersService.updateOrderStatus(
                order.id,
                orderStatus,
              );
              console.log(
                '[Webhook Processor] Order actualizada:',
                updatedOrder.status,
              );
            } else {
              console.warn(
                '[Webhook Processor] No se encontró orden con operationID:',
                orderId,
              );
            }
          } catch (error) {
            console.warn(
              '[Webhook Processor] Error actualizando Order:',
              error.message,
            );
          }
        }
      }

      // Caso 2: Notificación de merchant_order
      if (merchantOrderId && !orderId) {
        console.log(
          '[Webhook Processor] Procesando merchant_order ID:',
          merchantOrderId,
        );
        orderId =
          await this.mercadoPagoService.getOrderIdByMerchantOrderId(
            merchantOrderId,
          );

        if (orderId) {
          // Para merchant_order, generalmente significa que el pago fue aprobado
          try {
            updatedPaymentIntent = await this.updatePaymentIntentStatus(
              orderId,
              'approved',
            );
            console.log(
              '[Webhook Processor] PaymentIntent actualizado via merchant_order',
            );
          } catch (error) {
            console.warn(
              '[Webhook Processor] Error actualizando PaymentIntent via merchant_order:',
              error.message,
            );
          }

          try {
            const order = await this.ordersService.findByOperationId(orderId);
            if (order) {
              updatedOrder = await this.ordersService.updateOrderStatus(
                order.id,
                'confirmed',
              );
              console.log(
                '[Webhook Processor] Order confirmada via merchant_order',
              );
            }
          } catch (error) {
            console.warn(
              '[Webhook Processor] Error actualizando Order via merchant_order:',
              error.message,
            );
          }
        }
      }

      return {
        orderId,
        paymentIntent: updatedPaymentIntent,
        order: updatedOrder,
        paymentStatus,
      };
    } catch (error) {
      console.error(
        '[Webhook Processor] Error procesando notificación:',
        error,
      );
      throw new BadRequestException(
        `Error procesando notificación del webhook: ${error.message}`,
      );
    }
  }

  /**
   * Mapea el estado del pago de MercadoPago al estado de la orden
   */
  private mapPaymentStatusToOrderStatus(mpPaymentStatus: string): string {
    switch (mpPaymentStatus) {
      case 'approved':
        return 'confirmed';
      case 'pending':
      case 'in_process':
        return 'pending';
      case 'rejected':
      case 'cancelled':
        return 'cancelled';
      case 'refunded':
        return 'cancelled';
      default:
        return 'pending';
    }
  }
}
