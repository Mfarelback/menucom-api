import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { MembershipService } from '../membership.service';

interface RequestWithUser extends Request {
  user?: {
    id: string;
    email: string;
    [key: string]: any;
  };
  membership?: any;
}

@Injectable()
export class MembershipMiddleware implements NestMiddleware {
  private readonly logger = new Logger(MembershipMiddleware.name);

  constructor(private readonly membershipService: MembershipService) {}

  async use(req: RequestWithUser, res: Response, next: NextFunction) {
    try {
      // Only add membership info if user is authenticated
      if (req.user && req.user.id) {
        const membership = await this.membershipService.getUserMembership(
          req.user.id,
        );
        req.membership = membership;

        // Also add membership info to user object for easier access
        req.user.membership = membership;
        req.user.plan = membership.plan;
        req.user.features = membership.features;
      }
    } catch (error) {
      this.logger.warn(
        `Failed to load membership for user ${req.user?.id}: ${error.message}`,
      );
      // Continue without membership info - don't block the request
    }

    next();
  }
}
