import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MembershipPlan } from '../enums/membership-plan.enum';

export interface CreatePreapprovalRequest {
  userId: string;
  userEmail: string;
  plan: MembershipPlan;
  price: number;
  discountCode?: string;
  discountValue?: number;
  cardTokenId: string;
  returnUrl?: string;
  cancelUrl?: string;
}

export interface PreapprovalResponse {
  preapprovalId: string;
  status: string;
  initPoint: string;
  nextBillingDate?: Date;
  paymentMethodId?: string;
}

export interface UpdatePreapprovalRequest {
  status?: 'paused' | 'authorized' | 'cancelled';
  transactionAmount?: number;
  cardTokenId?: string;
}

export interface GetPreapprovalResponse {
  id: string;
  status: string;
  payerEmail: string;
  autoRecurring: {
    frequency: number;
    frequencyType: string;
    transactionAmount: number;
    currencyId: string;
    startDate: string;
    endDate?: string;
  };
  nextBillingDate?: Date;
  paymentMethodId?: string;
  cardId?: string;
  externalReference?: string;
}

export interface SubscriptionPaymentInfo {
  paymentId: string;
  status: string;
  amount: number;
  currency: string;
  paidAt?: Date;
  paymentMethodId?: string;
}

@Injectable()
export class MercadoPagoSubscriptionService {
  private readonly logger = new Logger(MercadoPagoSubscriptionService.name);
  private readonly accessToken: string;
  private readonly baseUrl = 'https://api.mercadopago.com';

  private readonly planPrices = {
    [MembershipPlan.FREE]: 0,
    [MembershipPlan.PREMIUM]: 15000,
    [MembershipPlan.ENTERPRISE]: 45000,
  };

  constructor(private configService: ConfigService) {
    this.accessToken = this.configService.get('MP_ACCESS_TOKEN');
    if (!this.accessToken) {
      throw new Error('MP_ACCESS_TOKEN not configured');
    }
  }

  async createPreapproval(
    request: CreatePreapprovalRequest,
  ): Promise<PreapprovalResponse> {
    try {
      const finalPrice = request.discountValue
        ? request.price - request.discountValue
        : request.price;

      const preapprovalData = {
        reason: `Menucom ${request.plan.toUpperCase()} Plan`,
        external_reference: `membership_${request.userId}_${request.plan}`,
        payer_email: request.userEmail,
        card_token_id: request.cardTokenId,
        auto_recurring: {
          frequency: 1,
          frequency_type: 'months',
          transaction_amount: finalPrice,
          currency_id: 'ARS',
          start_date: new Date().toISOString(),
        },
        back_url: {
          success:
            request.returnUrl ||
            `${this.configService.get('FRONTEND_URL')}/membership/success`,
          failure:
            request.cancelUrl ||
            `${this.configService.get('FRONTEND_URL')}/membership/error`,
          pending: `${this.configService.get('FRONTEND_URL')}/membership/pending`,
        },
        status: 'authorized',
        metadata: {
          user_id: request.userId,
          plan: request.plan,
          discount_code: request.discountCode || null,
          original_price: request.price,
          discount_value: request.discountValue || 0,
          final_price: finalPrice,
        },
      };

      const response = await fetch(`${this.baseUrl}/preapprovals`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(preapprovalData),
      });

      const result = await response.json();

      if (!response.ok) {
        this.logger.error('MP preapproval creation failed:', result);
        throw new Error(`Preapproval creation failed: ${result.message}`);
      }

      this.logger.log(
        `Preapproval created for user ${request.userId}: ${result.id}`,
      );

      return {
        preapprovalId: result.id,
        status: result.status,
        initPoint: result.init_point,
        nextBillingDate: result.auto_recurring?.start_date
          ? new Date(result.auto_recurring.start_date)
          : undefined,
        paymentMethodId: result.payment_method_id,
      };
    } catch (error) {
      this.logger.error('Error creating preapproval:', error);
      throw error;
    }
  }

  async getPreapproval(preapprovalId: string): Promise<GetPreapprovalResponse> {
    try {
      const response = await fetch(
        `${this.baseUrl}/preapprovals/${preapprovalId}`,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        },
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(`Failed to get preapproval: ${result.message}`);
      }

      return {
        id: result.id,
        status: result.status,
        payerEmail: result.payer_email,
        autoRecurring: result.auto_recurring,
        nextBillingDate: result.next_payment_date
          ? new Date(result.next_payment_date)
          : undefined,
        paymentMethodId: result.payment_method_id,
        cardId: result.card_id,
        externalReference: result.external_reference,
      };
    } catch (error) {
      this.logger.error('Error getting preapproval:', error);
      throw error;
    }
  }

  async updatePreapproval(
    preapprovalId: string,
    request: UpdatePreapprovalRequest,
  ): Promise<GetPreapprovalResponse> {
    try {
      const updateData: any = {};

      if (request.status) {
        updateData.status = request.status;
      }
      if (request.transactionAmount) {
        updateData.auto_recurring = {
          transaction_amount: request.transactionAmount,
        };
      }
      if (request.cardTokenId) {
        updateData.card_token_id = request.cardTokenId;
      }

      const response = await fetch(
        `${this.baseUrl}/preapprovals/${preapprovalId}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updateData),
        },
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(`Failed to update preapproval: ${result.message}`);
      }

      this.logger.log(
        `Preapproval ${preapprovalId} updated: ${request.status}`,
      );

      return {
        id: result.id,
        status: result.status,
        payerEmail: result.payer_email,
        autoRecurring: result.auto_recurring,
        nextBillingDate: result.next_payment_date
          ? new Date(result.next_payment_date)
          : undefined,
        paymentMethodId: result.payment_method_id,
        cardId: result.card_id,
        externalReference: result.external_reference,
      };
    } catch (error) {
      this.logger.error('Error updating preapproval:', error);
      throw error;
    }
  }

  async pauseSubscription(
    preapprovalId: string,
  ): Promise<GetPreapprovalResponse> {
    return this.updatePreapproval(preapprovalId, { status: 'paused' });
  }

  async resumeSubscription(
    preapprovalId: string,
  ): Promise<GetPreapprovalResponse> {
    return this.updatePreapproval(preapprovalId, { status: 'authorized' });
  }

  async cancelSubscription(
    preapprovalId: string,
  ): Promise<GetPreapprovalResponse> {
    return this.updatePreapproval(preapprovalId, { status: 'cancelled' });
  }

  async changeSubscriptionAmount(
    preapprovalId: string,
    newAmount: number,
  ): Promise<GetPreapprovalResponse> {
    return this.updatePreapproval(preapprovalId, {
      transactionAmount: newAmount,
    });
  }

  async searchPreapprovals(
    externalReference?: string,
    status?: string,
  ): Promise<GetPreapprovalResponse[]> {
    try {
      const params = new URLSearchParams();
      if (externalReference)
        params.append('external_reference', externalReference);
      if (status) params.append('status', status);

      const response = await fetch(
        `${this.baseUrl}/preapprovals/search?${params}`,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        },
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(`Failed to search preapprovals: ${result.message}`);
      }

      return (result.results || []).map((p: any) => ({
        id: p.id,
        status: p.status,
        payerEmail: p.payer_email,
        autoRecurring: p.auto_recurring,
        nextBillingDate: p.next_payment_date
          ? new Date(p.next_payment_date)
          : undefined,
        paymentMethodId: p.payment_method_id,
        cardId: p.card_id,
        externalReference: p.external_reference,
      }));
    } catch (error) {
      this.logger.error('Error searching preapprovals:', error);
      throw error;
    }
  }

  async getAuthorizedPayments(
    preapprovalId: string,
  ): Promise<SubscriptionPaymentInfo[]> {
    try {
      const response = await fetch(
        `${this.baseUrl}/authorized_payments?preapproval_id=${preapprovalId}`,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        },
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(`Failed to get authorized payments: ${result.message}`);
      }

      return (result.results || []).map((p: any) => ({
        paymentId: p.id,
        status: p.status,
        amount: p.transaction_amount,
        currency: p.currency_id,
        paidAt: p.date_approved ? new Date(p.date_approved) : undefined,
        paymentMethodId: p.payment_method_id,
      }));
    } catch (error) {
      this.logger.error('Error getting authorized payments:', error);
      throw error;
    }
  }

  getPlanPrice(plan: MembershipPlan): number {
    return this.planPrices[plan] || 0;
  }

  calculateFinalPrice(
    plan: MembershipPlan,
    discountPercentage?: number,
  ): number {
    const price = this.getPlanPrice(plan);
    if (!discountPercentage) return price;
    return Math.max(0, price - (price * discountPercentage) / 100);
  }
}
