import { Injectable, ForbiddenException, Logger } from '@nestjs/common';
import { FindOptionsWhere } from 'typeorm';
import { UserRoleService } from './user-role.service';
import { TenantContext } from '../types/tenant-context.types';

interface HasCommerceId {
  commerceId?: string | null;
}

interface HasTenantId {
  tenantId?: string | null;
}

@Injectable()
export class TenantResolutionService {
  private readonly logger = new Logger(TenantResolutionService.name);

  constructor(private readonly userRoleService: UserRoleService) {}

  /**
   * Construye un filtro FindOptionsWhere para entidades que tienen
   * commerceId y tenantId, resolviendo el tenant desde TenantContext.
   */
  static buildTenantFilter<T extends HasCommerceId & HasTenantId>(
    tenant: TenantContext,
  ): FindOptionsWhere<T> {
    if (tenant.commerceId) {
      return { commerceId: tenant.commerceId } as FindOptionsWhere<T>;
    }
    return { tenantId: tenant.userId } as FindOptionsWhere<T>;
  }

  async resolveTenantId(
    request: any,
    userId: string,
  ): Promise<string | undefined> {
    const headerTenantId = request.headers['x-tenant-id'] as string | undefined;

    if (headerTenantId) {
      const hasAccess = await this.userRoleService.hasAccessToCommerce(
        userId,
        headerTenantId,
      );
      if (!hasAccess) {
        throw new ForbiddenException(
          'No tienes acceso al comercio especificado',
        );
      }

      this.logger.debug(
        `Tenant resuelto desde header: ${headerTenantId} para usuario ${userId}`,
      );
      return headerTenantId;
    }

    if (request.user?.commerceId) {
      this.logger.debug(
        `Tenant resuelto desde JWT: ${request.user.commerceId} para usuario ${userId}`,
      );
      return request.user.commerceId;
    }

    const roles = await this.userRoleService.getUserRoles(userId);
    const commerceRole = roles.find((r) => r.resourceId);
    if (commerceRole?.resourceId) {
      this.logger.debug(
        `Tenant resuelto desde roles: ${commerceRole.resourceId} para usuario ${userId}`,
      );
      return commerceRole.resourceId;
    }

    return undefined;
  }

  async resolveTenantIdOrFail(request: any, userId: string): Promise<string> {
    const tenantId = await this.resolveTenantId(request, userId);
    if (!tenantId) {
      throw new ForbiddenException(
        'No se pudo resolver el contexto de comercio',
      );
    }
    return tenantId;
  }
}
