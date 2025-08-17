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
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt.auth.gards';
import { PaymentsService } from '../services/payments.service';
import { PaymentsGateway } from '../../ws/payments.gateway';
import { MercadopagoService } from '../services/mercado_pago.service';

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly paymentsGateway: PaymentsGateway,
    private readonly mercadoPagoService: MercadopagoService,
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
  @Post('webhooks')
  @HttpCode(200)
  async recibeNotification(
    @Body() payload: any,
    @Headers('x-idempotency-key') idempotencyKey: string,
    @Req() req: any,
  ) {
    try {
      console.log('[MP Webhook] Payload recibido:', JSON.stringify(payload));
      console.log('[MP Webhook] Query params:', JSON.stringify(req.query));

      let paymentId: string | null = null;
      let merchantOrderId: string | number | null = null;

      // Extraer información de notificación de payment
      if (payload && payload.data && payload.type === 'payment') {
        paymentId = payload.data.id;
        console.log(
          '[MP Webhook] Detectado payment con body. paymentId:',
          paymentId,
        );
      } else if (
        req.query &&
        req.query['data.id'] &&
        req.query.type === 'payment'
      ) {
        paymentId = req.query['data.id'];
        console.log(
          '[MP Webhook] Detectado payment con query param. paymentId:',
          paymentId,
        );
      }

      // Extraer información de notificación de merchant_order
      if (
        (payload && payload.topic === 'merchant_order' && payload.resource) ||
        (req.query && req.query.topic === 'merchant_order' && req.query.id)
      ) {
        const merchantOrderIdRaw = payload.resource
          ? payload.resource.split('/').pop()
          : req.query.id;
        merchantOrderId = Number(merchantOrderIdRaw);

        // Si no es un número válido, usar como string
        if (!Number.isFinite(merchantOrderId)) {
          merchantOrderId = merchantOrderIdRaw as string;
        }

        console.log(
          '[MP Webhook] Detectado merchant_order. merchantOrderId:',
          merchantOrderId,
        );
      }

      // Procesar la notificación y actualizar estados
      const result = await this.paymentsService.processWebhookNotification(
        paymentId,
        merchantOrderId,
      );

      // Emitir evento por websocket si tenemos orderId
      if (result.orderId) {
        console.log(
          '[MP Webhook] Emitiendo evento WebSocket paymentSuccess para orderId:',
          result.orderId,
        );
        this.paymentsGateway.emitPaymentSuccess(result.orderId);
      } else {
        console.warn(
          '[MP Webhook] No se pudo determinar orderId, no se emite evento WebSocket',
        );
      }

      return {
        message: 'Notificación procesada correctamente',
        orderId: result.orderId,
        paymentStatus: result.paymentStatus,
        idempotencyKey,
      };
    } catch (error) {
      console.error('[MP Webhook] Error procesando notificación:', error);
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
