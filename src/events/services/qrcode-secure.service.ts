import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

/**
 * Estructura de un QR Code seguro deserializado
 */
export interface SecureQRData {
  /** ID del ticket */
  ticketId: string;
  /** ID de la compra */
  purchaseId: string;
  /** ID del tipo de ticket */
  ticketTypeId: string;
  /** ID del evento */
  eventId: string;
  /** Timestamp de generación (Unix ms) */
  timestamp: number;
  /** Firma HMAC SHA256 */
  signature: string;
}

/**
 * Servicio para generación y validación de códigos QR seguros
 *
 * Utiliza HMAC SHA256 para firmar los datos del ticket, previniendo:
 * - Falsificación de tickets
 * - Replicación de tickets
 * - Modificación de datos
 *
 * @example
 * ```typescript
 * // Generar QR seguro
 * const qrCode = await this.qrService.generateSecureQR({
 *   ticketId: 'uuid-ticket',
 *   purchaseId: 'uuid-purchase',
 *   ticketTypeId: 'uuid-type',
 *   eventId: 'uuid-event'
 * });
 *
 * // Validar QR
 * const isValid = await this.qrService.validateSecureQR(qrCode);
 * ```
 */
@Injectable()
export class QRCodeSecureService {
  private readonly logger = new Logger(QRCodeSecureService.name);

  // Clave secreta para firmar los QR (debe configurarse en env)
  private readonly secretKey: string;

  // Tiempo de expiración del QR (7 días por defecto)
  private readonly qrExpirationMs: number = 7 * 24 * 60 * 60 * 1000;

  constructor() {
    this.secretKey = process.env.TICKET_QR_SECRET!;
  }

  /**
   * Genera un código QR seguro con firma HMAC
   *
   * @param data Datos del ticket a incluir en el QR
   * @returns String codificado en base64url con todos los datos firmados
   */
  generateSecureQR(
    data: Omit<SecureQRData, 'timestamp' | 'signature'>,
  ): string {
    const timestamp = Date.now();

    // Crear payload sin firma
    const payload = {
      ...data,
      timestamp,
    };

    // Generar firma HMAC
    const signature = this.generateHmacSignature(payload);

    // Combinar todo en un objeto final
    const qrData: SecureQRData = {
      ...payload,
      signature,
    };

    // Codificar a base64url para hacerlo compacto y URL-safe
    const qrString = this.encodeToBase64Url(qrData);

    this.logger.debug(`Generated secure QR for ticket: ${data.ticketId}`);

    return qrString;
  }

  /**
   * Valida un código QR seguro
   *
   * @param qrCode Código QR generado por generateSecureQR
   * @returns Datos del ticket si es válido, null si es inválido
   */
  validateSecureQR(qrCode: string): SecureQRData | null {
    try {
      // Decodificar el QR
      const data = this.decodeFromBase64Url(qrCode);

      if (!data || !data.signature) {
        this.logger.warn('Invalid QR format: missing data or signature');
        return null;
      }

      // Verificar expiración
      const now = Date.now();
      const age = now - data.timestamp;

      if (age > this.qrExpirationMs) {
        this.logger.warn(
          `QR expired for ticket: ${data.ticketId}, age: ${age}ms`,
        );
        return null;
      }

      // Recalcular firma y comparar
      const payload = {
        ticketId: data.ticketId,
        purchaseId: data.purchaseId,
        ticketTypeId: data.ticketTypeId,
        eventId: data.eventId,
        timestamp: data.timestamp,
      };

      const expectedSignature = this.generateHmacSignature(payload);

      // Comparación timing-safe para prevenir timing attacks
      const isValid = crypto.timingSafeEqual(
        Buffer.from(data.signature, 'hex'),
        Buffer.from(expectedSignature, 'hex'),
      );

      if (!isValid) {
        this.logger.warn(`Invalid signature for ticket: ${data.ticketId}`);
        return null;
      }

      this.logger.debug(`Valid QR for ticket: ${data.ticketId}`);
      return data;
    } catch (error) {
      this.logger.error(
        'Error validating QR:',
        error instanceof Error ? error.stack : String(error),
      );
      return null;
    }
  }

  /**
   * Extrae datos de un QR sin validar la firma
   * Útil para obtener información básica antes de validación completa
   *
   * @param qrCode Código QR
   * @returns Datos extraídos o null si el formato es inválido
   */
  extractQRData(qrCode: string): Omit<SecureQRData, 'signature'> | null {
    try {
      const data = this.decodeFromBase64Url(qrCode);
      if (!data) return null;

      const { signature, ...rest } = data;
      return rest;
    } catch (error) {
      return null;
    }
  }

  /**
   * Genera firma HMAC SHA256 para los datos del payload
   */
  private generateHmacSignature(
    payload: Omit<SecureQRData, 'signature'>,
  ): string {
    // Crear string canonico ordenado alfabéticamente para consistencia
    const canonicalString = JSON.stringify(
      payload,
      Object.keys(payload).sort(),
    );

    return crypto
      .createHmac('sha256', this.secretKey)
      .update(canonicalString)
      .digest('hex');
  }

  /**
   * Codifica datos a base64url (URL-safe base64)
   */
  private encodeToBase64Url(data: SecureQRData): string {
    const json = JSON.stringify(data);
    return Buffer.from(json).toString('base64url');
  }

  /**
   * Decodifica datos desde base64url
   */
  private decodeFromBase64Url(qrCode: string): SecureQRData | null {
    try {
      const json = Buffer.from(qrCode, 'base64url').toString('utf-8');
      return JSON.parse(json) as SecureQRData;
    } catch (error) {
      this.logger.error(
        'Error decoding QR:',
        error instanceof Error ? error.stack : String(error),
      );
      return null;
    }
  }
}
