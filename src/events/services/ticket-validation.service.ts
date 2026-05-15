import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { QRCodeSecureService, SecureQRData } from './qrcode-secure.service';

/**
 * Payload del JWT para validación offline de tickets
 */
export interface TicketValidationJWTPayload {
  /** ID del ticket */
  tid: string;
  /** ID de la compra */
  pid: string;
  /** ID del tipo de ticket */
  ttid: string;
  /** ID del evento */
  eid: string;
  /** Nombre del evento */
  ename: string;
  /** Fecha del evento (ISO) */
  edate: string;
  /** Nombre del tipo de ticket */
  ttname: string;
  /** Nombre del propietario */
  owner: string;
  /** Timestamp de emisión */
  iat: number;
  /** Timestamp de expiración */
  exp: number;
  /** Tipo de token */
  type: 'ticket_offline';
}

/**
 * Resultado de validación offline
 */
export interface OfflineValidationResult {
  /** Si la validación fue exitosa */
  valid: boolean;
  /** Datos del ticket si es válido */
  ticketData?: {
    ticketId: string;
    eventName: string;
    eventDate: string;
    ticketTypeName: string;
    ownerName: string;
    purchaseId: string;
  };
  /** Mensaje de error si no es válido */
  error?: string;
  /** Código de error */
  errorCode?: string;
}

/**
 * Servicio para validación offline de tickets mediante JWT
 * 
 * Este servicio permite:
 * 1. Generar JWTs firmados para validación sin conexión
 * 2. Validar JWTs de tickets sin necesidad de base de datos
 * 3. Verificar autenticidad mediante firma criptográfica
 * 
 * Ideal para:
 * - Validación en eventos con mala conectividad
 * - Apps móviles de validación
 * - Escáneres portátiles sin WiFi
 * 
 * @example
 * ```typescript
 * // Generar token offline
 * const jwt = await this.validationService.generateOfflineValidationToken(ticket);
 * 
 * // Validar token (sin DB)
 * const result = await this.validationService.validateOfflineToken(jwt);
 * if (result.valid) {
 *   console.log('Ticket válido:', result.ticketData);
 * }
 * ```
 */
@Injectable()
export class TicketValidationService {
  private readonly logger = new Logger(TicketValidationService.name);
  
  // Tiempo de validez del token offline (7 días)
  private readonly offlineTokenExpiryDays = 7;

  constructor(
    private readonly jwtService: JwtService,
    private readonly qrService: QRCodeSecureService,
  ) {}

  /**
   * Genera un token JWT para validación offline
   * 
   * Este token contiene toda la información necesaria para validar
   * un ticket sin acceso a la base de datos.
   * 
   * @param ticketData Datos completos del ticket
   * @returns Token JWT firmado
   */
  generateOfflineValidationToken(ticketData: {
    ticketId: string;
    purchaseId: string;
    ticketTypeId: string;
    ticketTypeName: string;
    eventId: string;
    eventName: string;
    eventDate: Date;
    ownerName: string;
    ownerEmail: string;
  }): string {
    const now = Math.floor(Date.now() / 1000);
    const exp = now + this.offlineTokenExpiryDays * 24 * 60 * 60;

    const payload: TicketValidationJWTPayload = {
      tid: ticketData.ticketId,
      pid: ticketData.purchaseId,
      ttid: ticketData.ticketTypeId,
      ttname: ticketData.ticketTypeName,
      eid: ticketData.eventId,
      ename: ticketData.eventName,
      edate: ticketData.eventDate.toISOString(),
      owner: ticketData.ownerName,
      iat: now,
      exp,
      type: 'ticket_offline',
    };

    const token = this.jwtService.sign(payload);
    
    this.logger.debug(
      `Generated offline validation token for ticket: ${ticketData.ticketId}`,
    );

    return token;
  }

  /**
   * Valida un token JWT de ticket offline
   * 
   * No requiere conexión a base de datos. Solo verifica:
   * - Firma criptográfica del JWT
   * - Fecha de expiración
   * - Formato del payload
   * 
   * @param token Token JWT a validar
   * @returns Resultado de la validación con datos del ticket
   */
  validateOfflineToken(token: string): OfflineValidationResult {
    try {
      // Verificar y decodificar el JWT
      const payload = this.jwtService.verify<TicketValidationJWTPayload>(token);

      // Validar tipo de token
      if (payload.type !== 'ticket_offline') {
        return {
          valid: false,
          error: 'Tipo de token inválido',
          errorCode: 'INVALID_TOKEN_TYPE',
        };
      }

      // Validar campos requeridos
      if (!payload.tid || !payload.pid || !payload.eid) {
        return {
          valid: false,
          error: 'Token incompleto',
          errorCode: 'INCOMPLETE_TOKEN',
        };
      }

      this.logger.debug(`Valid offline token for ticket: ${payload.tid}`);

      return {
        valid: true,
        ticketData: {
          ticketId: payload.tid,
          eventName: payload.ename,
          eventDate: payload.edate,
          ticketTypeName: payload.ttname,
          ownerName: payload.owner,
          purchaseId: payload.pid,
        },
      };
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return {
          valid: false,
          error: 'Token expirado',
          errorCode: 'TOKEN_EXPIRED',
        };
      }

      if (error.name === 'JsonWebTokenError') {
        this.logger.warn(`Invalid JWT signature: ${error.message}`);
        return {
          valid: false,
          error: 'Firma inválida',
          errorCode: 'INVALID_SIGNATURE',
        };
      }

      this.logger.error('Error validating offline token:', error.stack);
      return {
        valid: false,
        error: 'Error de validación',
        errorCode: 'VALIDATION_ERROR',
      };
    }
  }

  /**
   * Genera un código QR híbrido que contiene:
   * 1. Datos firmados con HMAC (seguridad offline)
   * 2. Token JWT para validación offline extendida
   * 
   * Este formato permite validación:
   * - Rápida con HMAC (solo verifica firma)
   * - Extendida con JWT (verifica + datos del evento)
   * 
   * @param qrData Datos del QR seguro
   * @param ticketData Datos adicionales para el JWT
   * @returns Objeto con ambos códigos
   */
  generateHybridQRCode(
    qrData: Parameters<QRCodeSecureService['generateSecureQR']>[0],
    ticketData: Parameters<TicketValidationService['generateOfflineValidationToken']>[0],
  ): {
    /** QR seguro con HMAC (formato compacto) */
    secureQR: string;
    /** Token JWT para validación offline extendida */
    offlineToken: string;
    /** QR combinado con ambos formatos */
    combinedQR: string;
  } {
    // Generar QR seguro con HMAC
    const secureQR = this.qrService.generateSecureQR(qrData);

    // Generar token JWT offline
    const offlineToken = this.generateOfflineValidationToken(ticketData);

    // Crear QR combinado (versión extendida)
    const combinedData = {
      v: 1, // Versión del formato
      qr: secureQR,
      jwt: offlineToken,
    };
    const combinedQR = Buffer.from(JSON.stringify(combinedData)).toString('base64url');

    this.logger.debug(
      `Generated hybrid QR for ticket: ${qrData.ticketId}`,
    );

    return {
      secureQR,
      offlineToken,
      combinedQR,
    };
  }

  /**
   * Valida un QR híbrido (formato combinado)
   * 
   * Intenta validar primero el JWT (más información)
   * Si falla, intenta validar el QR seguro HMAC
   * 
   * @param combinedQR QR en formato combinado
   * @returns Resultado de validación
   */
  validateHybridQR(combinedQR: string): OfflineValidationResult {
    try {
      // Decodificar el QR combinado
      const json = Buffer.from(combinedQR, 'base64url').toString('utf-8');
      const data = JSON.parse(json);

      // Validar versión
      if (data.v !== 1) {
        return {
          valid: false,
          error: 'Versión de QR no soportada',
          errorCode: 'UNSUPPORTED_VERSION',
        };
      }

      // Intentar validar JWT primero (tiene más datos)
      if (data.jwt) {
        const jwtResult = this.validateOfflineToken(data.jwt);
        if (jwtResult.valid) {
          return jwtResult;
        }
      }

      // Fallback: validar QR seguro HMAC
      if (data.qr) {
        const qrData = this.qrService.validateSecureQR(data.qr);
        if (qrData) {
          return {
            valid: true,
            ticketData: {
              ticketId: qrData.ticketId,
              eventName: 'Evento', // No disponible en QR HMAC básico
              eventDate: new Date().toISOString(),
              ticketTypeName: 'Ticket',
              ownerName: '',
              purchaseId: qrData.purchaseId,
            },
          };
        }
      }

      return {
        valid: false,
        error: 'QR inválido',
        errorCode: 'INVALID_QR',
      };
    } catch (error) {
      this.logger.error('Error validating hybrid QR:', error.stack);
      return {
        valid: false,
        error: 'Error de validación',
        errorCode: 'VALIDATION_ERROR',
      };
    }
  }

  /**
   * Extrae el ticketId de un QR sin validar
   * Útil para logging o prefetching
   */
  extractTicketId(qrCode: string): string | null {
    // Intentar extraer de QR seguro
    const qrData = this.qrService.extractQRData(qrCode);
    if (qrData?.ticketId) {
      return qrData.ticketId;
    }

    // Intentar extraer de QR combinado
    try {
      const json = Buffer.from(qrCode, 'base64url').toString('utf-8');
      const data = JSON.parse(json);
      if (data.qr) {
        const secureData = this.qrService.extractQRData(data.qr);
        return secureData?.ticketId || null;
      }
    } catch {
      // Ignorar errores de parseo
    }

    return null;
  }
}
