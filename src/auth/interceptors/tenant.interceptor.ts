import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { TenantResolutionService } from '../services/tenant-resolution.service';

@Injectable()
export class TenantInterceptor implements NestInterceptor {
  constructor(
    private readonly tenantResolution: TenantResolutionService,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();

    if (!request.user) {
      return next.handle();
    }

    const resolved = await this.tenantResolution.resolveTenantId(
      request,
      request.user.userId,
    );

    if (resolved) {
      request.tenantId = resolved;
    }

    return next.handle();
  }
}
