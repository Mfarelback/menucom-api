// Entities
export { Membership } from './entities/membership.entity';
export {
  MembershipAudit,
  MembershipAuditAction,
} from './entities/membership-audit.entity';
export {
  SubscriptionPlan,
  PlanStatus,
  PlanType,
} from './entities/subscription-plan.entity';
export {
  SubscriptionDiscount,
  DiscountType,
  DiscountStatus,
} from './entities/subscription-discount.entity';
export {
  SubscriptionPayment,
  PaymentStatus,
  PaymentType,
} from './entities/subscription-payment.entity';

// Enums and Types
export {
  MembershipPlan,
  MembershipFeature,
  PLAN_FEATURES,
  PLAN_LIMITS,
} from './enums/membership-plan.enum';

// DTOs
export { SubscribeMembershipDto } from './dto/subscribe-membership.dto';
export { UpdateMembershipDto } from './dto/update-membership.dto';
export { MembershipResponseDto } from './dto/membership-response.dto';
export {
  CreateSubscriptionDiscountDto,
  UpdateSubscriptionDiscountDto,
  ApplyDiscountDto,
  ValidateDiscountResponseDto,
} from './dto/subscription-discount.dto';

// Services and Providers
export { MembershipService } from './membership.service';
export { MembershipRepository } from './membership.repository';
export { MembershipProvider } from './membership.provider';
export { SubscriptionPlanService } from './services/subscription-plan.service';
export { MercadoPagoService } from './payment/mercado-pago.service';
export { MercadoPagoSubscriptionService } from './payment/mercado-pago-subscription.service';
export { SubscriptionDiscountService } from './payment/subscription-discount.service';

// Guards and Decorators
export {
  RequireMembershipFeature,
  MEMBERSHIP_FEATURE_KEY,
} from '../auth/guards/membership.guard';
export {
  CurrentMembership,
  CurrentUserPlan,
  CurrentUserFeatures,
} from './decorators/membership.decorator';

// Module
export { MembershipModule } from './membership.module';
