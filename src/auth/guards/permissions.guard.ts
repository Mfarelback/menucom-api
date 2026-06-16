import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  PERMISSIONS_KEY,
  CONTEXT_KEY,
  DISABLE_PERMISSIONS_KEY,
} from '../decorators/permissions.decorator';
import { Permission, BusinessContext } from '../models/permissions.model';
import { UserRoleService } from '../services/user-role.service';
import { TenantResolutionService } from '../services/tenant-resolution.service';
import { LoggerService } from '../../core/logger/logger.service';

/**
 * Guard que verifica si el usuario tiene los permisos necesarios
 * en el contexto de negocio especificado.
 * Usa TenantResolutionService para resolver el tenantId (evita duplicación con TenantInterceptor).
 *
 * Uso:
 * @UseGuards(JwtAuthGuard, PermissionsGuard)
 * @RequirePermissions(Permission.CREATE_CATALOG)
 * @BusinessContextDecorator(BusinessContext.RESTAURANT)
 * async createRestaurantMenu() { ... }
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private userRoleService: UserRoleService,
    private logger: LoggerService,
    private readonly tenantResolution: TenantResolutionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const disablePermissions = this.reflector.getAllAndOverride<boolean>(
      DISABLE_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (disablePermissions) {
      return true;
    }

    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const businessContext = this.reflector.getAllAndOverride<BusinessContext>(
      CONTEXT_KEY,
      [context.getHandler(), context.getClass()],
    );

    const contextToUse = businessContext || BusinessContext.GENERAL;

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.userId) {
      this.logger.warn(
        `Acceso denegado: Usuario no presente en el request o sin userId. ` +
          `User object: ${JSON.stringify(user || 'null')}`,
        'PermissionsGuard',
      );
      throw new ForbiddenException('Usuario no autenticado');
    }

    const userId = user.userId;

    if (!request.tenantId) {
      const resolved = await this.tenantResolution.resolveTenantId(
        request,
        userId,
      );
      if (resolved) {
        request.tenantId = resolved;
      }
    }

    const userPermissions = await this.userRoleService.getUserPermissions(
      userId,
      contextToUse,
    );

    const hasRequiredPermission = requiredPermissions.some((permission) =>
      userPermissions.includes(permission),
    );

    if (!hasRequiredPermission) {
      throw new ForbiddenException(
        `No tienes los permisos necesarios. Se requiere uno de: ${requiredPermissions.join(', ')} en el contexto ${contextToUse}`,
      );
    }

    request.businessContext = contextToUse;
    request.userPermissions = userPermissions;

    return true;
  }
}
