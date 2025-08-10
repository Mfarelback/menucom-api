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

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly paymentsGateway: PaymentsGateway,
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
  ) {
    // Aquí deberías validar el estado del pago según la estructura de payload de Mercado Pago
    // Por ejemplo, si el pago fue aprobado:
    if (payload && payload.data && payload.type === 'payment') {
      // Aquí deberías buscar la orderId asociada al payment, por ejemplo usando el external_reference
      // Suponiendo que external_reference es el orderId:

      const orderId =
        payload.data.external_reference || payload.data.order_id || null;

      if (orderId) {
        this.paymentsGateway.emitPaymentSuccess(orderId);
      }
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
