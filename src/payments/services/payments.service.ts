import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { MercadopagoService } from './mercado_pago.service';
import { PaymentsRepository } from '../repository/payment_repository';
import { PaymentIntent } from '../entities/payment_intent_entity';
import { v4 as uuidv4 } from 'uuid';
// import { PaymentStatusType } from 'src/core/constants';
import { MerchantOrderResponse } from 'mercadopago/dist/clients/merchantOrder/commonTypes';
import { PaymentStatusType } from 'src/config';
// import { PaymentSearchResult } from 'mercadopago/dist/clients/payment/search/types';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly mercadoPagoService: MercadopagoService,
    private readonly paymentIntentRepository: PaymentsRepository,
  ) {}

  async createPayment(
    phone: string,
    amount: number,
    description?: string,
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

      const paymentMpID = await this.mercadoPagoService.createSimplePreference(
        paymentCreated.id,
        items,
        // payer,
      );
      paymentCreated.transaction_id = paymentMpID.id;
      paymentCreated.init_point =
        process.env.ENV === 'qa'
          ? paymentMpID.init_point
          : paymentMpID.sandbox_init_point;

      const payment =
        await this.paymentIntentRepository.createPayment(paymentCreated);

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
}
