import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
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
// import { MigrationModule } from './scripts/migration.module'; // Módulo temporal de migraciones
import { LoggerModule } from './core/logger';
import { RootController } from './core/controllers/root.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: environment[process.env.NODE_ENV] || '.env',
      load: [config],
      isGlobal: true,
    }),
    LoggerModule,
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
    // MigrationModule, // Módulo temporal - deshabilitado
  ],
  controllers: [RootController],
  providers: [
    PaymentsGateway,
  ],
})
export class AppModule {}
