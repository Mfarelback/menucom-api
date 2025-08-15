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
  /**
   * Obtiene el external_reference (orderId) de una merchant_order de Mercado Pago por merchantOrderId
   */
  async getOrderIdByMerchantOrderId(
    merchantOrderId: string,
  ): Promise<string | null> {
    try {
      const merchantOrder = new (MercadoPago as any).MerchantOrder(this.client);
      const result = await merchantOrder.get({ id: merchantOrderId });
      return result.external_reference || null;
    } catch (e) {
      this.logger.error('Error fetching Mercado Pago merchant_order:', e);
      return null;
    }
  }
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

      // Limpiar payment_methods y excluir IDs vacíos. Si se envían, incluir arrays vacíos [] en vez de IDs vacíos.
      let paymentMethods = options.payment_methods as
        | {
            excluded_payment_methods?: Array<{ id: string }>;
            excluded_payment_types?: Array<{ id: string }>;
          }
        | undefined;
      if (paymentMethods) {
        const cleanArr = (arr?: Array<{ id: string }>) =>
          Array.isArray(arr)
            ? arr
                .filter(
                  (m) => m && typeof m.id === 'string' && m.id.trim() !== '',
                )
                .map((m) => ({ id: m.id.trim() }))
            : undefined;

        const cleanedExcludedMethods = cleanArr(
          paymentMethods.excluded_payment_methods,
        );
        const cleanedExcludedTypes = cleanArr(
          paymentMethods.excluded_payment_types,
        );
        // Si el objeto payment_methods fue provisto, enviamos arrays vacíos [] si quedaran sin exclusiones.
        paymentMethods = {
          excluded_payment_methods: cleanedExcludedMethods || [],
          excluded_payment_types: cleanedExcludedTypes || [],
        } as any;
      }

      // Asegurar que total_amount nunca sea null si hay items definidos
      let totalAmount = (options as any).total_amount;
      if ((!totalAmount || isNaN(totalAmount)) && itemsWithIds.length > 0) {
        totalAmount = itemsWithIds.reduce(
          (sum, item) => sum + item.unit_price * item.quantity,
          0,
        );
      }
      // Asegurar auto_return siempre en 'approved'
      const autoReturn = 'approved';

      // Sanitizar payer y completar con datos por defecto si faltan.
      // Nota: Según doc de MP, email es obligatorio y se recomienda DNI + nombre/apellido para mejorar scoring.
      const payer = this.sanitizePayer(options.payer);

      const preferenceBody: any = {
        items: itemsWithIds,
        external_reference: options.external_reference,
        // Siempre enviamos payer válido; si no vienen datos, usamos default de sandbox.
        ...(payer && { payer }),
        ...(backUrls && { back_urls: backUrls }),
        ...(options.notification_url && {
          notification_url: options.notification_url,
        }),
        auto_return: autoReturn,
        ...(paymentMethods && { payment_methods: paymentMethods }),
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
        // Si binary_mode fue provisto en options, lo propagamos
        ...((options as any).binary_mode !== undefined && {
          binary_mode: (options as any).binary_mode,
        }),
        // No incluir redirect_urls legacy
        ...(totalAmount && { total_amount: totalAmount }),
      };

      // Sanitizar el payload quitando claves vacías/null/"" no requeridas
      const sanitizedPreferenceBody = this.removeEmptyDeep(preferenceBody, [
        'items',
        'external_reference',
      ]);

      this.logger.debug(
        'Creating preference with body:',
        JSON.stringify(sanitizedPreferenceBody, null, 2),
      );

      const orderGenerated = await paymentOrder.create({
        body: sanitizedPreferenceBody,
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

  // Helpers de sanitización
  private isValidEmail(email?: string): boolean {
    if (!email) return false;
    // Regex simple y suficiente para validación básica
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
    return re.test(email.trim());
  }

  private digitsOnly(value?: string | number): string | undefined {
    if (value === undefined || value === null) return undefined;
    const str = String(value).replace(/\D+/g, '');
    return str.length > 0 ? str : undefined;
  }

  private sanitizePayer(
    payer?: MercadoPagoPayer,
  ): MercadoPagoPayer | undefined {
    if (!payer) return undefined;
    const sanitized: any = {};

    if (typeof payer.name === 'string' && payer.name.trim() !== '') {
      sanitized.name = payer.name.trim();
    }
    if (typeof payer.surname === 'string' && payer.surname.trim() !== '') {
      sanitized.surname = payer.surname.trim();
    }
    if (typeof (payer as any).email === 'string') {
      const email = (payer as any).email.trim();
      if (email) sanitized.email = email;
    }

    if ((payer as any).phone) {
      const phone = (payer as any).phone as any;
      const area = this.digitsOnly(phone.area_code);
      let number = this.digitsOnly(phone.number);
      if (number && number.length > 19) number = number.slice(0, 19);
      if (number) {
        sanitized.phone = {
          ...(area && { area_code: area }),
          number,
        };
      }
    }

    if ((payer as any).identification) {
      const id = (payer as any).identification as any;
      const type = typeof id.type === 'string' ? id.type.trim() : '';
      const number = typeof id.number === 'string' ? id.number.trim() : '';
      if (type && number) {
        sanitized.identification = { type, number };
      }
    }

    // Retornar undefined si quedó vacío para no enviar un payer incompleto
    return Object.keys(sanitized).length > 0
      ? (sanitized as MercadoPagoPayer)
      : undefined;
  }

  private removeEmptyDeep<T extends Record<string, any>>(
    obj: T,
    preserve: string[] = [],
  ): T {
    const isObject = (v: any) =>
      v && typeof v === 'object' && !Array.isArray(v);
    const clean = (input: any): any => {
      if (Array.isArray(input)) {
        const arr = input.map(clean).filter((v) => v !== undefined);
        return arr.length > 0 ? arr : undefined;
      }
      if (isObject(input)) {
        const out: Record<string, any> = {};
        for (const [k, v] of Object.entries(input)) {
          const cleaned = clean(v);
          if (
            cleaned !== undefined &&
            !(typeof cleaned === 'string' && cleaned.trim() === '')
          ) {
            out[k] = cleaned;
          }
        }
        if (Object.keys(out).length === 0) return undefined;
        return out;
      }
      if (input === null || input === undefined) return undefined;
      if (typeof input === 'string') {
        const t = input.trim();
        return t === '' ? undefined : t;
      }
      return input;
    };

    // Preservar claves requeridas si existen
    const cleaned = clean(obj) || {};
    for (const key of preserve) {
      if (obj[key] !== undefined && cleaned[key] === undefined) {
        (cleaned as any)[key] = obj[key];
      }
    }
    return cleaned as T;
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
