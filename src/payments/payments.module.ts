import { Module } from '@nestjs/common';
import { PaymentsGateway } from '../ws/payments.gateway';
import { MercadopagoService } from './services/mercado_pago.service';
import { PaymentsController } from './controller/payments.controller';
import { PaymentsService } from './services/payments.service';
import { MercadoPagoHelperService } from './services/mercado-pago-helper.service';

import * as MercadoPago from 'mercadopago';
import { PaymentIntent } from './entities/payment_intent_entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentsRepository } from './repository/payment_repository';
import { MercadoPagoRepository } from './services/repository/mercado-pago.repository';

@Module({
  imports: [TypeOrmModule.forFeature([PaymentIntent])],
  controllers: [PaymentsController],
  providers: [
    {
      provide: 'MERCADOPAGO_CLIENT',
      useFactory: () => {
        console.log(process.env.MP_ACCESS_TOKEN);
        console.log(process.env.MP_BACK_URL);
        if (!process.env.MP_ACCESS_TOKEN) {
          throw new Error('Falta el Access Token de MercadoPago');
        }
        return new MercadoPago.MercadoPagoConfig({
          accessToken: process.env.MP_ACCESS_TOKEN,
          options: {
            // testToken: true,
          },
        });
      },
    },
    MercadopagoService,
    MercadoPagoHelperService,
    PaymentsService,
    MercadoPagoRepository,
    PaymentsRepository,
    PaymentsGateway,
  ],
  exports: [
    'MERCADOPAGO_CLIENT',
    MercadopagoService,
    MercadoPagoHelperService,
    PaymentsService,
    PaymentsGateway,
  ],
})
export class PaymentsModule {}
