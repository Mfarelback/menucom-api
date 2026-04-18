import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Logger,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MembershipService } from '../membership.service';
import { MercadoPagoService } from '../payment/mercado-pago.service';
import { MercadoPagoSubscriptionService } from '../payment/mercado-pago-subscription.service';
import { Membership } from '../entities/membership.entity';
import {
  SubscriptionPayment,
  PaymentStatus,
  PaymentType,
} from '../entities/subscription-payment.entity';
import { SubscriptionDiscountService } from '../payment/subscription-discount.service';

interface WebhookPayload {
  type: string;
  action: string;
  data: {
    id: string;
  };
  date_created?: string;
}

@Controller('webhook')
export class MembershipWebhookController {
  private readonly logger = new Logger(MembershipWebhookController.name);

  constructor(
    private readonly membershipService: MembershipService,
    private readonly mercadoPagoService: MercadoPagoService,
    private readonly mpSubscriptionService: MercadoPagoSubscriptionService,
    private readonly discountService: SubscriptionDiscountService,
    @InjectRepository(Membership)
    private readonly membershipRepository: Repository<Membership>,
    @InjectRepository(SubscriptionPayment)
    private readonly paymentRepository: Repository<SubscriptionPayment>,
  ) {}

  @Post('mercadopago')
  @HttpCode(HttpStatus.OK)
  async handleMercadoPagoWebhook(
    @Body() payload: WebhookPayload,
    @Headers('x-signature') signature: string,
    @Headers('x-request-id') requestId: string,
  ): Promise<{ status: string }> {
    try {
      const dataId = payload?.data?.id;
      if (!dataId) {
        throw new UnauthorizedException('Missing data.id in webhook payload');
      }

      const isValid = this.validateSignature(signature, requestId, dataId);
      if (!isValid) {
        this.logger.error('[MP Webhook] Firma inválida detectada.');
        throw new UnauthorizedException('Invalid signature');
      }

      this.logger.log(
        `Received webhook: type=${payload.type}, action=${payload.action}, id=${dataId}`,
      );

      const topic = payload.type;
      const action = payload.action;
      const resourceId = payload.data?.id;

      switch (topic) {
        case 'payment':
          await this.handlePaymentWebhook(resourceId, action);
          break;
        case 'subscription_authorized_payment':
          await this.handleSubscriptionPaymentWebhook(resourceId);
          break;
        case 'subscription_preapproval':
          await this.handlePreapprovalWebhook(resourceId, action);
          break;
        default:
          this.logger.warn(`Unknown webhook topic: ${topic}`);
      }

      return { status: 'processed' };
    } catch (error) {
      this.logger.error('Error processing webhook:', error);
      return { status: 'error' };
    }
  }

  private validateSignature(
    xSignature: string,
    xRequestId: string,
    dataId: string,
  ): boolean {
    const secret = process.env.MP_WEBHOOK_SECRET;
    if (!secret) {
      this.logger.warn(
        'MP_WEBHOOK_SECRET no está configurado. Saltando validación de firma (NO RECOMENDADO en producción).',
      );
      return true;
    }

    try {
      const parts = xSignature.split(',');
      const tsPart = parts.find((p) => p.startsWith('ts='));
      const v1Part = parts.find((p) => p.startsWith('v1='));

      if (!tsPart || !v1Part) return false;

      const ts = tsPart.split('=')[1];
      const receivedHash = v1Part.split('=')[1];

      const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;

      const generatedHash = crypto
        .createHmac('sha256', secret)
        .update(manifest)
        .digest('hex');

      return generatedHash === receivedHash;
    } catch (error) {
      this.logger.error('Error validando firma de MP', error.stack);
      return false;
    }
  }

  private async handlePaymentWebhook(
    paymentId: string,
    action: string,
  ): Promise<void> {
    this.logger.log(
      `Processing payment webhook: ${paymentId}, action: ${action}`,
    );

    const paymentInfo =
      await this.mercadoPagoService.getPaymentStatus(paymentId);
    const { status, amount, currency } = paymentInfo;

    if (status === 'approved') {
      const externalRef = paymentInfo.paymentId?.toString();
      const match = externalRef?.match(/membership_(.+?)_/);

      if (match) {
        const userId = match[1];
        const plan = match[2];

        await this.membershipService.subscribeToPlan(userId, {
          plan: plan as any,
          paymentId,
          amount,
          currency: currency || 'ARS',
          metadata: { webhookProcessed: true },
        });

        this.logger.log(`Payment approved for user ${userId}: ${paymentId}`);
      }
    } else if (status === 'rejected') {
      this.logger.warn(`Payment rejected: ${paymentId}`);
    }
  }

  private async handleSubscriptionPaymentWebhook(
    paymentId: string,
  ): Promise<void> {
    this.logger.log(`Processing subscription payment: ${paymentId}`);

    try {
      const payments =
        await this.mpSubscriptionService.getAuthorizedPayments('');
      const payment = payments.find((p) => p.paymentId === paymentId);

      if (!payment) {
        this.logger.warn(`Payment not found: ${paymentId}`);
        return;
      }

      const memberships = await this.membershipRepository
        .createQueryBuilder('m')
        .where('m.mpPreapprovalId IS NOT NULL')
        .orderBy('m.createdAt', 'DESC')
        .take(100)
        .getMany();

      for (const membership of memberships) {
        if (!membership.mpPreapprovalId) continue;

        const subPayments =
          await this.mpSubscriptionService.getAuthorizedPayments(
            membership.mpPreapprovalId,
          );
        const latestPayment = subPayments.find(
          (p) => p.paymentId === paymentId,
        );

        if (latestPayment) {
          membership.lastPaymentAt = latestPayment.paidAt || new Date();
          membership.nextBillingDate = this.calculateNextBillingDate();
          await this.membershipRepository.save(membership);

          const paymentRecord = this.paymentRepository.create({
            membershipId: membership.id,
            mpPaymentId: paymentId,
            amount: latestPayment.amount,
            currency: latestPayment.currency,
            status: this.mapPaymentStatus(latestPayment.status),
            type: PaymentType.SUBSCRIPTION_PAYMENT,
            paymentMethodId: latestPayment.paymentMethodId,
            paidAt: latestPayment.paidAt,
          });
          await this.paymentRepository.save(paymentRecord);

          this.logger.log(
            `Subscription payment recorded for membership ${membership.id}`,
          );
          break;
        }
      }
    } catch (error) {
      this.logger.error(
        `Error processing subscription payment ${paymentId}:`,
        error,
      );
    }
  }

  private async handlePreapprovalWebhook(
    preapprovalId: string,
    action: string,
  ): Promise<void> {
    this.logger.log(
      `Processing preapproval webhook: ${preapprovalId}, action: ${action}`,
    );

    try {
      const mpPreapproval =
        await this.mpSubscriptionService.getPreapproval(preapprovalId);

      const membership = await this.membershipRepository.findOne({
        where: { mpPreapprovalId: preapprovalId },
      });

      if (!membership) {
        this.logger.warn(
          `No membership found for preapproval: ${preapprovalId}`,
        );
        return;
      }

      const previousStatus = membership.subscriptionStatus;
      membership.subscriptionStatus = mpPreapproval.status;
      membership.nextBillingDate = mpPreapproval.nextBillingDate || undefined;
      membership.paymentMethodId = mpPreapproval.paymentMethodId || undefined;

      if (mpPreapproval.status === 'authorized') {
        membership.isActive = true;
      } else if (mpPreapproval.status === 'paused') {
        this.logger.log(`Subscription paused for membership ${membership.id}`);
      } else if (mpPreapproval.status === 'cancelled') {
        membership.isActive = false;
        this.logger.log(
          `Subscription cancelled for membership ${membership.id}`,
        );
      }

      await this.membershipRepository.save(membership);
      this.logger.log(
        `Preapproval ${preapprovalId} updated: ${previousStatus} -> ${mpPreapproval.status}`,
      );
    } catch (error) {
      this.logger.error(
        `Error processing preapproval webhook ${preapprovalId}:`,
        error,
      );
    }
  }

  private calculateNextBillingDate(): Date {
    const nextDate = new Date();
    nextDate.setMonth(nextDate.getMonth() + 1);
    return nextDate;
  }

  private mapPaymentStatus(mpStatus: string): PaymentStatus {
    const statusMap: Record<string, PaymentStatus> = {
      approved: PaymentStatus.APPROVED,
      authorized: PaymentStatus.AUTHORIZED,
      pending: PaymentStatus.PENDING,
      rejected: PaymentStatus.REJECTED,
      cancelled: PaymentStatus.CANCELLED,
      refunded: PaymentStatus.REFUNDED,
    };
    return statusMap[mpStatus] || PaymentStatus.PENDING;
  }
}
