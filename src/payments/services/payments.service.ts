import { Injectable } from '@nestjs/common';
import { PaymentIntent } from '../entities/payment_intent_entity';
import { LoggerService } from 'src/core/logger/logger.service';
import { PaymentIntentService } from './payment-intent.service';
import { PaymentWebhookService } from './payment-webhook.service';
import { PaymentStatusService } from './payment-status.service';

/**
 * Servicio coordinador principal de pagos
 *
 * Actúa como fachada para los servicios especializados:
 * - PaymentIntentService: Creación y consulta de pagos
 * - PaymentWebhookService: Procesamiento de webhooks
 * - PaymentStatusService: Gestión de estados
 *
 * @description
 * Este servicio mantiene la interfaz pública original pero delega
 * toda la lógica de negocio a servicios especializados que cumplen
 * con el Single Responsibility Principle.
 *
 * @see PaymentIntentService para operaciones de pago
 * @see PaymentWebhookService para webhooks
 * @see PaymentStatusService para estados
 */
@Injectable()
export class PaymentsService {
  constructor(
    private readonly paymentIntentService: PaymentIntentService,
    private readonly paymentWebhookService: PaymentWebhookService,
    private readonly paymentStatusService: PaymentStatusService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext('PaymentsService');
  }

  /**
   * Crea un nuevo pago con preferencia de MercadoPago
   * @delegate PaymentIntentService.createPayment
   */
  async createPayment(
    phone: string,
    amount: number,
    description?: string,
    ownerId?: string,
    anonymousId?: string,
    orderId?: string,
    marketplaceFeeAmount?: number,
  ): Promise<PaymentIntent> {
    return this.paymentIntentService.createPayment(
      phone,
      amount,
      description,
      ownerId,
      anonymousId,
      orderId,
      marketplaceFeeAmount,
    );
  }

  /**
   * Obtiene un PaymentIntent por su ID
   * @delegate PaymentIntentService.getIntentPaymentById
   */
  async getIntentPaymentById(id: string): Promise<PaymentIntent> {
    return this.paymentIntentService.getIntentPaymentById(id);
  }

  /**
   * Obtiene un PaymentIntent con datos de MercadoPago
   * @delegate PaymentIntentService.getPaymentById
   */
  async getPaymentById(id: string): Promise<any> {
    return this.paymentIntentService.getPaymentById(id);
  }

  /**
   * Consulta merchant orders por ID de preferencia
   * @delegate PaymentIntentService.consultPaymentByPreferenceID
   */
  async consultPaymentByPreferenceID(preferenceId: string): Promise<any> {
    return this.paymentIntentService.consultPaymentByPreferenceID(preferenceId);
  }

  /**
   * Verifica el estado de un pago consultando MercadoPago
   * @delegate PaymentWebhookService.checkPaymentStatus
   */
  async checkPaymentStatus(idReference: string): Promise<void> {
    return this.paymentWebhookService.checkPaymentStatus(idReference);
  }

  /**
   * Aprueba un pago basándose en merchant orders
   * @delegate PaymentWebhookService.approvePaymentByMerchandResults
   */
  async approvePaymentByMerchandResults(
    merchands: any[],
    payment: PaymentIntent,
  ): Promise<void> {
    return this.paymentWebhookService.approvePaymentByMerchandResults(
      merchands,
      payment,
    );
  }

  /**
   * Actualiza el estado del PaymentIntent
   * @delegate PaymentStatusService.updatePaymentIntentStatus
   */
  async updatePaymentIntentStatus(
    paymentIntentId: string,
    mpPaymentStatus: string,
  ): Promise<PaymentIntent> {
    return this.paymentStatusService.updatePaymentIntentStatus(
      paymentIntentId,
      mpPaymentStatus,
    );
  }

  /**
   * Procesa notificaciones de webhook de MercadoPago
   * @delegate PaymentWebhookService.processWebhookNotification
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
    return this.paymentWebhookService.processWebhookNotification(
      paymentId,
      merchantOrderId,
    );
  }
}
