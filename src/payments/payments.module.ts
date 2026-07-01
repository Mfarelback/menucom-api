import { Module, forwardRef } from '@nestjs/common';
import { PaymentsGateway } from '../ws/payments.gateway';
import { MercadopagoService } from './services/mercado_pago.service';
import { PaymentsController } from './controller/payments.controller';
import { MercadoPagoOAuthController } from './controller/mercado-pago-oauth.controller';
import { PaymentsService } from './services/payments.service';
import { PaymentIntentService } from './services/payment-intent.service';
import { PaymentWebhookService } from './services/payment-webhook.service';
import { PaymentStatusService } from './services/payment-status.service';
import { MercadoPagoHelperService } from './services/mercado-pago-helper.service';
import { MercadoPagoOAuthService } from './services/mercado-pago-oauth.service';
import { MarketplaceFeeResolverService } from './services/marketplace-fee-resolver.service';

import * as MercadoPago from 'mercadopago';
import { PaymentIntent } from './entities/payment_intent_entity';
import { MercadoPagoAccount } from './entities/mercado-pago-account.entity';
import { MerchantConfig } from './entities/merchant-config.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentsRepository } from './repository/payment_repository';
import { MercadoPagoRepository } from './services/repository/mercado-pago.repository';
import { AuthModule } from '../auth/auth.module';
import { OrdersModule } from '../orders/orders.module';
import { EventsModule } from '../events/events.module';
import { AppDataModule } from '../app-data/app-data.module';
import { CommerceModule } from '../commerce/commerce.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { User } from '../user/entities/user.entity';
import { Membership } from '../membership/entities/membership.entity';
import { Commerce } from '../commerce/entities/commerce.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PaymentIntent,
      MercadoPagoAccount,
      MerchantConfig,
      User,
      Membership,
      Commerce,
    ]),
    forwardRef(() => OrdersModule),
    forwardRef(() => EventsModule),
    AppDataModule,
    AuthModule,
    CommerceModule,
    forwardRef(() => NotificationsModule),
  ],
  controllers: [PaymentsController, MercadoPagoOAuthController],
  providers: [
    {
      provide: 'MERCADOPAGO_CLIENT',
      useFactory: () => {
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
    // Servicios especializados de pagos
    PaymentIntentService,
    PaymentWebhookService,
    PaymentStatusService,
    // Servicio coordinador
    PaymentsService,
    MercadoPagoRepository,
    PaymentsRepository,
    PaymentsGateway,
    // Fee Resolver para cálculo dinámico de comisiones
    MarketplaceFeeResolverService,
  ],
  exports: [
    'MERCADOPAGO_CLIENT',
    MercadopagoService,
    MercadoPagoHelperService,
    MercadoPagoOAuthService,
    // Exportar servicios especializados para uso externo
    PaymentIntentService,
    PaymentWebhookService,
    PaymentStatusService,
    // Mantener PaymentsService como fachada
    PaymentsService,
    PaymentsGateway,
    // Exportar Fee Resolver para uso en otros módulos
    MarketplaceFeeResolverService,
  ],
})
export class PaymentsModule {}
