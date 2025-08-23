import { Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import {
  CreatePreferenceOptions,
  MercadoPagoBackUrls,
  MercadoPagoItem,
  MercadoPagoPayer,
} from '../../interfaces/mercado-pago.interfaces';

export class MercadoPagoHelpers {
  private static readonly logger = new Logger(MercadoPagoHelpers.name);

  // Validate options for creating preference
  static validateCreatePreferenceOptions(
    options: CreatePreferenceOptions,
  ): void {
    if (!options) throw new Error('Las opciones de preferencia son requeridas');
    if (!options.external_reference)
      throw new Error('La referencia externa es requerida');
    if (!options.items || options.items.length === 0)
      throw new Error('Debe proporcionar al menos un item');

    options.items.forEach((item, index) => {
      if (!item.title) {
        throw new Error(`El título es requerido para el item ${index + 1}`);
      }
      if (!item.currency_id) {
        throw new Error(`La moneda es requerida para el item ${index + 1}`);
      }
      if (item.quantity <= 0) {
        throw new Error(
          `La cantidad debe ser mayor a 0 para el item ${index + 1}`,
        );
      }
      if (item.unit_price <= 0) {
        throw new Error(
          `El precio unitario debe ser mayor a 0 para el item ${index + 1}`,
        );
      }
    });
  }

  // Add IDs to items if missing
  static ensureItemsHaveIds(items: MercadoPagoItem[]): MercadoPagoItem[] {
    return items.map((item) => ({ ...item, id: item.id || uuidv4() }));
  }

  // Build default back URLs from env if not provided
  static buildBackUrls(
    customBackUrls?: MercadoPagoBackUrls,
  ): MercadoPagoBackUrls | undefined {
    if (customBackUrls) return customBackUrls;
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

  // Clean payment_methods
  static cleanPaymentMethods(paymentMethods?: {
    excluded_payment_methods?: Array<{ id: string }>;
    excluded_payment_types?: Array<{ id: string }>;
  }) {
    if (!paymentMethods) return undefined;
    const cleanArr = (arr?: Array<{ id: string }>) =>
      Array.isArray(arr)
        ? arr
            .filter((m) => m && typeof m.id === 'string' && m.id.trim() !== '')
            .map((m) => ({ id: m.id.trim() }))
        : undefined;
    const cleanedExcludedMethods = cleanArr(
      paymentMethods.excluded_payment_methods,
    );
    const cleanedExcludedTypes = cleanArr(
      paymentMethods.excluded_payment_types,
    );
    return {
      excluded_payment_methods: cleanedExcludedMethods || [],
      excluded_payment_types: cleanedExcludedTypes || [],
    } as any;
  }

  // Compute total amount from items if not provided
  static computeTotalAmount(
    items: MercadoPagoItem[],
    current?: number,
  ): number | undefined {
    const isNum = typeof current === 'number' && !isNaN(current);
    if (isNum) return current as number;
    if (!items || items.length === 0) return undefined;
    return items.reduce(
      (sum, item) => sum + item.unit_price * item.quantity,
      0,
    );
  }

  /**
   * Formatea el statement_descriptor según las reglas de MP:
   * - Máximo 22 caracteres
   * - Sin caracteres especiales no permitidos
   * - Retorna undefined si no hay un valor útil
   */
  static formatStatementDescriptor(input?: string): string | undefined {
    const source = (
      input ||
      process.env.MP_STATEMENT_DESCRIPTOR ||
      'menucom_buy'
    ).trim();
    if (!source) return undefined;
    // Permitir letras, números, espacio y algunos separadores comunes
    const cleaned = source.replace(/[^A-Za-z0-9 .,_-]/g, '').trim();
    if (!cleaned) return undefined;
    return cleaned.slice(0, 22);
  }

  private static digitsOnly(value?: string | number): string | undefined {
    if (value === undefined || value === null) return undefined;
    const str = String(value).replace(/\D+/g, '');
    return str.length > 0 ? str : undefined;
  }

  static sanitizePayer(payer?: MercadoPagoPayer): MercadoPagoPayer | undefined {
    if (!payer) return undefined;
    const sanitized: any = {};

    // Handle both name/surname (legacy) and first_name/last_name (MP preferred)
    if (typeof payer.name === 'string' && payer.name.trim() !== '') {
      sanitized.name = payer.name.trim();
      // Also set first_name if not explicitly provided
      if (!payer.first_name) {
        sanitized.first_name = payer.name.trim();
      }
    }
    if (typeof payer.surname === 'string' && payer.surname.trim() !== '') {
      sanitized.surname = payer.surname.trim();
      // Also set last_name if not explicitly provided
      if (!payer.last_name) {
        sanitized.last_name = payer.surname.trim();
      }
    }

    // Handle first_name and last_name explicitly (MP preferred fields)
    if (
      typeof (payer as any).first_name === 'string' &&
      (payer as any).first_name.trim() !== ''
    ) {
      sanitized.first_name = (payer as any).first_name.trim();
    }
    if (
      typeof (payer as any).last_name === 'string' &&
      (payer as any).last_name.trim() !== ''
    ) {
      sanitized.last_name = (payer as any).last_name.trim();
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

    return Object.keys(sanitized).length > 0
      ? (sanitized as MercadoPagoPayer)
      : undefined;
  }

  // Deep remove empty values
  static removeEmptyDeep<T extends Record<string, any>>(
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

    const cleaned = clean(obj) || {};
    for (const key of preserve) {
      if (
        (obj as any)[key] !== undefined &&
        (cleaned as any)[key] === undefined
      ) {
        (cleaned as any)[key] = (obj as any)[key];
      }
    }
    return cleaned as T;
  }

  /**
   * Valida si es necesario agregar datos mínimos de payer en ambientes de desarrollo
   * para evitar errores en MercadoPago cuando no se proporciona información de pagador
   */
  static shouldAddMinimalPayerForDev(
    payer?: MercadoPagoPayer,
    environment?: string,
  ): boolean {
    const env = environment || process.env.NODE_ENV || 'development';
    const isDev = env === 'development' || env === 'test';
    const hasNoPayer = !payer || Object.keys(payer).length === 0;

    return isDev && hasNoPayer;
  }

  /**
   * Crea un payer mínimo para desarrollo/testing
   */
  static createMinimalDevPayer(): MercadoPagoPayer {
    return {
      email: process.env.MP_TEST_PAYER_EMAIL || 'test_user@test.com',
      first_name: process.env.MP_TEST_PAYER_FIRST_NAME || 'Test',
      last_name: process.env.MP_TEST_PAYER_LAST_NAME || 'User',
    };
  }
}
