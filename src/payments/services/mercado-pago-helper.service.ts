import { Injectable, Logger } from '@nestjs/common';
import { MercadopagoService } from './mercado_pago.service';
import {
  MercadoPagoItem,
  MercadoPagoPayer,
  CreatePreferenceOptions,
} from '../interfaces/mercado-pago.interfaces';
import { PreferenceResponse } from 'mercadopago/dist/clients/preference/commonTypes';

/**
 * Servicio helper que proporciona métodos de conveniencia para casos de uso comunes
 * con MercadoPago, construido sobre el MercadopagoService base.
 */
@Injectable()
export class MercadoPagoHelperService {
  private readonly logger = new Logger(MercadoPagoHelperService.name);

  constructor(private readonly mercadoPagoService: MercadopagoService) {}

  /**
   * Crea una preferencia para un producto único
   * @param productName Nombre del producto
   * @param price Precio del producto
   * @param externalReference Referencia externa
   * @param userEmail Email del usuario (opcional)
   * @param userPhone Teléfono del usuario (opcional)
   * @returns ID de la preferencia creada
   */
  async createSingleProductPreference(
    productName: string,
    price: number,
    externalReference: string,
    userEmail?: string,
    userPhone?: string,
  ): Promise<PreferenceResponse> {
    const items: MercadoPagoItem[] = [
      {
        title: productName,
        quantity: 1,
        currency_id: 'ARS',
        unit_price: price,
      },
    ];

    const payer: MercadoPagoPayer = {};
    if (userEmail) payer.email = userEmail;
    if (userPhone) payer.phone = { number: userPhone };

    return this.mercadoPagoService.createSimplePreference(
      externalReference,
      items,
      Object.keys(payer).length > 0 ? payer : undefined,
    );
  }

  /**
   * Crea una preferencia para múltiples productos
   * @param products Array de productos con nombre, precio y cantidad
   * @param externalReference Referencia externa
   * @param userInfo Información del usuario (opcional)
   * @returns ID de la preferencia creada
   */
  async createMultipleProductsPreference(
    products: Array<{
      name: string;
      price: number;
      quantity: number;
      description?: string;
    }>,
    externalReference: string,
    userInfo?: {
      email?: string;
      phone?: string;
      name?: string;
      surname?: string;
      documentType?: string;
      documentNumber?: string;
    },
  ): Promise<PreferenceResponse> {
    const items: MercadoPagoItem[] = products.map((product) => ({
      title: product.name,
      description: product.description,
      quantity: product.quantity,
      currency_id: 'ARS',
      unit_price: product.price,
    }));

    let payer: MercadoPagoPayer | undefined;
    if (userInfo) {
      payer = {
        ...(userInfo.email && { email: userInfo.email }),
        ...(userInfo.phone && { phone: { number: userInfo.phone } }),
        ...(userInfo.name && { name: userInfo.name }),
        ...(userInfo.surname && { surname: userInfo.surname }),
        ...(userInfo.documentType &&
          userInfo.documentNumber && {
            identification: {
              type: userInfo.documentType,
              number: userInfo.documentNumber,
            },
          }),
      };
    }

    return this.mercadoPagoService.createSimplePreference(
      externalReference,
      items,
      payer,
    );
  }

  /**
   * Crea una preferencia para una suscripción o servicio recurrente
   * @param serviceName Nombre del servicio
   * @param monthlyPrice Precio mensual
   * @param externalReference Referencia externa
   * @param userInfo Información del usuario
   * @param customBackUrls URLs de retorno personalizadas (opcional)
   * @returns ID de la preferencia creada
   */
  async createSubscriptionPreference(
    serviceName: string,
    monthlyPrice: number,
    externalReference: string,
    userInfo: {
      email: string;
      name?: string;
      surname?: string;
      phone?: string;
    },
    customBackUrls?: {
      success?: string;
      failure?: string;
      pending?: string;
    },
  ): Promise<PreferenceResponse> {
    const items: MercadoPagoItem[] = [
      {
        title: `Suscripción - ${serviceName}`,
        description: `Suscripción mensual a ${serviceName}`,
        quantity: 1,
        currency_id: 'ARS',
        unit_price: monthlyPrice,
      },
    ];

    const payer: MercadoPagoPayer = {
      email: userInfo.email,
      ...(userInfo.name && { name: userInfo.name }),
      ...(userInfo.surname && { surname: userInfo.surname }),
      ...(userInfo.phone && { phone: { number: userInfo.phone } }),
    };

    const options: CreatePreferenceOptions = {
      items,
      external_reference: externalReference,
      payer,
      ...(customBackUrls && { back_urls: customBackUrls }),
      statement_descriptor: serviceName.substring(0, 22), // Máximo 22 caracteres
    };

    return this.mercadoPagoService.createPreference(options);
  }

  /**
   * Crea una preferencia con configuración avanzada para e-commerce
   * @param orderData Datos de la orden
   * @returns ID de la preferencia creada
   */
  async createEcommercePreference(orderData: {
    items: Array<{
      name: string;
      price: number;
      quantity: number;
      description?: string;
      category?: string;
      imageUrl?: string;
    }>;
    externalReference: string;
    customer: {
      email: string;
      name?: string;
      surname?: string;
      phone?: string;
      documentType?: string;
      documentNumber?: string;
      address?: {
        street: string;
        number: number;
        zipCode: string;
      };
    };
    shipping?: {
      cost: number;
      mode?: string;
    };
    paymentMethods?: {
      excludedPaymentMethods?: string[];
      excludedPaymentTypes?: string[];
      maxInstallments?: number;
    };
    backUrls?: {
      success?: string;
      failure?: string;
      pending?: string;
    };
    notificationUrl?: string;
  }): Promise<PreferenceResponse> {
    const items: MercadoPagoItem[] = orderData.items.map((item) => ({
      title: item.name,
      description: item.description,
      quantity: item.quantity,
      currency_id: 'ARS',
      unit_price: item.price,
      ...(item.category && { category_id: item.category }),
      ...(item.imageUrl && { picture_url: item.imageUrl }),
    }));

    const payer: MercadoPagoPayer = {
      email: orderData.customer.email,
      ...(orderData.customer.name && { name: orderData.customer.name }),
      ...(orderData.customer.surname && {
        surname: orderData.customer.surname,
      }),
      ...(orderData.customer.phone && {
        phone: { number: orderData.customer.phone },
      }),
      ...(orderData.customer.documentType &&
        orderData.customer.documentNumber && {
          identification: {
            type: orderData.customer.documentType,
            number: orderData.customer.documentNumber,
          },
        }),
      ...(orderData.customer.address && {
        address: {
          street_name: orderData.customer.address.street,
          street_number: orderData.customer.address.number,
          zip_code: orderData.customer.address.zipCode,
        },
      }),
    };

    const options: CreatePreferenceOptions = {
      items,
      external_reference: orderData.externalReference,
      payer,
      ...(orderData.backUrls && { back_urls: orderData.backUrls }),
      ...(orderData.notificationUrl && {
        notification_url: orderData.notificationUrl,
      }),
      ...(orderData.shipping && {
        shipments: {
          cost: orderData.shipping.cost,
          mode: orderData.shipping.mode || 'not_specified',
        },
      }),
      ...(orderData.paymentMethods && {
        payment_methods: {
          ...(orderData.paymentMethods.excludedPaymentMethods && {
            excluded_payment_methods:
              orderData.paymentMethods.excludedPaymentMethods.map((id) => ({
                id,
              })),
          }),
          ...(orderData.paymentMethods.excludedPaymentTypes && {
            excluded_payment_types:
              orderData.paymentMethods.excludedPaymentTypes.map((id) => ({
                id,
              })),
          }),
          ...(orderData.paymentMethods.maxInstallments && {
            installments: orderData.paymentMethods.maxInstallments,
          }),
        },
      }),
    };

    return this.mercadoPagoService.createPreference(options);
  }

  /**
   * Verifica si un pago está aprobado basándose en la referencia externa
   * @param externalReference Referencia externa
   * @returns true si el pago está aprobado, false en caso contrario
   */
  async isPaymentApproved(externalReference: string): Promise<boolean> {
    try {
      const payments =
        await this.mercadoPagoService.getPaymentsByExternalReference(
          externalReference,
        );

      return payments.some((payment) => payment.status === 'approved');
    } catch (error) {
      this.logger.error(
        `Error checking payment status for ${externalReference}:`,
        error,
      );
      return false;
    }
  }

  /**
   * Obtiene el estado detallado de un pago
   * @param externalReference Referencia externa
   * @returns Información detallada del estado del pago
   */
  async getPaymentStatus(externalReference: string): Promise<{
    status: 'approved' | 'pending' | 'rejected' | 'cancelled' | 'not_found';
    payments: any[];
    totalAmount?: number;
    approvedAmount?: number;
  }> {
    try {
      const payments =
        await this.mercadoPagoService.getPaymentsByExternalReference(
          externalReference,
        );

      if (payments.length === 0) {
        return {
          status: 'not_found',
          payments: [],
        };
      }

      const totalAmount = payments.reduce(
        (sum, payment) => sum + (payment.transaction_amount || 0),
        0,
      );
      const approvedPayments = payments.filter(
        (payment) => payment.status === 'approved',
      );
      const approvedAmount = approvedPayments.reduce(
        (sum, payment) => sum + (payment.transaction_amount || 0),
        0,
      );

      let status:
        | 'approved'
        | 'pending'
        | 'rejected'
        | 'cancelled'
        | 'not_found';

      if (approvedPayments.length > 0) {
        status = 'approved';
      } else if (payments.some((payment) => payment.status === 'pending')) {
        status = 'pending';
      } else if (payments.some((payment) => payment.status === 'rejected')) {
        status = 'rejected';
      } else if (payments.some((payment) => payment.status === 'cancelled')) {
        status = 'cancelled';
      } else {
        status = 'pending';
      }

      return {
        status,
        payments,
        totalAmount,
        approvedAmount,
      };
    } catch (error) {
      this.logger.error(
        `Error getting payment status for ${externalReference}:`,
        error,
      );
      return {
        status: 'not_found',
        payments: [],
      };
    }
  }
}
