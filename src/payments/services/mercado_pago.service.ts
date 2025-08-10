import {
  Inject,
  Injectable,
  InternalServerErrorException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import * as MercadoPago from 'mercadopago';
import { v4 as uuidv4 } from 'uuid';

import { PaymentSearchResult } from 'mercadopago/dist/clients/payment/search/types';
import { MerchantOrderResponse } from 'mercadopago/dist/clients/merchantOrder/commonTypes';
import { PreferenceResponse } from 'mercadopago/dist/clients/preference/commonTypes';

import {
  CreatePreferenceOptions,
  PaymentSearchOptions,
  MerchantOrderSearchOptions,
  MercadoPagoItem,
  MercadoPagoPayer,
  MercadoPagoBackUrls,
} from '../interfaces/mercado-pago.interfaces';

@Injectable()
export class MercadopagoService {
  private readonly logger = new Logger(MercadopagoService.name);

  constructor(
    @Inject('MERCADOPAGO_CLIENT')
    private readonly client: MercadoPago.MercadoPagoConfig,
  ) {}

  /**
   * Crea una preferencia de pago en MercadoPago con opciones personalizables
   * @param options Opciones para crear la preferencia
   * @returns ID de la preferencia creada
   */
  async createPreference(options: CreatePreferenceOptions): Promise<string> {
    try {
      this.validateCreatePreferenceOptions(options);

      const paymentOrder = new MercadoPago.Preference(this.client);

      // Generar IDs únicos para items que no los tengan
      const itemsWithIds = options.items.map((item) => ({
        ...item,
        id: item.id || uuidv4(),
      }));

      // Configurar URLs de retorno por defecto si no se proporcionan
      const backUrls = this.buildBackUrls(options.back_urls);
      const preferenceBody = {
        items: itemsWithIds,
        external_reference: options.external_reference,
        ...(options.payer && { payer: options.payer }),
        ...(backUrls && { back_urls: backUrls }),
        ...(options.notification_url && {
          notification_url: options.notification_url,
        }),
        ...(options.auto_return && { auto_return: options.auto_return }),
        ...(options.payment_methods && {
          payment_methods: options.payment_methods,
        }),
        ...(options.shipments && { shipments: options.shipments }),
        ...(options.expires !== undefined && { expires: options.expires }),
        ...(options.expiration_date_from && {
          expiration_date_from: options.expiration_date_from,
        }),
        ...(options.expiration_date_to && {
          expiration_date_to: options.expiration_date_to,
        }),
        ...(options.statement_descriptor && {
          statement_descriptor: options.statement_descriptor,
        }),
      };

      this.logger.debug(
        'Creating preference with body:',
        JSON.stringify(preferenceBody, null, 2),
      );

      const orderGenerated = await paymentOrder.create({
        body: preferenceBody,
      });

      if (!orderGenerated.id) {
        throw new InternalServerErrorException(
          'No se pudo obtener el ID de la preferencia creada',
        );
      }

      this.logger.log(
        `Preference created successfully with ID: ${orderGenerated.id}`,
      );
      return orderGenerated.id;
    } catch (error) {
      this.logger.error('Error creating preference:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Error creando preferencia en MercadoPago: ${error.message || error}`,
      );
    }
  }

  /**
   * Obtiene el external_reference (orderId) de un pago de Mercado Pago por paymentId
   */
  async getOrderIdByPaymentId(paymentId: string): Promise<string | null> {
    try {
      const payment = new (MercadoPago as any).Payment(this.client);
      const result = await payment.get({ id: paymentId });
      return result.external_reference || result.order_id || null;
    } catch (e) {
      this.logger.error('Error fetching Mercado Pago payment:', e);
      return null;
    }
  }
  /**
   * Método de conveniencia para crear una preferencia simple
   * @param external_id Referencia externa
   * @param items Items de la preferencia
   * @param payer Información del pagador (opcional)
   * @returns ID de la preferencia creada
   */
  async createSimplePreference(
    external_id: string,
    items: MercadoPagoItem[],
    payer?: MercadoPagoPayer | { email?: string; phone?: string }, // Allow email or phone
  ): Promise<string> {
    let payerInfo: MercadoPagoPayer | undefined;

    if (payer) {
      if (typeof payer === 'object' && (payer.email || payer.phone)) {
        // Create a minimal payer object
        payerInfo = {
          email: payer.email,
          phone: payer.phone,
          // Add other minimal required fields if necessary based on MP documentation
        } as MercadoPagoPayer;
      } else {
        payerInfo = payer as MercadoPagoPayer; // Use the provided payer object directly
      }
    }

    const options: CreatePreferenceOptions = {
      items,
      external_reference: external_id,
      ...(payerInfo && { payer: payerInfo }),
      notification_url:
        process.env.MP_NOTIFICATION_URL ||
        'https://tu-dominio.com/payments/webhooks',
    };

    return this.createPreference(options);
  }

  /**
   * Busca pagos por diferentes criterios
   * @param searchOptions Opciones de búsqueda
   * @returns Resultados de la búsqueda
   */
  async searchPayments(
    searchOptions: PaymentSearchOptions,
  ): Promise<PaymentSearchResult[]> {
    try {
      if (!searchOptions || Object.keys(searchOptions).length === 0) {
        throw new BadRequestException(
          'Debe proporcionar al menos un criterio de búsqueda',
        );
      }

      const payment = new MercadoPago.Payment(this.client);
      const searchResult = await payment.search({
        options: searchOptions,
      });

      this.logger.debug(`Found ${searchResult.results?.length || 0} payments`);
      return searchResult.results || [];
    } catch (error) {
      this.logger.error('Error searching payments:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Error buscando pagos en MercadoPago: ${error.message || error}. ` +
          'Verifique los criterios de búsqueda y la configuración de MercadoPago.',
      );
    }
  }

  /**
   * Método de conveniencia para buscar pagos por referencia externa
   * @param externalReference Referencia externa
   * @returns Resultados de la búsqueda
   */
  async getPaymentsByExternalReference(
    externalReference: string,
  ): Promise<PaymentSearchResult[]> {
    if (!externalReference) {
      throw new BadRequestException(
        'La referencia externa no puede estar vacía',
      );
    }

    return this.searchPayments({ external_reference: externalReference });
  }

  /**
   * Busca merchant orders por diferentes criterios
   * @param searchOptions Opciones de búsqueda
   * @returns Merchant orders encontradas
   */
  async searchMerchantOrders(
    searchOptions: MerchantOrderSearchOptions,
  ): Promise<MerchantOrderResponse[]> {
    try {
      if (!searchOptions || Object.keys(searchOptions).length === 0) {
        throw new BadRequestException(
          'Debe proporcionar al menos un criterio de búsqueda',
        );
      }

      const merchantOrder = new MercadoPago.MerchantOrder(this.client);
      const searchResult = await merchantOrder.search({
        options: searchOptions,
      });

      this.logger.debug(
        `Found ${searchResult.elements?.length || 0} merchant orders`,
      );
      return searchResult.elements || [];
    } catch (error) {
      this.logger.error('Error searching merchant orders:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Error consultando merchant orders en MercadoPago: ${error.message || error}. ` +
          'Verifique los criterios de búsqueda y la configuración de MercadoPago.',
      );
    }
  }

  /**
   * Método de conveniencia para buscar merchant orders por ID de preferencia
   * @param preferenceId ID de la preferencia
   * @returns Merchant orders encontradas
   */
  async getMerchantOrdersByPreferenceId(
    preferenceId: string,
  ): Promise<MerchantOrderResponse[]> {
    if (!preferenceId) {
      throw new BadRequestException(
        'El ID de preferencia no puede estar vacío',
      );
    }

    return this.searchMerchantOrders({ preference_id: preferenceId });
  }

  /**
   * Obtiene una preferencia por su ID
   * @param preferenceId ID de la preferencia
   * @returns Datos de la preferencia
   */
  async getPreferenceById(preferenceId: string): Promise<PreferenceResponse> {
    try {
      if (!preferenceId) {
        throw new BadRequestException(
          'El ID de preferencia no puede estar vacío',
        );
      }

      const preference = new MercadoPago.Preference(this.client);
      const result = await preference.get({ preferenceId });

      this.logger.debug(`Retrieved preference: ${preferenceId}`);
      return result;
    } catch (error) {
      this.logger.error(`Error getting preference ${preferenceId}:`, error);
      throw new InternalServerErrorException(
        `Error obteniendo preferencia ${preferenceId}: ${error.message || error}`,
      );
    }
  }

  /**
   * Construye las URLs de retorno usando configuración por defecto si no se proporcionan
   * @param customBackUrls URLs personalizadas (opcional)
   * @returns URLs de retorno configuradas
   */
  private buildBackUrls(
    customBackUrls?: MercadoPagoBackUrls,
  ): MercadoPagoBackUrls | undefined {
    if (customBackUrls) {
      return customBackUrls;
    }

    const baseBackUrl = process.env.MP_BACK_URL;
    if (!baseBackUrl) {
      this.logger.warn('MP_BACK_URL not configured, back URLs will not be set');
      return undefined;
    }

    const checkoutPath = process.env.MP_CHECKOUT_PATH || '/#/checkout/status';

    return {
      success: `${baseBackUrl}${checkoutPath}?status=success`,
      failure: `${baseBackUrl}${checkoutPath}?status=failure`,
      pending: `${baseBackUrl}${checkoutPath}?status=pending`,
    };
  }

  /**
   * Valida las opciones para crear una preferencia
   * @param options Opciones a validar
   */
  private validateCreatePreferenceOptions(
    options: CreatePreferenceOptions,
  ): void {
    if (!options) {
      throw new BadRequestException(
        'Las opciones de preferencia son requeridas',
      );
    }

    if (!options.external_reference) {
      throw new BadRequestException('La referencia externa es requerida');
    }

    if (!options.items || options.items.length === 0) {
      throw new BadRequestException('Debe proporcionar al menos un item');
    }

    // Validar cada item
    options.items.forEach((item, index) => {
      if (!item.title) {
        throw new BadRequestException(
          `El título es requerido para el item ${index + 1}`,
        );
      }
      if (!item.currency_id) {
        throw new BadRequestException(
          `La moneda es requerida para el item ${index + 1}`,
        );
      }
      if (item.quantity <= 0) {
        throw new BadRequestException(
          `La cantidad debe ser mayor a 0 para el item ${index + 1}`,
        );
      }
      if (item.unit_price <= 0) {
        throw new BadRequestException(
          `El precio unitario debe ser mayor a 0 para el item ${index + 1}`,
        );
      }
    });

    // Eliminar la validación estricta del payer
    // if (!options.payer) {
    //   throw new BadRequestException('La información del pagador es requerida');
    // }
  }

  // Métodos de compatibilidad hacia atrás (deprecated)
  /**
   * @deprecated Use createSimplePreference or createPreference instead
   */
  async createPreferenceOld(external_id: string): Promise<string> {
    this.logger.warn(
      'Using deprecated createPreferenceOld method. Consider migrating to createPreference or createSimplePreference.',
    );

    const defaultItems: MercadoPagoItem[] = [
      {
        id: uuidv4(),
        title: 'Producto/Servicio',
        description: 'Descripción del producto o servicio',
        quantity: 1,
        currency_id: 'ARS',
        unit_price: 100,
      },
    ];

    const defaultPayer: MercadoPagoPayer = {
      name: 'Usuario',
      surname: 'Ejemplo',
      email: 'usuario@ejemplo.com',
      identification: {
        type: 'DNI',
        number: '12345678',
      },
    };

    return this.createSimplePreference(external_id, defaultItems, defaultPayer);
  }

  /**
   * @deprecated Use getPaymentsByExternalReference instead
   */
  async getPreferenceByPaymentIntentID(
    externalID: string,
  ): Promise<PaymentSearchResult[]> {
    this.logger.warn(
      'Using deprecated getPreferenceByPaymentIntentID method. Use getPaymentsByExternalReference instead.',
    );
    return this.getPaymentsByExternalReference(externalID);
  }
}
