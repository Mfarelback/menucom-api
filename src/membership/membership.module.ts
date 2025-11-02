import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MembershipController } from './membership.controller';
import { MembershipWebhookController } from './controllers/membership-webhook.controller';
import { SubscriptionPlanController } from './controllers/subscription-plan.controller';
import { MembershipService } from './membership.service';
import { MembershipRepository } from './membership.repository';
import { MembershipProvider } from './membership.provider';
import { MercadoPagoService } from './payment/mercado-pago.service';
import { SubscriptionPlanService } from './services/subscription-plan.service';
import { ResourceLimitService } from './services/resource-limit.service';
import { Membership } from './entities/membership.entity';
import { MembershipAudit } from './entities/membership-audit.entity';
import { SubscriptionPlan } from './entities/subscription-plan.entity';

// Import external entities for ResourceLimitService
import { Catalog } from '../catalog/entities/catalog.entity';
import { CatalogItem } from '../catalog/entities/catalog-item.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Membership,
      MembershipAudit,
      SubscriptionPlan,
      // External entities for ResourceLimitService
      Catalog,
      CatalogItem,
    ]),
  ],
  controllers: [
    MembershipController,
    MembershipWebhookController,
    SubscriptionPlanController,
  ],
  providers: [
    MembershipService,
    MembershipRepository,
    MembershipProvider,
    MercadoPagoService,
    SubscriptionPlanService,
    ResourceLimitService,
  ],
  exports: [
    MembershipService,
    MembershipProvider,
    MercadoPagoService,
    SubscriptionPlanService,
    ResourceLimitService,
  ],
})
export class MembershipModule {}
