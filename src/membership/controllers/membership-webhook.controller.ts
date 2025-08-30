/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Logger,
  Headers,
} from '@nestjs/common';
import { MembershipService } from '../membership.service';
import { MercadoPagoService } from '../payment/mercado-pago.service';

@Controller('webhook')
export class MembershipWebhookController {
  private readonly logger = new Logger(MembershipWebhookController.name);

  constructor(
    private readonly membershipService: MembershipService,
    private readonly mercadoPagoService: MercadoPagoService,
  ) {}

  @Post('mercadopago')
  @HttpCode(HttpStatus.OK)
  async handleMercadoPagoWebhook(
    @Body() webhookData: any,
    @Headers('x-signature') signature: string,
  ): Promise<{ status: string }> {
    try {
      this.logger.log('Received MercadoPago webhook:', webhookData);

      // TODO: Validate webhook signature for security
      // this.validateWebhookSignature(signature, webhookData);

      const paymentInfo =
        await this.mercadoPagoService.processWebhook(webhookData);

      if (!paymentInfo) {
        this.logger.warn('Webhook not related to payment, ignoring');
        return { status: 'ignored' };
      }

      const { userId, plan, paymentId, status } = paymentInfo;

      if (status === 'approved') {
        await this.membershipService.subscribeToPlan(userId, {
          plan,
          paymentId,
          amount: this.mercadoPagoService.getPlanPrice(plan),
          currency: 'ARS',
          metadata: {
            webhookProcessed: true,
            processedAt: new Date().toISOString(),
          },
        });

        this.logger.log(
          `Successfully processed payment for user ${userId}: ${paymentId}`,
        );
      } else if (status === 'rejected' || status === 'cancelled') {
        this.logger.warn(`Payment ${status} for user ${userId}: ${paymentId}`);
        // Could send notification to user about failed payment
      }

      return { status: 'processed' };
    } catch (error) {
      this.logger.error('Error processing MercadoPago webhook:', error);
      return { status: 'error' };
    }
  }

  // TODO: Implement signature validation
  private validateWebhookSignature(_signature: string, _payload: any): void {
    // Implementation would depend on MercadoPago's signature validation
    // This is important for security to ensure webhooks are genuine
  }
}
