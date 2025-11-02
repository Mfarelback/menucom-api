import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRole } from '../entities/user-role.entity';
import {
  RoleType,
  BusinessContext,
  Permission,
  getPermissionsForRole,
} from '../models/permissions.model';

@Injectable()
export class UserRoleService {
  constructor(
    @InjectRepository(UserRole)
    private readonly userRoleRepository: Repository<UserRole>,
  ) {}

  /**
   * Asigna un rol a un usuario en un contexto específico
   */
  async assignRole(
    userId: string,
    role: RoleType,
    context: BusinessContext,
    options?: {
      resourceId?: string;
      grantedBy?: string;
      expiresAt?: Date;
      metadata?: Record<string, any>;
    },
  ): Promise<UserRole> {
    // Verificar si ya existe el rol
    const existingRole = await this.userRoleRepository.findOne({
      where: {
        userId,
        role,
        context,
        resourceId: options?.resourceId || null,
      },
    });

    if (existingRole) {
      // Si existe pero está inactivo, reactivarlo
      if (!existingRole.isActive) {
        existingRole.isActive = true;
        existingRole.expiresAt = options?.expiresAt;
        existingRole.metadata = options?.metadata;
        return await this.userRoleRepository.save(existingRole);
      }

      throw new ConflictException(
        `El usuario ya tiene el rol ${role} en el contexto ${context}`,
      );
    }

    const userRole = this.userRoleRepository.create({
      userId,
      role,
      context,
      resourceId: options?.resourceId,
      grantedBy: options?.grantedBy,
      expiresAt: options?.expiresAt,
      metadata: options?.metadata,
    });

    return await this.userRoleRepository.save(userRole);
  }

  /**
   * Remueve un rol de un usuario
   */
  async revokeRole(
    userId: string,
    role: RoleType,
    context: BusinessContext,
    resourceId?: string,
  ): Promise<void> {
    const userRole = await this.userRoleRepository.findOne({
      where: {
        userId,
        role,
        context,
        resourceId: resourceId || null,
      },
    });

    if (!userRole) {
      throw new NotFoundException('Rol no encontrado');
    }

    await this.userRoleRepository.remove(userRole);
  }

  /**
   * Desactiva un rol sin eliminarlo
   */
  async deactivateRole(
    userId: string,
    role: RoleType,
    context: BusinessContext,
    resourceId?: string,
  ): Promise<UserRole> {
    const userRole = await this.userRoleRepository.findOne({
      where: {
        userId,
        role,
        context,
        resourceId: resourceId || null,
      },
    });

    if (!userRole) {
      throw new NotFoundException('Rol no encontrado');
    }

    userRole.isActive = false;
    return await this.userRoleRepository.save(userRole);
  }

  /**
   * Obtiene todos los roles activos de un usuario
   */
  async getUserRoles(userId: string): Promise<UserRole[]> {
    return await this.userRoleRepository.find({
      where: {
        userId,
        isActive: true,
      },
      order: {
        grantedAt: 'DESC',
      },
    });
  }

  /**
   * Obtiene roles de un usuario filtrados por contexto
   */
  async getUserRolesByContext(
    userId: string,
    context: BusinessContext,
  ): Promise<UserRole[]> {
    return await this.userRoleRepository.find({
      where: {
        userId,
        context,
        isActive: true,
      },
    });
  }

  /**
   * Verifica si un usuario tiene un rol específico en un contexto
   */
  async hasRole(
    userId: string,
    role: RoleType,
    context: BusinessContext,
    resourceId?: string,
  ): Promise<boolean> {
    const count = await this.userRoleRepository.count({
      where: {
        userId,
        role,
        context,
        resourceId: resourceId || null,
        isActive: true,
      },
    });

    return count > 0;
  }

  /**
   * Obtiene todos los permisos de un usuario en un contexto
   */
  async getUserPermissions(
    userId: string,
    context: BusinessContext,
  ): Promise<Permission[]> {
    const roles = await this.getUserRolesByContext(userId, context);

    const permissionsSet = new Set<Permission>();

    for (const userRole of roles) {
      // Verificar si el rol no ha expirado
      if (userRole.expiresAt && new Date() > userRole.expiresAt) {
        continue;
      }

      const permissions = getPermissionsForRole(userRole.role, context);
      permissions.forEach((p) => permissionsSet.add(p));
    }

    return Array.from(permissionsSet);
  }

  /**
   * Verifica si un usuario tiene un permiso específico en un contexto
   */
  async userHasPermission(
    userId: string,
    context: BusinessContext,
    permission: Permission,
  ): Promise<boolean> {
    const permissions = await this.getUserPermissions(userId, context);
    return permissions.includes(permission);
  }

  /**
   * Obtiene todos los usuarios con un rol específico en un contexto
   */
  async getUsersByRole(
    role: RoleType,
    context: BusinessContext,
    resourceId?: string,
  ): Promise<UserRole[]> {
    return await this.userRoleRepository.find({
      where: {
        role,
        context,
        resourceId: resourceId || null,
        isActive: true,
      },
      relations: ['user'],
    });
  }

  /**
   * Limpia roles expirados (puede ejecutarse como cron job)
   */
  async cleanupExpiredRoles(): Promise<number> {
    const expiredRoles = await this.userRoleRepository.find({
      where: {
        isActive: true,
      },
    });

    const now = new Date();
    const rolesToDeactivate = expiredRoles.filter(
      (role) => role.expiresAt && role.expiresAt < now,
    );

    if (rolesToDeactivate.length === 0) {
      return 0;
    }

    rolesToDeactivate.forEach((role) => {
      role.isActive = false;
    });

    await this.userRoleRepository.save(rolesToDeactivate);
    return rolesToDeactivate.length;
  }

  /**
   * Obtiene el rol más privilegiado de un usuario en un contexto
   * Útil para determinar el nivel de acceso máximo
   */
  async getHighestRole(
    userId: string,
    context: BusinessContext,
  ): Promise<RoleType | null> {
    const roles = await this.getUserRolesByContext(userId, context);

    if (roles.length === 0) {
      return null;
    }

    // Jerarquía de roles (del más alto al más bajo)
    const roleHierarchy = [
      RoleType.ADMIN,
      RoleType.OWNER,
      RoleType.MANAGER,
      RoleType.OPERATOR,
      RoleType.CUSTOMER,
    ];

    for (const hierarchyRole of roleHierarchy) {
      if (roles.some((r) => r.role === hierarchyRole)) {
        return hierarchyRole;
      }
    }

    return roles[0].role;
  }
}
