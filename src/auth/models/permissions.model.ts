/**
 * Tipos de roles que un usuario puede tener
 * Estos roles son independientes del contexto de negocio
 */
export enum RoleType {
  CUSTOMER = 'customer', // Cliente final del sistema
  OWNER = 'owner', // Propietario de un negocio
  ADMIN = 'admin', // Administrador del sistema
  OPERATOR = 'operator', // Operador del sistema
  MANAGER = 'manager', // Gerente de un negocio (subordinado al OWNER)
}

/**
 * Contextos de negocio en los que un rol puede aplicarse
 * Permite que un usuario tenga diferentes roles en diferentes contextos
 */
export enum BusinessContext {
  RESTAURANT = 'restaurant', // Contexto de restaurantes
  WARDROBE = 'wardrobe', // Contexto de guardarropas
  MARKETPLACE = 'marketplace', // Contexto de marketplace
  GENERAL = 'general', // Contexto general del sistema
}

/**
 * Permisos específicos que pueden ser otorgados
 * Estos permisos son independientes de roles y contextos
 */
export enum Permission {
  // Permisos de catálogo/productos
  CREATE_CATALOG = 'create_catalog',
  READ_CATALOG = 'read_catalog',
  UPDATE_CATALOG = 'update_catalog',
  DELETE_CATALOG = 'delete_catalog',

  // Permisos de items/productos
  CREATE_ITEM = 'create_item',
  READ_ITEM = 'read_item',
  UPDATE_ITEM = 'update_item',
  DELETE_ITEM = 'delete_item',

  // Permisos de órdenes
  CREATE_ORDER = 'create_order',
  READ_ORDER = 'read_order',
  UPDATE_ORDER = 'update_order',
  CANCEL_ORDER = 'cancel_order',

  // Permisos administrativos
  MANAGE_USERS = 'manage_users',
  MANAGE_PAYMENTS = 'manage_payments',
  VIEW_ANALYTICS = 'view_analytics',
  MANAGE_ROLES = 'manage_roles',

  // Permisos de membership
  MANAGE_SUBSCRIPTIONS = 'manage_subscriptions',
  VIEW_SUBSCRIPTION_PLANS = 'view_subscription_plans',
}

/**
 * Mapeo de roles a permisos por contexto
 * Define qué permisos tiene cada rol en cada contexto de negocio
 */
export const ROLE_PERMISSIONS_BY_CONTEXT: Record<
  BusinessContext,
  Partial<Record<RoleType, Permission[]>>
> = {
  [BusinessContext.GENERAL]: {
    [RoleType.CUSTOMER]: [
      Permission.READ_CATALOG,
      Permission.READ_ITEM,
      Permission.CREATE_ORDER,
      Permission.READ_ORDER,
      Permission.CANCEL_ORDER,
    ],
    [RoleType.ADMIN]: Object.values(Permission), // Todos los permisos
    [RoleType.OPERATOR]: [
      Permission.MANAGE_USERS,
      Permission.VIEW_ANALYTICS,
      Permission.MANAGE_ROLES,
    ],
  },

  [BusinessContext.RESTAURANT]: {
    [RoleType.OWNER]: [
      Permission.CREATE_CATALOG,
      Permission.READ_CATALOG,
      Permission.UPDATE_CATALOG,
      Permission.DELETE_CATALOG,
      Permission.CREATE_ITEM,
      Permission.READ_ITEM,
      Permission.UPDATE_ITEM,
      Permission.DELETE_ITEM,
      Permission.READ_ORDER,
      Permission.UPDATE_ORDER,
      Permission.VIEW_ANALYTICS,
      Permission.MANAGE_PAYMENTS,
    ],
    [RoleType.MANAGER]: [
      Permission.READ_CATALOG,
      Permission.UPDATE_CATALOG,
      Permission.CREATE_ITEM,
      Permission.READ_ITEM,
      Permission.UPDATE_ITEM,
      Permission.DELETE_ITEM,
      Permission.READ_ORDER,
      Permission.UPDATE_ORDER,
    ],
    [RoleType.CUSTOMER]: [
      Permission.READ_CATALOG,
      Permission.READ_ITEM,
      Permission.CREATE_ORDER,
      Permission.READ_ORDER,
    ],
  },

  [BusinessContext.WARDROBE]: {
    [RoleType.OWNER]: [
      Permission.CREATE_CATALOG,
      Permission.READ_CATALOG,
      Permission.UPDATE_CATALOG,
      Permission.DELETE_CATALOG,
      Permission.CREATE_ITEM,
      Permission.READ_ITEM,
      Permission.UPDATE_ITEM,
      Permission.DELETE_ITEM,
      Permission.VIEW_ANALYTICS,
    ],
    [RoleType.MANAGER]: [
      Permission.READ_CATALOG,
      Permission.UPDATE_CATALOG,
      Permission.CREATE_ITEM,
      Permission.READ_ITEM,
      Permission.UPDATE_ITEM,
      Permission.DELETE_ITEM,
    ],
    [RoleType.CUSTOMER]: [Permission.READ_CATALOG, Permission.READ_ITEM],
  },

  [BusinessContext.MARKETPLACE]: {
    [RoleType.OWNER]: [
      Permission.CREATE_CATALOG,
      Permission.READ_CATALOG,
      Permission.UPDATE_CATALOG,
      Permission.DELETE_CATALOG,
      Permission.CREATE_ITEM,
      Permission.READ_ITEM,
      Permission.UPDATE_ITEM,
      Permission.DELETE_ITEM,
      Permission.MANAGE_PAYMENTS,
      Permission.VIEW_ANALYTICS,
    ],
    [RoleType.CUSTOMER]: [
      Permission.READ_CATALOG,
      Permission.READ_ITEM,
      Permission.CREATE_ORDER,
      Permission.READ_ORDER,
      Permission.CANCEL_ORDER,
    ],
  },
};

/**
 * Helper para obtener permisos de un rol en un contexto específico
 */
export function getPermissionsForRole(
  role: RoleType,
  context: BusinessContext,
): Permission[] {
  const contextPermissions = ROLE_PERMISSIONS_BY_CONTEXT[context];
  if (!contextPermissions) return [];

  return contextPermissions[role] || [];
}

/**
 * Helper para verificar si un rol tiene un permiso en un contexto
 */
export function hasPermission(
  role: RoleType,
  context: BusinessContext,
  permission: Permission,
): boolean {
  const permissions = getPermissionsForRole(role, context);
  return permissions.includes(permission);
}
