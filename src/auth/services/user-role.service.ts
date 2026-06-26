import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { UserRole } from '../entities/user-role.entity';
import { Commerce } from '../../commerce/entities/commerce.entity';
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
    @InjectRepository(Commerce)
    private readonly commerceRepository: Repository<Commerce>,
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
   * Busca un rol por su ID
   */
  async findRoleById(roleId: string): Promise<UserRole> {
    const userRole = await this.userRoleRepository.findOne({
      where: { id: roleId },
    });

    if (!userRole) {
      throw new NotFoundException('Rol no encontrado');
    }

    return userRole;
  }

  /**
   * Actualiza un rol existente por su ID
   */
  async updateRole(
    roleId: string,
    updateData: {
      isActive?: boolean;
      expiresAt?: string;
      metadata?: Record<string, any>;
    },
  ): Promise<UserRole> {
    const userRole = await this.userRoleRepository.findOne({
      where: { id: roleId },
    });

    if (!userRole) {
      throw new NotFoundException('Rol no encontrado');
    }

    if (updateData.isActive !== undefined) {
      userRole.isActive = updateData.isActive;
    }

    if (updateData.expiresAt !== undefined) {
      userRole.expiresAt = new Date(updateData.expiresAt);
    }

    if (updateData.metadata !== undefined) {
      userRole.metadata = updateData.metadata;
    }

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
   * Obtiene roles de un usuario con filtros combinados (contexto y/o resourceId)
   * Útil para consultar roles específicos de un comercio
   */
  async getUserRolesFiltered(
    userId: string,
    filters?: {
      context?: BusinessContext;
      resourceId?: string;
    },
  ): Promise<UserRole[]> {
    const where: any = {
      userId,
      isActive: true,
    };

    if (filters?.context) {
      where.context = filters.context;
    }

    if (filters?.resourceId !== undefined) {
      where.resourceId = filters.resourceId;
    }

    return await this.userRoleRepository.find({
      where,
      order: {
        grantedAt: 'DESC',
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

  /**
   * Cambia el rol legacy (rubro) del usuario y sincroniza con user_roles
   * Mapea categorías de negocio a roles del sistema
   *
   * Mapeo (sincronizado con frontend TypeComerceModel):
   * - 'retail', 'water_distributor', 'grocery', 'food', 'clothes', 'accessories',
   *   'electronics', 'pharmacy', 'beauty', 'construction', 'automotive', 'pets' -> 'owner'
   * - 'customer' -> 'customer'
   * - 'admin' -> 'admin'
   */
  async changeOwnRole(
    userId: string,
    newLegacyRole: string,
  ): Promise<{ userRole: string; userRolesUpdated: boolean }> {
    const ownerRoles = [
      'retail',
      'water_distributor',
      'grocery',
      'food',
      'clothes',
      'accessories',
      'electronics',
      'pharmacy',
      'beauty',
      'construction',
      'automotive',
      'pets',
      'events',
    ];

    let systemRole: RoleType;
    let businessContext: BusinessContext;
    if (newLegacyRole === 'customer') {
      systemRole = RoleType.CUSTOMER;
      businessContext = BusinessContext.GENERAL;
    } else if (newLegacyRole === 'admin') {
      systemRole = RoleType.ADMIN;
      businessContext = BusinessContext.GENERAL;
    } else if (ownerRoles.includes(newLegacyRole)) {
      systemRole = RoleType.OWNER;
      if (newLegacyRole === 'events') {
        businessContext = BusinessContext.EVENTS;
      } else if (newLegacyRole === 'retail') {
        businessContext = BusinessContext.RETAIL;
      } else {
        businessContext = BusinessContext.GENERAL;
      }
    } else {
      systemRole = RoleType.CUSTOMER;
      businessContext = BusinessContext.GENERAL;
    }

    // 1. Actualizar user.role en tabla user
    await this.userRoleRepository.manager.query(
      `UPDATE public.user SET role = $1, "updatedAt" = NOW() WHERE id = $2`,
      [newLegacyRole, userId],
    );

    // 2. Sincronizar con user_roles
    // Eliminar el rol actual en contexto general/events y asignar el nuevo
    const existingRole = await this.userRoleRepository.findOne({
      where: [
        {
          userId,
          context: BusinessContext.GENERAL,
          resourceId: IsNull(),
        },
        {
          userId,
          context: BusinessContext.EVENTS,
          resourceId: IsNull(),
        },
      ],
    });

    if (existingRole) {
      existingRole.role = systemRole;
      existingRole.context = businessContext;
      existingRole.isActive = true;
      existingRole.grantedAt = new Date();
      await this.userRoleRepository.save(existingRole);
    } else {
      await this.assignRole(userId, systemRole, businessContext, {
        grantedBy: 'system',
        metadata: { reason: 'role_change', legacyRole: newLegacyRole },
      });
    }

    return {
      userRole: newLegacyRole,
      userRolesUpdated: true,
    };
  }

  /**
   * Verifica si un usuario tiene acceso a un comercio específico
   * Un usuario tiene acceso si:
   * 1. Tiene algún rol activo con resourceId = commerceId, o
   * 2. Es el ownerId del commerce (fallback para usuarios legacy)
   */
  async hasAccessToCommerce(
    userId: string,
    commerceId: string,
  ): Promise<boolean> {
    const roleCount = await this.userRoleRepository.count({
      where: {
        userId,
        resourceId: commerceId,
        isActive: true,
      },
    });
    if (roleCount > 0) return true;

    const commerce = await this.commerceRepository.findOne({
      where: { id: commerceId },
      select: ['ownerId'],
    });
    return commerce?.ownerId === userId;
  }

  /**
   * Identifica si un usuario es organizador de eventos
   * Verifica tanto el rol OWNER (nuevo) como EVENT_ORGANIZER (legacy) en contexto EVENTS
   */
  async isEventOrganizer(userId: string): Promise<boolean> {
    const isOwner = await this.hasRole(
      userId,
      RoleType.OWNER,
      BusinessContext.EVENTS,
    );
    const isLegacyOrganizer = await this.hasRole(
      userId,
      RoleType.EVENT_ORGANIZER,
      BusinessContext.EVENTS,
    );
    return isOwner || isLegacyOrganizer;
  }

  /**
   * Identifica si un usuario es dueño de restaurante
   */
  async isRestaurantOwner(userId: string): Promise<boolean> {
    return await this.hasRole(
      userId,
      RoleType.OWNER,
      BusinessContext.RESTAURANT,
    );
  }

  /**
   * Identifica si un usuario es dueño de tienda (wardrobe)
   */
  async isWardrobeOwner(userId: string): Promise<boolean> {
    return await this.hasRole(userId, RoleType.OWNER, BusinessContext.WARDROBE);
  }

  /**
   * Identifica si un usuario es vendedor de marketplace
   */
  async isMarketplaceOwner(userId: string): Promise<boolean> {
    return await this.hasRole(
      userId,
      RoleType.OWNER,
      BusinessContext.MARKETPLACE,
    );
  }

  /**
   * Obtiene el tipo de negocio principal del usuario
   * Basado en sus roles OWNER
   */
  async getUserBusinessType(userId: string): Promise<string | null> {
    const roles = await this.getUserRoles(userId);

    // Buscar roles OWNER primero (son comerciantes)
    const ownerRoles = roles.filter((r) => r.role === RoleType.OWNER);
    if (ownerRoles.length > 0) {
      // Si tiene múltiples, devolver el primero o hacer lógica más compleja
      return ownerRoles[0].context;
    }

    // Si no es OWNER, verificar si es admin
    const adminRole = roles.find((r) => r.role === RoleType.ADMIN);
    if (adminRole) {
      return 'admin';
    }

    // Si no, es customer
    const customerRole = roles.find((r) => r.role === RoleType.CUSTOMER);
    if (customerRole) {
      return 'customer';
    }

    return null;
  }

  /**
   * Obtiene todos los usuarios que son organizadores de eventos
   * Incluye tanto OWNER como EVENT_ORGANIZER (legacy) en contexto EVENTS
   */
  async getEventOrganizers(): Promise<UserRole[]> {
    return await this.userRoleRepository.find({
      where: [
        { role: RoleType.OWNER, context: BusinessContext.EVENTS, isActive: true },
        { role: RoleType.EVENT_ORGANIZER, context: BusinessContext.EVENTS, isActive: true },
      ],
      relations: ['user'],
    });
  }

  /**
   * Obtiene todos los usuarios con roles (activos e inactivos) en un commerce específico
   * Útil para el endpoint my-team: listar el equipo que tiene acceso a un comercio
   */
  async getTeamByCommerce(commerceId: string): Promise<UserRole[]> {
    return await this.userRoleRepository.find({
      where: {
        resourceId: commerceId,
      },
      relations: ['user'],
      order: {
        grantedAt: 'DESC',
      },
    });
  }

  /**
   * Verifica si un usuario (OWNER o ADMIN) puede gestionar el equipo de un comercio
   * - ADMIN/OPERATOR con manage_users en GENERAL: acceso total
   * - OWNER del comercio: solo puede asignar MANAGER/OPERATOR a su propio comercio
   * - OWNER no puede eliminarse ni desactivarse a sí mismo
   */
  async authorizeTeamManagement(
    callerUserId: string,
    targetRole: RoleType,
    targetContext: BusinessContext,
    targetResourceId?: string,
    targetUserId?: string,
  ): Promise<void> {
    // 1. ADMIN u OPERATOR con manage_users en GENERAL: acceso total
    const generalPermissions = await this.getUserPermissions(
      callerUserId,
      BusinessContext.GENERAL,
    );
    if (generalPermissions.includes(Permission.MANAGE_USERS)) {
      return;
    }

    // 2. OWNER debe especificar el commerce al que asigna
    if (!targetResourceId) {
      throw new ConflictException(
        'Debes especificar el resourceId (commerceId) para asignar un rol a tu equipo.',
      );
    }

    // 3. Verificar que el caller es OWNER del commerce
    const hasAccess = await this.hasAccessToCommerce(
      callerUserId,
      targetResourceId,
    );
    if (!hasAccess) {
      throw new ConflictException(
        'No tienes acceso a este comercio para gestionar su equipo.',
      );
    }

    // 4. Validar que el contexto coincide con el tipo de comercio
    const commerce = await this.commerceRepository.findOne({
      where: { id: targetResourceId },
      select: ['context'],
    });
    if (commerce && commerce.context !== targetContext) {
      throw new ConflictException(
        `El contexto '${targetContext}' no coincide con el tipo de comercio (${commerce.context}).`,
      );
    }

    // 5. OWNER solo puede asignar MANAGER u OPERATOR (no ADMIN ni OWNER)
    const forbiddenRoles: RoleType[] = [RoleType.ADMIN, RoleType.OWNER];
    if (forbiddenRoles.includes(targetRole)) {
      throw new ConflictException(
        'Solo los administradores del sistema pueden gestionar roles de ADMIN u OWNER.',
      );
    }

    // 6. OWNER no puede eliminarse ni desactivarse a sí mismo
    if (targetUserId && targetUserId === callerUserId) {
      throw new ConflictException(
        'No puedes modificar tu propio rol. Pide a otro administrador que lo haga.',
      );
    }
  }
}
