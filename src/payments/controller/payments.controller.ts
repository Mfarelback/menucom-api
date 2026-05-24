import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
  Headers,
  HttpCode,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt.auth.gards';
import { IdempotencyService } from '../../core/idempotency';
import { PaymentsService } from '../services/payments.service';
import { PaymentsGateway } from '../../ws/payments.gateway';
import { MercadopagoService } from '../services/mercado_pago.service';

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly paymentsGateway: PaymentsGateway,
    private readonly mercadoPagoService: MercadopagoService,
    private readonly idempotencyService: IdempotencyService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Consulta el estado de un pago',
  })
  @Get('status/:id')
  async getUnabilavleTimeSport(@Req() req: Request, @Param('id') id: string) {
    return this.paymentsService.getPaymentById(id);
  }

  /**
   * Webhook de Mercado Pago para recibir notificaciones de pago.
   * No requiere autenticación.
   *
   * @param payload Cuerpo de la notificación enviada por Mercado Pago
   * @param idempotencyKey Header opcional para manejo de idempotencia
   */
  @ApiOperation({
    summary:
      'Webhook de Mercado Pago para notificaciones de pago (no requiere auth)',
  })
  @SkipThrottle()
  @Post('webhooks')
  @HttpCode(200)
  @ApiHeader({
    name: 'x-signature',
    description: 'Firma de seguridad de Mercado Pago',
    required: false,
  })
  async recibeNotification(
    @Body() payload: any,
    @Headers('x-signature') xSignature: string,
    @Headers('x-request-id') xRequestId: string,
    @Headers('x-idempotency-key') idempotencyKey: string,
    @Req() req: any,
  ) {
    try {
      this.logger.log('Webhook payload recibido');

      const dataId =
        payload?.data?.id ||
        req.query?.['data.id'] ||
        payload?.id ||
        req.query?.id;

      if (xSignature && dataId && xRequestId) {
        const isValid = this.paymentsService.validateSignature(
          xSignature,
          xRequestId,
          dataId,
        );
        if (!isValid) {
          this.logger.warn('Firma inválida detectada en webhook');
          throw new UnauthorizedException('Invalid signature');
        }
      } else if (
        process.env.ENV === 'prod' ||
        process.env.NODE_ENV === 'production'
      ) {
        this.logger.warn('Firma ausente en webhook en producción');
        throw new UnauthorizedException('Signature is required in production');
      } else {
        this.logger.warn('Notificación sin firma (entorno no-prod)');
      }

      const idempKey = idempotencyKey || xRequestId || dataId || 'unknown';

      let paymentId: string | null = null;
      let merchantOrderId: string | number | null = null;

      if (payload && payload.data && payload.type === 'payment') {
        paymentId = payload.data.id;
        this.logger.log(`Detectado payment con body. paymentId: ${paymentId}`);
      } else if (
        req.query &&
        req.query['data.id'] &&
        req.query.type === 'payment'
      ) {
        paymentId = req.query['data.id'];
        this.logger.log(
          `Detectado payment con query param. paymentId: ${paymentId}`,
        );
      }

      if (
        (payload && payload.topic === 'merchant_order' && payload.resource) ||
        (req.query && req.query.topic === 'merchant_order' && req.query.id)
      ) {
        const merchantOrderIdRaw = payload.resource
          ? payload.resource.split('/').pop()
          : req.query.id;
        merchantOrderId = Number(merchantOrderIdRaw);

        if (!Number.isFinite(merchantOrderId)) {
          merchantOrderId = merchantOrderIdRaw as string;
        }

        this.logger.log(
          `Detectado merchant_order. merchantOrderId: ${merchantOrderId}`,
        );
      }

      const actionKey = `payments-webhook:${idempKey}`;
      const { processed, result } = await this.idempotencyService.tryProcess(
        actionKey,
        () =>
          this.paymentsService.processWebhookNotification(
            paymentId,
            merchantOrderId,
          ),
      );

      if (!processed) {
        this.logger.log(`Webhook ya procesado: ${idempKey}`);
        return {
          message: 'Notificación ya procesada',
          idempotencyKey,
        };
      }

      if (result?.orderId) {
        this.logger.log(
          `Emitiendo evento WebSocket paymentSuccess para orderId: ${result.orderId}`,
        );
        this.paymentsGateway.emitPaymentSuccess(result.orderId);
      } else {
        this.logger.warn(
          'No se pudo determinar orderId, no se emite evento WebSocket',
        );
      }

      return {
        message: 'Notificación procesada correctamente',
        orderId: result?.orderId,
        paymentStatus: result?.paymentStatus,
        idempotencyKey,
      };
    } catch (error) {
      this.logger.error(
        'Error procesando notificación webhook',
        error instanceof Error ? error.stack : undefined,
      );
      return {
        message: 'Error procesando notificación',
        error: error.message,
        idempotencyKey,
      };
    }
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post('checkin/:id')
  async postNewBookingSport(@Param('id') id: string) {
    return this.paymentsService.checkPaymentStatus(id);
  }
}
