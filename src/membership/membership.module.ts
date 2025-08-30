import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MembershipController } from './membership.controller';
import { MembershipWebhookController } from './controllers/membership-webhook.controller';
import { MembershipService } from './membership.service';
import { MembershipRepository } from './membership.repository';
import { MembershipProvider } from './membership.provider';
import { MercadoPagoService } from './payment/mercado-pago.service';
import { Membership } from './entities/membership.entity';
import { MembershipAudit } from './entities/membership-audit.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Membership, MembershipAudit])],
  controllers: [MembershipController, MembershipWebhookController],
  providers: [
    MembershipService,
    MembershipRepository,
    MembershipProvider,
    MercadoPagoService,
  ],
  exports: [MembershipService, MembershipProvider, MercadoPagoService],
})
export class MembershipModule {}
