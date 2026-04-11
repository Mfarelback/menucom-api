import { Module, forwardRef } from '@nestjs/common';
import { OrdersController } from './controllers/orders.controller';
import { OrdersService } from './services/orders.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order.item.entity';
import { PaymentsModule } from 'src/payments/payments.module';
import { UserModule } from 'src/user/user.module';
import { Catalog } from 'src/catalog/entities/catalog.entity';
import { AppDataModule } from 'src/app-data/app-data.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem, Catalog]),
    forwardRef(() => PaymentsModule),
    UserModule,
    AppDataModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
