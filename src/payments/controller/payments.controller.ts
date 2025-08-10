import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
  Headers,
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
  async recibeNotification(
    @Body() payload: any,
    @Headers('x-idempotency-key') idempotencyKey: string,
    @Req() req: any,
  ) {
    // Soportar notificaciones con body y con query params
    console.log('[MP Webhook] Payload recibido:', JSON.stringify(payload));
    console.log('[MP Webhook] Query params:', JSON.stringify(req.query));
    let orderId: string | null = null;
    // Caso 1: Notificación con body (tipo payment)
    if (payload && payload.data && payload.type === 'payment') {
      // Si el body trae external_reference, úsalo. Si no, busca el payment por ID.
      if (payload.data.external_reference) {
        orderId = payload.data.external_reference;
        console.log(
          '[MP Webhook] Detectado payment con body. orderId:',
          orderId,
        );
      } else if (payload.data.id) {
        const paymentId = payload.data.id;
        console.log(
          '[MP Webhook] Detectado payment con body, sin external_reference. Buscando por paymentId:',
          paymentId,
        );
        orderId =
          await this.mercadoPagoService.getOrderIdByPaymentId(paymentId);
        console.log('[MP Webhook] orderId obtenido desde MP:', orderId);
      } else {
        orderId = null;
        console.log(
          '[MP Webhook] Detectado payment con body, pero sin id ni external_reference.',
        );
      }
    } else if (
      req.query &&
      req.query['data.id'] &&
      req.query.type === 'payment'
    ) {
      const paymentId = req.query['data.id'];
      console.log(
        '[MP Webhook] Detectado payment con query param. paymentId:',
        paymentId,
      );
      orderId = await this.mercadoPagoService.getOrderIdByPaymentId(paymentId);
      console.log('[MP Webhook] orderId obtenido desde MP:', orderId);
    } else if (
      (payload && payload.topic === 'merchant_order' && payload.resource) ||
      (req.query && req.query.topic === 'merchant_order' && req.query.id)
    ) {
      // merchant_order puede venir en el body o en los query params
      let merchantOrderId = payload.resource
        ? payload.resource.split('/').pop()
        : req.query.id;
      // Asegurarse de que sea número
      if (typeof merchantOrderId === 'string') {
        merchantOrderId = Number(merchantOrderId);
      }
      console.log(
        '[MP Webhook] Detectado merchant_order. merchantOrderId:',
        merchantOrderId,
        'typeof:',
        typeof merchantOrderId,
      );
      orderId =
        await this.mercadoPagoService.getOrderIdByMerchantOrderId(
          merchantOrderId,
        );
      console.log(
        '[MP Webhook] orderId obtenido desde merchant_order:',
        orderId,
      );
    }
    // Emitir evento por websocket si tenemos orderId
    if (orderId) {
      console.log(
        '[MP Webhook] Emitiendo evento WebSocket paymentSuccess para orderId:',
        orderId,
      );
      this.paymentsGateway.emitPaymentSuccess(orderId);
    } else {
      console.warn(
        '[MP Webhook] No se pudo determinar orderId, no se emite evento WebSocket',
      );
    }
    return 'Get capture of payment' + JSON.stringify(payload) + idempotencyKey;
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post('checkin/:id')
  async postNewBookingSport(@Param('id') id: string) {
    return this.paymentsService.checkPaymentStatus(id);
  }
}
