import { Module } from '@nestjs/common';
import { PaymentsGateway } from './ws/payments.gateway';
import { environment } from './enviroment';
import { DatabaseModule } from './database/database.module';
import { ConfigModule } from '@nestjs/config';
import config from './config';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { CloudinaryModule } from './cloudinary/cloudinary.module';
import { MenuModule } from './menu/menu.module';
import { WardrobesModule } from './wardrobes/wardrobes.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { ImageProxyModule } from './image-proxy/image-proxy.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: environment[process.env.NODE_ENV] || '.env',
      load: [config],
      isGlobal: true,
    }),
    AuthModule,
    UserModule,
    DatabaseModule,
    CloudinaryModule,
    ImageProxyModule,
    MenuModule,
    WardrobesModule,
    OrdersModule,
    PaymentsModule,
  ],
  providers: [PaymentsGateway],
})
export class AppModule {}
