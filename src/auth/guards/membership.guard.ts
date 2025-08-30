import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { MembershipService } from '../../membership/membership.service';
import { MembershipFeature } from '../../membership/enums/membership-plan.enum';

export const MEMBERSHIP_FEATURE_KEY = 'membershipFeature';
export const RequireMembershipFeature = (feature: MembershipFeature) =>
  SetMetadata(MEMBERSHIP_FEATURE_KEY, feature);

@Injectable()
export class MembershipGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private membershipService: MembershipService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredFeature = this.reflector.getAllAndOverride<MembershipFeature>(
      MEMBERSHIP_FEATURE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredFeature) {
      return true; // No feature requirement, allow access
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.id) {
      throw new ForbiddenException('User not authenticated');
    }

    try {
      await this.membershipService.validateAccess(user.id, requiredFeature);
      return true;
    } catch (error) {
      throw new ForbiddenException(
        `Access denied: ${error.message || 'Insufficient membership plan'}`,
      );
    }
  }
}
