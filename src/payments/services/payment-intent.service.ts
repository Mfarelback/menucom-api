import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { MercadopagoService } from './mercado_pago.service';
import { MercadoPagoOAuthService } from './mercado-pago-oauth.service';
import { PaymentsRepository } from '../repository/payment_repository';
import { PaymentIntent } from '../entities/payment_intent_entity';
import { v4 as uuidv4 } from 'uuid';
import { PaymentStatusType } from 'src/config';
import { LoggerService } from 'src/core/logger/logger.service';

/**
 * Servicio especializado en gestión de PaymentIntent
 *
 * Responsabilidades:
 * - Crear pagos con preferencias de MercadoPago
 * - Gestionar OAuth y collector_id para marketplace
 * - CRUD básico de PaymentIntent
 * - Consultas a MercadoPago API
 *
 * @see PaymentIntent entity
 * @see MercadopagoService para integración con MP
 */
@Injectable()
export class PaymentIntentService {
  constructor(
    private readonly mercadoPagoService: MercadopagoService,
    private readonly mercadoPagoOAuthService: MercadoPagoOAuthService,
    private readonly paymentIntentRepository: PaymentsRepository,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext('PaymentIntentService');
  }

  /**
   * Crea un PaymentIntent y una preferencia de pago en MercadoPago
   *
   * @param phone - Teléfono del usuario que realiza el pago
   * @param amount - Monto del pago en ARS
   * @param description - Descripción del pago (opcional)
   * @param ownerId - ID del vendedor/propietario (para marketplace)
   * @param anonymousId - ID de usuario anónimo (opcional)
   * @param orderId - ID de la orden asociada (opcional)
   * @param marketplaceFeeAmount - Comisión del marketplace en ARS (opcional)
   * @returns PaymentIntent creado con init_point de MercadoPago
   * @throws BadRequestException si faltan parámetros o hay error en MP
   *
   * @example
   * ```typescript
   * const payment = await this.paymentIntentService.createPayment(
   *   '+5491112345678',
   *   1000,
   *   'Pizza Margarita',
   *   'owner-uuid',
   *   null,
   *   'order-uuid',
   *   100 // 10% fee
   * );
   * ```
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
    try {
      if (!phone || !amount) {
        throw new BadRequestException(
          'El teléfono del usuario y el monto de la orden no pueden estar vacíos',
        );
      }

      this.logger.log(
        `Creando pago - Phone: ${phone}, Amount: ${amount}, Owner: ${ownerId || 'none'}`,
      );

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
            `No se pudo obtener account data para owner ${ownerId}: ${error.message}`,
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
          `Creando preferencia con collector_id: ${accountData.collectorId} para owner: ${ownerId}`,
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
          `Creando preferencia sin collector_id para owner: ${ownerId || 'no owner'}`,
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

      this.logger.log(
        `PaymentIntent creado exitosamente: ${payment.id} (MP: ${payment.transaction_id})`,
      );

      return payment;
    } catch (error) {
      this.logger.error(`Error creando pago para phone ${phone}`, error.stack);
      if (error instanceof InternalServerErrorException) {
        throw error;
      }
      throw new BadRequestException(
        'Error al crear el pago con Mercado Pago: ' + error.message,
      );
    }
  }

  /**
   * Obtiene un PaymentIntent por su ID
   *
   * @param id - UUID del PaymentIntent
   * @returns PaymentIntent encontrado
   * @throws BadRequestException si no existe o hay error
   */
  async getIntentPaymentById(id: string): Promise<PaymentIntent> {
    try {
      if (!id) {
        throw new BadRequestException('El ID del pago no puede estar vacío');
      }

      this.logger.debug(`Buscando PaymentIntent con ID: ${id}`);

      const intentPayment =
        await this.paymentIntentRepository.getPaymentById(id);

      if (!intentPayment) {
        throw new BadRequestException(
          'No se encontró un pago con el ID proporcionado',
        );
      }

      return intentPayment;
    } catch (error) {
      this.logger.error(`Error obteniendo PaymentIntent ${id}`, error.stack);
      if (error instanceof InternalServerErrorException) {
        throw error;
      }
      throw new BadRequestException(
        'Error al obtener el pago con ID ' + id + ': ' + error.message,
      );
    }
  }

  /**
   * Obtiene un PaymentIntent con información adicional de MercadoPago
   *
   * @param id - UUID del PaymentIntent
   * @returns Objeto con PaymentIntent y merchant orders de MercadoPago
   * @throws BadRequestException si no existe o hay error
   */
  async getPaymentById(id: string): Promise<any> {
    try {
      if (!id) {
        throw new BadRequestException('El ID del pago no puede estar vacío');
      }

      this.logger.debug(`Obteniendo PaymentIntent completo: ${id}`);

      const intentPayment =
        await this.paymentIntentRepository.getPaymentById(id);

      if (!intentPayment) {
        throw new BadRequestException(
          'No se encontró un pago con el ID proporcionado',
        );
      }

      // Obtener información de merchant orders desde MercadoPago
      const paymentsOfMp =
        await this.mercadoPagoService.getMerchantOrdersByPreferenceId(
          intentPayment.transaction_id,
        );

      return {
        paymentIntent: intentPayment,
        paymentsOfMp: paymentsOfMp,
      };
    } catch (error) {
      this.logger.error(`Error obteniendo payment completo ${id}`, error.stack);
      if (error instanceof InternalServerErrorException) {
        throw error;
      }
      throw new BadRequestException(
        'Error al obtener el pago con ID ' + id + ': ' + error.message,
      );
    }
  }

  /**
   * Consulta merchant orders de MercadoPago por ID de preferencia
   *
   * @param preferenceId - ID de la preferencia de MercadoPago
   * @returns Array de merchant orders asociados
   * @throws BadRequestException si no hay resultados o hay error
   */
  async consultPaymentByPreferenceID(preferenceId: string): Promise<any> {
    try {
      if (!preferenceId) {
        throw new BadRequestException(
          'El ID de preferencia no puede estar vacío',
        );
      }

      this.logger.debug(
        `Consultando merchant orders para preferencia: ${preferenceId}`,
      );

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
      this.logger.error(
        `Error consultando preferencia ${preferenceId}`,
        error.stack,
      );
      if (error instanceof InternalServerErrorException) {
        throw error;
      }
      throw new BadRequestException(
        'Error al consultar el pago con ID de preferencia ' +
          preferenceId +
          ': ' +
          error.message,
      );
    }
  }
}
