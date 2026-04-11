import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Permission, BusinessContext } from '../models/permissions.model';
import { UserRoleService } from '../services/user-role.service';

export const PERMISSIONS_KEY = 'permissions';
export const CONTEXT_KEY = 'business_context';

/**
 * Guard que verifica si el usuario tiene los permisos necesarios
 * en el contexto de negocio especificado
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
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Si no hay permisos requeridos, permitir acceso
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const businessContext = this.reflector.getAllAndOverride<BusinessContext>(
      CONTEXT_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Si no hay contexto especificado, usar GENERAL
    const contextToUse = businessContext || BusinessContext.GENERAL;

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.userId) {
      throw new ForbiddenException('Usuario no autenticado');
    }

    const userId = user.userId;

    // Obtener permisos del usuario en el contexto
    const userPermissions = await this.userRoleService.getUserPermissions(
      userId,
      contextToUse,
    );

    // Verificar si el usuario tiene al menos uno de los permisos requeridos
    const hasRequiredPermission = requiredPermissions.some((permission) =>
      userPermissions.includes(permission),
    );

    if (!hasRequiredPermission) {
      throw new ForbiddenException(
        `No tienes los permisos necesarios. Se requiere uno de: ${requiredPermissions.join(', ')} en el contexto ${contextToUse}`,
      );
    }

    // Adjuntar contexto y permisos al request para uso posterior
    request.businessContext = contextToUse;
    request.userPermissions = userPermissions;

    return true;
  }
}
