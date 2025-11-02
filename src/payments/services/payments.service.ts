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
import { MerchantOrderResponse } from 'mercadopago/dist/clients/merchantOrder/commonTypes';
import { PaymentStatusType } from 'src/config';
import { OrdersService } from 'src/orders/services/orders.service';
import { LoggerService } from 'src/core/logger/logger.service';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly mercadoPagoService: MercadopagoService,
    private readonly mercadoPagoOAuthService: MercadoPagoOAuthService,
    private readonly paymentIntentRepository: PaymentsRepository,
    @Inject(forwardRef(() => OrdersService))
    private readonly ordersService: OrdersService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext('PaymentsService');
  }

  async createPayment(
    phone: string,
    amount: number,
    description?: string,
    ownerId?: string,
    anonymousId?: string,
    orderId?: string,
    marketplaceFeeAmount?: number,
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
      let accountData: {
        collectorId: number;
        accessToken: string;
      } | null = null;
      if (ownerId) {
        try {
          accountData =
            await this.mercadoPagoOAuthService.getAccountDataForPreference(
              ownerId,
            );
        } catch (error) {
          // Log el error pero continúa sin collector_id para compatibilidad
          this.logger.warn(
            `Could not get account data for owner ${ownerId}: ${error.message}`,
          );
        }
      }

      // Crear metadata para trazabilidad
      const metadata: { [key: string]: any } = {
        payment_id: paymentCreated.id,
        ...(orderId && { order_id: orderId }),
        ...(ownerId && { owner_id: ownerId }),
        ...(anonymousId && { anonymous_id: anonymousId }),
        created_at: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
      };

      // Crear la preferencia con o sin collector_id
      let paymentMpID;
      if (accountData) {
        this.logger.log(
          `Creating preference with collector_id: ${accountData.collectorId} for owner: ${ownerId}`,
        );
        // Usar createPreferenceWithCustomToken para pagos con vendedor específico
        paymentMpID =
          await this.mercadoPagoService.createPreferenceWithCustomToken(
            {
              items,
              external_reference: paymentCreated.id,
              collector_id: accountData.collectorId,
              marketplace_fee: marketplaceFeeAmount, // <-- Propagamos el fee para Checkout Pro
              metadata,
            },
            accountData.accessToken,
          );
      } else {
        this.logger.log(
          `Creating preference without collector_id for owner: ${ownerId || 'no owner'}`,
        );
        // Usar createPreference para pagos normales con metadata incluida
        paymentMpID = await this.mercadoPagoService.createPreference({
          items,
          external_reference: paymentCreated.id,
          metadata,
        });
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
        this.logger.log(`Procesando payment ID: ${paymentId}`);

        // Obtener información del pago desde MercadoPago
        const paymentInfo =
          await this.mercadoPagoService.getPaymentInfo(paymentId);
        orderId =
          paymentInfo.external_reference || paymentInfo.order_id || null;
        paymentStatus = paymentInfo.status;

        this.logger.logObject('Payment status', {
          status: paymentStatus,
          orderId: orderId,
        });

        if (orderId && paymentStatus) {
          // Actualizar el PaymentIntent
          try {
            updatedPaymentIntent = await this.updatePaymentIntentStatus(
              orderId,
              paymentStatus,
            );
            this.logger.log(
              `PaymentIntent actualizado: ${updatedPaymentIntent.state}`,
            );
          } catch (error) {
            this.logger.warn(
              `Error actualizando PaymentIntent: ${error.message}`,
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
              this.logger.log(`Order actualizada: ${updatedOrder.status}`);
            } else {
              this.logger.warn(
                `No se encontró orden con operationID: ${orderId}`,
              );
            }
          } catch (error) {
            this.logger.warn(`Error actualizando Order: ${error.message}`);
          }
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
          // Para merchant_order, generalmente significa que el pago fue aprobado
          try {
            updatedPaymentIntent = await this.updatePaymentIntentStatus(
              orderId,
              'approved',
            );
            this.logger.log('PaymentIntent actualizado via merchant_order');
          } catch (error) {
            this.logger.warn(
              `Error actualizando PaymentIntent via merchant_order: ${error.message}`,
            );
          }

          try {
            const order = await this.ordersService.findByOperationId(orderId);
            if (order) {
              updatedOrder = await this.ordersService.updateOrderStatus(
                order.id,
                'confirmed',
              );
              this.logger.log('Order confirmada via merchant_order');
            }
          } catch (error) {
            this.logger.warn(
              `Error actualizando Order via merchant_order: ${error.message}`,
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
      this.logger.error(
        `Error procesando notificación: ${error.message}`,
        error.stack,
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
