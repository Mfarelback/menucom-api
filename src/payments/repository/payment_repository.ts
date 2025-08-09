import { Repository } from 'typeorm';
import { PaymentIntent } from '../entities/payment_intent_entity';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class PaymentsRepository {
  constructor(
    @InjectRepository(PaymentIntent)
    private paymentRepo: Repository<PaymentIntent>,
  ) {}

  async createPayment(payment: PaymentIntent): Promise<PaymentIntent> {
    const newPayment = this.paymentRepo.create(payment);
    return this.paymentRepo.save(newPayment);
  }

  async getHistoryPayments(userId: string) {
    return 'Get history of payments' + userId;
  }

  async getPaymentById(id: string): Promise<PaymentIntent> {
    return this.paymentRepo.findOne({
      where: { id },
    });
  }

  async changeStatusPayment(
    id: string,
    status: string,
  ): Promise<PaymentIntent> {
    const payment = await this.getPaymentById(id);
    if (!payment) {
      throw new Error('Payment not found');
    }
    payment.state = status;
    return this.paymentRepo.save(payment);
  }
}
