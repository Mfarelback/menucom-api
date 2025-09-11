import { Module, forwardRef } from '@nestjs/common';
import { OrdersController } from './controllers/orders.controller';
import { OrdersService } from './services/orders.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order.item.entity';
import { PaymentsModule } from 'src/payments/payments.module';
import { UserModule } from 'src/user/user.module';
import { Menu } from 'src/menu/entities/menu.entity';
import { Wardrobes } from 'src/wardrobes/entities/wardrobes.entity';
import { AppDataModule } from 'src/app-data/app-data.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem, Menu, Wardrobes]),
    forwardRef(() => PaymentsModule),
    UserModule,
    AppDataModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
