import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { ROLES_KEY } from '../decorators/role.decorator';
import { Role } from '../models/roles.model';

@Injectable()
export class RoleGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const requiredRoles = this.reflector.get<Role[]>(
      ROLES_KEY,
      context.getHandler(),
    );

    // Si no hay roles definidos, permitir acceso
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Si no hay usuario en el request, denegar acceso
    if (!user) {
      throw new ForbiddenException('Usuario no autenticado');
    }

    // Si el usuario no tiene rol, denegar acceso
    if (!user.role) {
      throw new ForbiddenException('Usuario sin rol asignado');
    }

    // Verificar si el usuario tiene alguno de los roles requeridos
    const hasRole = requiredRoles.some((role) => {
      // Manejar tanto string como array de roles
      if (Array.isArray(user.role)) {
        return user.role.includes(role);
      } else {
        return user.role === role;
      }
    });

    if (!hasRole) {
      throw new ForbiddenException(
        `No tienes permisos para acceder a este recurso. Roles requeridos: ${requiredRoles.join(
          ', ',
        )}`,
      );
    }

    return true;
  }
}
