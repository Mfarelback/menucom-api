import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Optional,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  PERMISSIONS_KEY,
  CONTEXT_KEY,
  DISABLE_PERMISSIONS_KEY,
} from '../decorators/permissions.decorator';
import { Permission, BusinessContext } from '../models/permissions.model';
import { UserRoleService } from '../services/user-role.service';
import { TenantResolutionService } from '../services/tenant-resolution.service';
import { Commerce } from '../../commerce/entities/commerce.entity';
import { LoggerService } from '../../core/logger/logger.service';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private userRoleService: UserRoleService,
    private logger: LoggerService,
    private readonly tenantResolution: TenantResolutionService,
    @Optional()
    @InjectRepository(Commerce)
    private readonly commerceRepository: Repository<Commerce> | null,
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

    let contextToUse = businessContext || BusinessContext.GENERAL;

    if (!businessContext && request.tenantId && this.commerceRepository) {
      const commerce = await this.commerceRepository.findOne({
        where: { id: request.tenantId },
        select: ['context'],
      });
      if (commerce) {
        contextToUse = commerce.context;
        this.logger.debug(
          `Contexto resuelto desde commerce: ${contextToUse} para tenant ${request.tenantId}`,
          'PermissionsGuard',
        );
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
