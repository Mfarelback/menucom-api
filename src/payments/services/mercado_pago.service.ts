import {
  Inject,
  Injectable,
  InternalServerErrorException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import * as MercadoPago from 'mercadopago';
// import { v4 as uuidv4 } from 'uuid';

import { PaymentSearchResult } from 'mercadopago/dist/clients/payment/search/types';
import { MerchantOrderResponse } from 'mercadopago/dist/clients/merchantOrder/commonTypes';
import { PreferenceResponse } from 'mercadopago/dist/clients/preference/commonTypes';

import {
  CreatePreferenceOptions,
  PaymentSearchOptions,
  MerchantOrderSearchOptions,
  MercadoPagoItem,
  MercadoPagoPayer,
  // MercadoPagoBackUrls,
} from '../interfaces/mercado-pago.interfaces';
import { MercadoPagoHelpers } from './helpers/mercado-pago.helpers';
import { MercadoPagoRepository } from './repository/mercado-pago.repository';

@Injectable()
export class MercadopagoService {
  /**
   * Obtiene el external_reference (orderId) de una merchant_order de Mercado Pago por merchantOrderId
   */
  async getOrderIdByMerchantOrderId(
    merchantOrderId: string | number,
  ): Promise<string | null> {
    try {
      // El SDK de MP puede requerir número; convertir si llega como string numérica
      const idNum =
        typeof merchantOrderId === 'string'
          ? Number(merchantOrderId)
          : merchantOrderId;
      if (!Number.isFinite(idNum)) {
        this.logger.warn(
          `merchantOrderId no numérico recibido: ${merchantOrderId}`,
        );
        return null;
      }

      // Usar el repositorio centralizado
      const result = await this.mpRepo.getMerchantOrder(String(idNum));
      return (result as any)?.external_reference || null;
    } catch (e: any) {
      // Log estructurado para depurar mejor errores del SDK/HTTP
      this.logger.error(
        'Error fetching Mercado Pago merchant_order:',
        e?.message || e,
      );
      if (e && typeof e === 'object') {
        try {
          this.logger.error('Object:', JSON.stringify(e));
        } catch {}
      }
      this.logger.error(' With ID merch:\n' + merchantOrderId);
      return null;
    }
  }
  private readonly logger = new Logger(MercadopagoService.name);

  constructor(
    @Inject('MERCADOPAGO_CLIENT')
    private readonly client: MercadoPago.MercadoPagoConfig,
    private readonly mpRepo: MercadoPagoRepository,
  ) {}

  /**
   * Crea una preferencia de pago en MercadoPago con opciones personalizables
   * @param options Opciones para crear la preferencia
   * @returns ID de la preferencia creada
   */
  async createPreference(
    options: CreatePreferenceOptions,
  ): Promise<PreferenceResponse> {
    try {
      MercadoPagoHelpers.validateCreatePreferenceOptions(options);

      // Generar IDs únicos para items que no los tengan
      const itemsWithIds = MercadoPagoHelpers.ensureItemsHaveIds(options.items);
      // Asignar category_id por defecto para reducir placeholders en la respuesta
      const defaultCategory = process.env.MP_ITEM_CATEGORY_ID || 'services';
      const itemsFinal = itemsWithIds.map((item) => ({
        ...item,
        category_id: item.category_id ?? (defaultCategory as any),
      }));

      // Configurar URLs de retorno por defecto si no se proporcionan
      const backUrls = MercadoPagoHelpers.buildBackUrls(options.back_urls);

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
      } else {
        // Incluir payment_methods vacío para evitar placeholders con ids vacíos en la respuesta
        paymentMethods = {
          excluded_payment_methods: [],
          excluded_payment_types: [],
        } as any;
      }

      // Asegurar que total_amount nunca sea null si hay items definidos
      const totalAmount = MercadoPagoHelpers.computeTotalAmount(
        itemsWithIds,
        (options as any).total_amount,
      );
      // Asegurar auto_return siempre en 'approved'
      const autoReturn = 'approved';

      // Sanitizar payer y completar con datos por defecto si faltan.
      // Nota: Según doc de MP, email es obligatorio y se recomienda DNI + nombre/apellido para mejorar scoring.
      let payer = MercadoPagoHelpers.sanitizePayer(options.payer);
      // Si no llega payer o llega vacío, usamos uno por defecto para sandbox/tests
      if (
        !payer ||
        (typeof payer === 'object' && Object.keys(payer).length === 0)
      ) {
        payer = {
          email: process.env.MP_TEST_PAYER_EMAIL || 'test_user@test.com',
        } as MercadoPagoPayer;
      }

      const preferenceBody: any = {
        items: itemsFinal,
        external_reference: options.external_reference,
        // Siempre enviamos payer válido; si no vienen datos, usamos default de sandbox.
        payer,
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
      const sanitizedPreferenceBody = MercadoPagoHelpers.removeEmptyDeep(
        preferenceBody,
        ['items', 'external_reference'],
      );

      this.logger.debug(
        'Creating preference with body:',
        JSON.stringify(sanitizedPreferenceBody, null, 2),
      );

      const orderGenerated = await this.mpRepo.createPreference(
        sanitizedPreferenceBody,
      );

      if (!orderGenerated.id) {
        throw new InternalServerErrorException(
          'No se pudo obtener el ID de la preferencia creada',
        );
      }

      this.logger.log(
        `Preference created successfully with ID: ${orderGenerated.id}`,
      );
      return orderGenerated;
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
      const result = await this.mpRepo.getPayment(paymentId);
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
  ): Promise<PreferenceResponse> {
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

      const searchResult = await this.mpRepo.searchPayments(searchOptions);

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

      const searchResult =
        await this.mpRepo.searchMerchantOrders(searchOptions);

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

      const result = await this.mpRepo.getPreference(preferenceId);

      this.logger.debug(`Retrieved preference: ${preferenceId}`);
      return result;
    } catch (error) {
      this.logger.error(`Error getting preference ${preferenceId}:`, error);
      throw new InternalServerErrorException(
        `Error obteniendo preferencia ${preferenceId}: ${error.message || error}`,
      );
    }
  }

  // /**
  //  * Construye las URLs de retorno usando configuración por defecto si no se proporcionan
  //  * @param customBackUrls URLs personalizadas (opcional)
  //  * @returns URLs de retorno configuradas
  //  */
  // private buildBackUrls(
  //   customBackUrls?: MercadoPagoBackUrls,
  // ): MercadoPagoBackUrls | undefined {
  //   return MercadoPagoHelpers.buildBackUrls(customBackUrls);
  // }
}
