import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MembershipController } from './membership.controller';
import { MembershipWebhookController } from './controllers/membership-webhook.controller';
import { SubscriptionPlanController } from './controllers/subscription-plan.controller';
import { MembershipService } from './membership.service';
import { MembershipRepository } from './membership.repository';
import { MercadoPagoService } from './payment/mercado-pago.service';
import { MercadoPagoSubscriptionService } from './payment/mercado-pago-subscription.service';
import { SubscriptionDiscountService } from './payment/subscription-discount.service';
import { SubscriptionPlanService } from './services/subscription-plan.service';
import { ResourceLimitService } from './services/resource-limit.service';
import { Membership } from './entities/membership.entity';
import { MembershipAudit } from './entities/membership-audit.entity';
import { SubscriptionPlan } from './entities/subscription-plan.entity';
import { SubscriptionDiscount } from './entities/subscription-discount.entity';
import { SubscriptionPayment } from './entities/subscription-payment.entity';

import { MembershipAdminController } from './controllers/membership-admin.controller';
import { MembershipAdminService } from './services/membership-admin.service';
import { Catalog } from '../catalog/entities/catalog.entity';
import { CatalogItem } from '../catalog/entities/catalog-item.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Membership,
      MembershipAudit,
      SubscriptionPlan,
      SubscriptionDiscount,
      SubscriptionPayment,
      Catalog,
      CatalogItem,
    ]),
  ],
  controllers: [
    MembershipController,
    MembershipWebhookController,
    SubscriptionPlanController,
    MembershipAdminController,
  ],
  providers: [
    MembershipService,
    MembershipRepository,
    MercadoPagoService,
    MercadoPagoSubscriptionService,
    SubscriptionDiscountService,
    SubscriptionPlanService,
    ResourceLimitService,
    MembershipAdminService,
  ],
  exports: [
    MembershipService,
    MembershipAdminService,
    MercadoPagoService,
    MercadoPagoSubscriptionService,
    SubscriptionDiscountService,
    SubscriptionPlanService,
    ResourceLimitService,
  ],
})
export class MembershipModule {}
