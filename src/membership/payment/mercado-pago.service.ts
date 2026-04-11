import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MembershipPlan } from '../enums/membership-plan.enum';

export interface PaymentRequest {
  plan: MembershipPlan;
  userId: string;
  userEmail: string;
  returnUrl?: string;
  cancelUrl?: string;
}

export interface PaymentResponse {
  paymentId: string;
  status: 'pending' | 'approved' | 'rejected';
  amount: number;
  currency: string;
  paymentUrl?: string;
}

@Injectable()
export class MercadoPagoService {
  private readonly logger = new Logger(MercadoPagoService.name);
  private readonly accessToken: string;
  private readonly baseUrl = 'https://api.mercadopago.com';

  // Plan pricing in ARS (Argentine Pesos)
  private readonly planPrices = {
    [MembershipPlan.FREE]: 0,
    [MembershipPlan.PREMIUM]: 15000, // $15,000 ARS (~$15 USD)
    [MembershipPlan.ENTERPRISE]: 45000, // $45,000 ARS (~$45 USD)
  };

  constructor(private configService: ConfigService) {
    this.accessToken = this.configService.get('MERCADOPAGO_ACCESS_TOKEN');
  }

  async createPayment(request: PaymentRequest): Promise<PaymentResponse> {
    try {
      const amount = this.planPrices[request.plan];

      if (amount === 0) {
        // Free plan - no payment needed
        return {
          paymentId: `free_${Date.now()}`,
          status: 'approved',
          amount: 0,
          currency: 'ARS',
        };
      }

      const paymentData = {
        transaction_amount: amount,
        description: `Menucom ${request.plan.toUpperCase()} Plan Subscription`,
        payment_method_id: 'card', // or specific payment method
        payer: {
          email: request.userEmail,
        },
        external_reference: `membership_${request.userId}_${request.plan}`,
        notification_url: `${this.configService.get('APP_URL')}/webhook/mercadopago`,
        back_urls: {
          success:
            request.returnUrl ||
            `${this.configService.get('FRONTEND_URL')}/membership/success`,
          failure:
            request.cancelUrl ||
            `${this.configService.get('FRONTEND_URL')}/membership/error`,
          pending: `${this.configService.get('FRONTEND_URL')}/membership/pending`,
        },
        auto_return: 'approved',
        metadata: {
          user_id: request.userId,
          plan: request.plan,
        },
      };

      const response = await fetch(`${this.baseUrl}/v1/payments`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(paymentData),
      });

      const payment = await response.json();

      if (!response.ok) {
        this.logger.error('MercadoPago payment creation failed:', payment);
        throw new Error(`Payment creation failed: ${payment.message}`);
      }

      this.logger.log(
        `Payment created for user ${request.userId}: ${payment.id}`,
      );

      return {
        paymentId: payment.id,
        status: payment.status,
        amount: payment.transaction_amount,
        currency: 'ARS',
        paymentUrl: payment.init_point || payment.sandbox_init_point,
      };
    } catch (error) {
      this.logger.error('Error creating MercadoPago payment:', error);
      throw error;
    }
  }

  async getPaymentStatus(paymentId: string): Promise<PaymentResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/payments/${paymentId}`, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      });

      const payment = await response.json();

      if (!response.ok) {
        throw new Error(`Failed to get payment status: ${payment.message}`);
      }

      return {
        paymentId: payment.id,
        status: payment.status,
        amount: payment.transaction_amount,
        currency: payment.currency_id,
      };
    } catch (error) {
      this.logger.error('Error getting payment status:', error);
      throw error;
    }
  }

  async processWebhook(webhookData: any): Promise<{
    userId: string;
    plan: MembershipPlan;
    paymentId: string;
    status: string;
  }> {
    try {
      const { data, type } = webhookData;

      if (type !== 'payment') {
        return null;
      }

      const paymentStatus = await this.getPaymentStatus(data.id);

      // Extract user info from external_reference
      const externalRef = data.external_reference;
      const [, userId, plan] = externalRef.split('_');

      return {
        userId,
        plan: plan as MembershipPlan,
        paymentId: data.id,
        status: paymentStatus.status,
      };
    } catch (error) {
      this.logger.error('Error processing webhook:', error);
      throw error;
    }
  }

  getPlanPrice(plan: MembershipPlan): number {
    return this.planPrices[plan];
  }

  getAllPlanPrices() {
    return { ...this.planPrices };
  }
}
