import { Module, forwardRef } from '@nestjs/common';
import { PaymentsGateway } from '../ws/payments.gateway';
import { MercadopagoService } from './services/mercado_pago.service';
import { PaymentsController } from './controller/payments.controller';
import { MercadoPagoOAuthController } from './controller/mercado-pago-oauth.controller';
import { PaymentsService } from './services/payments.service';
import { MercadoPagoHelperService } from './services/mercado-pago-helper.service';
import { MercadoPagoOAuthService } from './services/mercado-pago-oauth.service';

import * as MercadoPago from 'mercadopago';
import { PaymentIntent } from './entities/payment_intent_entity';
import { MercadoPagoAccount } from './entities/mercado-pago-account.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentsRepository } from './repository/payment_repository';
import { MercadoPagoRepository } from './services/repository/mercado-pago.repository';
import { OrdersModule } from 'src/orders/orders.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PaymentIntent, MercadoPagoAccount]),
    forwardRef(() => OrdersModule),
  ],
  controllers: [PaymentsController, MercadoPagoOAuthController],
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
    MercadoPagoOAuthService,
    PaymentsService,
    MercadoPagoRepository,
    PaymentsRepository,
    PaymentsGateway,
  ],
  exports: [
    'MERCADOPAGO_CLIENT',
    MercadopagoService,
    MercadoPagoHelperService,
    MercadoPagoOAuthService,
    PaymentsService,
    PaymentsGateway,
  ],
})
export class PaymentsModule {}
