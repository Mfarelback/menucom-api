import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../user/entities/user.entity';
import { UserRole } from '../auth/entities/user-role.entity';
import { Catalog } from '../catalog/entities/catalog.entity';
import { CatalogItem } from '../catalog/entities/catalog-item.entity';
import { Order } from '../orders/entities/order.entity';
import { Commerce } from '../commerce/entities/commerce.entity';
import { PublicController } from './controllers/public.controller';
import { PublicService } from './services/public.service';
import { MembershipModule } from '../membership/membership.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      UserRole,
      Catalog,
      CatalogItem,
      Order,
      Commerce,
    ]),
    MembershipModule,
  ],
  controllers: [PublicController],
  providers: [PublicService],
  exports: [PublicService],
})
export class PublicModule {}
