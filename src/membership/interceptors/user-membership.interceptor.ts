import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { MembershipService } from '../membership.service';

@Injectable()
export class UserMembershipInterceptor implements NestInterceptor {
  private readonly logger = new Logger(UserMembershipInterceptor.name);

  constructor(private readonly membershipService: MembershipService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      tap(async (data) => {
        // Check if this is a user creation response
        if (data && data.id && context.getHandler().name === 'create') {
          try {
            await this.membershipService.createMembership(data.id);
            this.logger.log(`Created membership for new user: ${data.id}`);
          } catch (error) {
            this.logger.warn(
              `Failed to create membership for user ${data.id}: ${error.message}`,
            );
          }
        }
      }),
    );
  }
}
