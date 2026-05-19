import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { TicketsService } from '../services/tickets.service';
import {
  TicketValidationService,
  OfflineValidationResult,
} from '../services/ticket-validation.service';
import { QRCodeSecureService } from '../services/qrcode-secure.service';
import { JwtAuthGuard } from '../../auth/guards/jwt.auth.gards';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import {
  RequirePermissions,
  InBusinessContext,
} from '../../auth/decorators/permissions.decorator';
import {
  Permission,
  BusinessContext,
} from '../../auth/models/permissions.model';
import { Ticket } from '../entities/ticket.entity';

/**
 * DTO para validación de tickets
 */
class ValidateTicketDto {
  /** Código QR del ticket (seguro o combinado) */
  qrCode: string;
  /** Modo de validación: 'online' (con DB) o 'offline' (sin DB, solo JWT) */
  mode?: 'online' | 'offline';
}

/**
 * DTO para validación offline con JWT
 */
class ValidateOfflineTokenDto {
  /** Token JWT del ticket */
  token: string;
}

/**
 * Respuesta de validación online
 */
interface OnlineValidationResponse {
  valid: boolean;
  ticket?: {
    id: string;
    status: string;
    eventName: string;
    eventDate: Date;
    ticketTypeName: string;
    ownerName: string;
    validatedAt?: Date;
    usedAt?: Date;
  };
  message: string;
}

/**
 * Controlador para validación de tickets
 *
 * Provee endpoints para:
 * - Validación online (con verificación en base de datos)
 * - Validación offline (mediante JWT, sin conexión a DB)
 * - Regeneración de códigos QR
 *
 * @security JWT - Requiere autenticación
 * @roles EVENT_ORGANIZER, ADMIN, OPERATOR
 */
@ApiTags('Ticket Validation')
@Controller('tickets')
export class TicketValidationController {
  constructor(
    private readonly ticketsService: TicketsService,
    private readonly validationService: TicketValidationService,
    private readonly qrService: QRCodeSecureService,
  ) {}

  /**
   * Valida un ticket mediante su código QR
   *
   * Modo online (default): Verifica en base de datos el estado actual del ticket
   * Modo offline: Valida la firma JWT sin consultar base de datos
   *
   * @param dto Datos de validación
   * @param req Request con usuario autenticado
   * @returns Resultado de la validación
   */
  @Post('validate')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @InBusinessContext(BusinessContext.EVENTS)
  @RequirePermissions(Permission.VALIDATE_TICKETS, Permission.MANAGE_TICKETS)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Validar ticket por código QR',
    description: `
Valida un ticket escaneado mediante su código QR.

**Modo Online (default):**
- Verifica el estado actual en base de datos
- Marca el ticket como usado
- Registra quién validó

**Modo Offline:**
- Valida firma JWT sin consultar DB
- Útil en eventos sin conectividad
- No actualiza estado en servidor

**Tipos de QR soportados:**
- QR seguro con HMAC (base64url)
- QR combinado con JWT (base64url)
- Token JWT directo
    `,
  })
  @ApiResponse({ status: 200, description: 'Ticket validado exitosamente' })
  @ApiResponse({ status: 400, description: 'QR inválido o ticket ya usado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @ApiResponse({ status: 403, description: 'Sin permisos de organizador' })
  @HttpCode(HttpStatus.OK)
  async validateTicket(
    @Body() dto: ValidateTicketDto,
    @Request() req,
  ): Promise<OnlineValidationResponse | OfflineValidationResult> {
    const validatorId = req.user?.userId;
    const mode = dto.mode || 'online';

    if (mode === 'offline') {
      // Validación offline: solo verifica JWT, no consulta DB
      return this.validateOffline(dto.qrCode);
    }

    // Validación online: consulta DB y marca como usado
    return this.validateOnline(dto.qrCode, validatorId);
  }

  /**
   * Valida un token JWT offline directamente
   *
   * Endpoint público (sin auth) para validación en zonas sin conectividad.
   * La app del organizador puede usar este endpoint localmente.
   */
  @Post('validate-offline')
  @ApiOperation({
    summary: 'Validar token JWT offline (público)',
    description: `
Valida un token JWT de ticket sin requerir autenticación.

**Uso principal:** Aplicaciones de validación offline que operan
sin conexión a internet y necesitan verificar tickets localmente.

**Seguridad:** El token está firmado criptográficamente, por lo que
no puede ser falsificado sin la clave secreta.
    `,
  })
  @ApiResponse({ status: 200, description: 'Token válido' })
  @ApiResponse({ status: 400, description: 'Token inválido o expirado' })
  @HttpCode(HttpStatus.OK)
  async validateOfflineToken(
    @Body() dto: ValidateOfflineTokenDto,
  ): Promise<OfflineValidationResult> {
    return this.validationService.validateOfflineToken(dto.token);
  }

  /**
   * Obtiene datos completos de un ticket incluyendo QRs
   *
   * Útil para mostrar el ticket al comprador con todos los formatos de QR.
   */
  @Get(':id/qr-data')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Obtener datos del ticket con QR',
    description: `
Obtiene todos los datos del ticket incluyendo diferentes formatos de QR:

- **secureQR**: QR con firma HMAC (compacto, válido 7 días)
- **offlineToken**: Token JWT para validación offline
- **combinedQR**: QR híbrido con ambos formatos

El comprador puede usar cualquiera de estos formatos para ingresar al evento.
    `,
  })
  @ApiResponse({ status: 200, description: 'Datos del ticket con QR' })
  @ApiResponse({ status: 404, description: 'Ticket no encontrado' })
  async getTicketQRData(@Param('id') ticketId: string): Promise<{
    ticket: Partial<Ticket>;
    qrFormats: {
      secureQR: string;
      offlineToken: string;
      combinedQR: string;
    };
  }> {
    const data = await this.ticketsService.getTicketWithOfflineData(ticketId);

    return {
      ticket: {
        id: data.ticket.id,
        status: data.ticket.status,
        ownerName: data.ticket.ownerName,
        ownerEmail: data.ticket.ownerEmail,
        validatedAt: data.ticket.validatedAt,
        usedAt: data.ticket.usedAt,
        createdAt: data.ticket.createdAt,
      },
      qrFormats: {
        secureQR: data.secureQR,
        offlineToken: data.offlineToken,
        combinedQR: data.combinedQR,
      },
    };
  }

  /**
   * Regenera el código QR de un ticket
   *
   * Útil si el QR original se perdió o se considera comprometido.
   * Requiere permisos de organizador o admin.
   */
  @Post(':id/regenerate-qr')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @InBusinessContext(BusinessContext.EVENTS)
  @RequirePermissions(Permission.MANAGE_TICKETS)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Regenerar código QR del ticket',
    description: `
Genera un nuevo código QR seguro para el ticket.

**Casos de uso:**
- QR original perdido o borrado
- Sospecha de compromiso del código
- Cambio de dispositivo del comprador

**Nota:** El código anterior deja de funcionar inmediatamente.
    `,
  })
  @ApiResponse({ status: 200, description: 'QR regenerado exitosamente' })
  @ApiResponse({ status: 404, description: 'Ticket no encontrado' })
  async regenerateQR(@Param('id') ticketId: string): Promise<{
    message: string;
    ticketId: string;
  }> {
    await this.ticketsService.regenerateQRCode(ticketId);

    return {
      message: 'Código QR regenerado exitosamente',
      ticketId,
    };
  }

  /**
   * Verifica la validez de un QR sin marcarlo como usado
   *
   * Útil para pre-validación o verificación de estado.
   */
  @Post('check')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @InBusinessContext(BusinessContext.EVENTS)
  @RequirePermissions(Permission.VALIDATE_TICKETS, Permission.READ_ORDER)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Verificar estado de ticket (sin marcar como usado)',
    description: `
Verifica si un ticket es válido sin consumirlo.

**Diferencia con /validate:**
- Este endpoint NO marca el ticket como usado
- Útil para verificar estado antes de permitir ingreso
- Puede llamarse múltiples veces sin afectar el ticket
    `,
  })
  @HttpCode(HttpStatus.OK)
  async checkTicket(@Body() dto: { qrCode: string }): Promise<{
    valid: boolean;
    status: string;
    eventName: string;
    ticketTypeName: string;
    ownerName: string;
    alreadyUsed: boolean;
  }> {
    try {
      const ticket = await this.ticketsService.findByCode(dto.qrCode);

      return {
        valid: ticket.status === 'ACTIVE',
        status: ticket.status,
        eventName: ticket.ticketType?.event?.name || 'N/A',
        ticketTypeName: ticket.ticketType?.name || 'N/A',
        ownerName: ticket.ownerName || 'N/A',
        alreadyUsed: ticket.status === 'USED',
      };
    } catch (error) {
      return {
        valid: false,
        status: 'INVALID',
        eventName: 'N/A',
        ticketTypeName: 'N/A',
        ownerName: 'N/A',
        alreadyUsed: false,
      };
    }
  }

  // ============ Métodos privados auxiliares ============

  private async validateOnline(
    qrCode: string,
    validatorId?: string,
  ): Promise<OnlineValidationResponse> {
    try {
      const ticket = await this.ticketsService.validateByQRCode(
        qrCode,
        validatorId,
      );

      return {
        valid: true,
        ticket: {
          id: ticket.id,
          status: ticket.status,
          eventName: ticket.ticketType?.event?.name,
          eventDate: ticket.ticketType?.event?.startDate,
          ticketTypeName: ticket.ticketType?.name,
          ownerName: ticket.ownerName,
          validatedAt: ticket.validatedAt,
          usedAt: ticket.usedAt,
        },
        message: 'Ticket validado exitosamente',
      };
    } catch (error) {
      return {
        valid: false,
        message: error.message || 'Error validando ticket',
      };
    }
  }

  private validateOffline(qrCode: string): OfflineValidationResult {
    // Primero intentar como QR combinado
    const hybridResult = this.validationService.validateHybridQR(qrCode);
    if (hybridResult.valid) {
      return hybridResult;
    }

    // Luego intentar como QR seguro HMAC puro
    const qrData = this.qrService.validateSecureQR(qrCode);
    if (qrData) {
      return {
        valid: true,
        ticketData: {
          ticketId: qrData.ticketId,
          eventName: 'Evento', // No disponible en HMAC puro
          eventDate: new Date(qrData.timestamp).toISOString(),
          ticketTypeName: 'Ticket',
          ownerName: '',
          purchaseId: qrData.purchaseId,
        },
      };
    }

    // Finalmente intentar como JWT directo
    const jwtResult = this.validationService.validateOfflineToken(qrCode);
    if (jwtResult.valid) {
      return jwtResult;
    }

    return {
      valid: false,
      error: 'Código QR inválido',
      errorCode: 'INVALID_QR',
    };
  }
}
