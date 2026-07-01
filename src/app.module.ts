import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { PaymentsGateway } from './ws/payments.gateway';
import { environment } from './enviroment';
import { DatabaseModule } from './database/database.module';
import { ConfigModule } from '@nestjs/config';
import config from './config';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { CloudinaryModule } from './cloudinary/cloudinary.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { ImageProxyModule } from './image-proxy/image-proxy.module';
import { AppDataModule } from './app-data/app-data.module';
import { MembershipModule } from './membership/membership.module';
import { NotificationsModule } from './notifications/notifications.module';
import { CatalogModule } from './catalog/catalog.module';
import { EventsModule } from './events/events.module';
import { PublicModule } from './public/public.module';
import { CommerceModule } from './commerce/commerce.module';
import { BusinessProfileModule } from './business-profile/business-profile.module';
import { TenantInterceptor } from './auth/interceptors/tenant.interceptor';
// import { MigrationModule } from './scripts/migration.module'; // Módulo temporal de migraciones
import { LoggerModule } from './core/logger';
import { IdempotencyModule } from './core/idempotency';
import { RootController } from './core/controllers/root.controller';

@Module({
  imports: [
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'default', ttl: 60000, limit: 30 }],
      errorMessage: 'Demasiadas solicitudes. Intenta de nuevo más tarde.',
    }),
    ConfigModule.forRoot({
      envFilePath: environment[process.env.NODE_ENV] || '.env',
      load: [config],
      isGlobal: true,
    }),
    LoggerModule,
    IdempotencyModule,
    AppDataModule,
    AuthModule,
    UserModule,
    DatabaseModule,
    CloudinaryModule,
    ImageProxyModule,

    OrdersModule,
    PaymentsModule,
    MembershipModule,
    NotificationsModule,
    CatalogModule,
    EventsModule,
    PublicModule,
    CommerceModule,
    BusinessProfileModule,
    // MigrationModule, // Módulo temporal - deshabilitado
  ],
  controllers: [RootController],
  providers: [
    PaymentsGateway,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TenantInterceptor,
    },
  ],
})
export class AppModule {}
