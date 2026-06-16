import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OrdersController } from './controllers/orders.controller';
import { OrdersService } from './services/orders.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order.item.entity';
import { PaymentsModule } from '../payments/payments.module';
import { UserModule } from '../user/user.module';
import { Catalog } from '../catalog/entities/catalog.entity';
import { CatalogItem } from '../catalog/entities/catalog-item.entity';
import { Commerce } from '../commerce/entities/commerce.entity';
import { AppDataModule } from '../app-data/app-data.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Order,
      OrderItem,
      Catalog,
      CatalogItem,
      Commerce,
    ]),
    forwardRef(() => PaymentsModule),
    forwardRef(() => AuthModule),
    UserModule,
    AppDataModule,
    NotificationsModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
