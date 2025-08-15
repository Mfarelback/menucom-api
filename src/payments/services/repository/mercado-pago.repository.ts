import { Inject, Injectable, Logger } from '@nestjs/common';
import * as MercadoPago from 'mercadopago';

@Injectable()
export class MercadoPagoRepository {
  private readonly logger = new Logger(MercadoPagoRepository.name);

  constructor(
    @Inject('MERCADOPAGO_CLIENT')
    private readonly client: MercadoPago.MercadoPagoConfig,
  ) {}

  async createPreference(body: any) {
    const preference = new MercadoPago.Preference(this.client);
    return preference.create({ body });
  }

  async getPreference(preferenceId: string) {
    const preference = new MercadoPago.Preference(this.client);
    return preference.get({ preferenceId });
  }

  async searchPayments(options: any) {
    const payment = new (MercadoPago as any).Payment(this.client);
    return payment.search({ options });
  }

  async getPayment(id: string) {
    const payment = new (MercadoPago as any).Payment(this.client);
    return payment.get({ id });
  }

  async searchMerchantOrders(options: any) {
    const merchantOrder = new MercadoPago.MerchantOrder(this.client);
    return merchantOrder.search({ options });
  }

  async getMerchantOrder(id: string) {
    const merchantOrder = new (MercadoPago as any).MerchantOrder(this.client);
    return merchantOrder.get({ id });
  }
}
