// Entities
export { Membership } from './entities/membership.entity';
export {
  MembershipAudit,
  MembershipAuditAction,
} from './entities/membership-audit.entity';

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

// Services and Providers
export { MembershipService } from './membership.service';
export { MembershipRepository } from './membership.repository';
export { MembershipProvider } from './membership.provider';

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
