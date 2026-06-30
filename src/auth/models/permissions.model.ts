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
  EVENT_ORGANIZER = 'event_organizer', // Organizador de eventos
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
  EVENTS = 'events', // Contexto de eventos y tickets
  RETAIL = 'retail', // Contexto de comercio minorista (vende de todo)
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

  // Permisos de eventos
  CREATE_EVENT = 'create_event',
  READ_EVENT = 'read_event',
  UPDATE_EVENT = 'update_event',
  DELETE_EVENT = 'delete_event',
  MANAGE_TICKETS = 'manage_tickets',
  VALIDATE_TICKETS = 'validate_tickets',
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
    [RoleType.OPERATOR]: [Permission.VIEW_ANALYTICS],
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
      Permission.MANAGE_USERS,
      Permission.MANAGE_ROLES,
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
      Permission.MANAGE_PAYMENTS,
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
      Permission.MANAGE_PAYMENTS,
      Permission.MANAGE_USERS,
      Permission.MANAGE_ROLES,
    ],
    [RoleType.MANAGER]: [
      Permission.READ_CATALOG,
      Permission.UPDATE_CATALOG,
      Permission.CREATE_ITEM,
      Permission.READ_ITEM,
      Permission.UPDATE_ITEM,
      Permission.DELETE_ITEM,
      Permission.MANAGE_PAYMENTS,
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
      Permission.MANAGE_USERS,
      Permission.MANAGE_ROLES,
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
      Permission.MANAGE_PAYMENTS,
    ],
    [RoleType.CUSTOMER]: [
      Permission.READ_CATALOG,
      Permission.READ_ITEM,
      Permission.CREATE_ORDER,
      Permission.READ_ORDER,
      Permission.CANCEL_ORDER,
    ],
  },

  [BusinessContext.RETAIL]: {
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
      Permission.MANAGE_USERS,
      Permission.MANAGE_ROLES,
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
      Permission.MANAGE_PAYMENTS,
    ],
    [RoleType.CUSTOMER]: [
      Permission.READ_CATALOG,
      Permission.READ_ITEM,
      Permission.CREATE_ORDER,
      Permission.READ_ORDER,
      Permission.CANCEL_ORDER,
    ],
  },

  [BusinessContext.EVENTS]: {
    [RoleType.OWNER]: [
      Permission.CREATE_EVENT,
      Permission.READ_EVENT,
      Permission.UPDATE_EVENT,
      Permission.DELETE_EVENT,
      Permission.MANAGE_TICKETS,
      Permission.VALIDATE_TICKETS,
      Permission.VIEW_ANALYTICS,
      Permission.MANAGE_PAYMENTS,
      Permission.MANAGE_USERS,
      Permission.MANAGE_ROLES,
    ],
    [RoleType.EVENT_ORGANIZER]: [
      // Mantener por backward compatibility
      Permission.CREATE_EVENT,
      Permission.READ_EVENT,
      Permission.UPDATE_EVENT,
      Permission.DELETE_EVENT,
      Permission.MANAGE_TICKETS,
      Permission.VALIDATE_TICKETS,
      Permission.VIEW_ANALYTICS,
      Permission.MANAGE_PAYMENTS,
    ],
    [RoleType.ADMIN]: [
      Permission.CREATE_EVENT,
      Permission.READ_EVENT,
      Permission.UPDATE_EVENT,
      Permission.DELETE_EVENT,
      Permission.MANAGE_TICKETS,
      Permission.VALIDATE_TICKETS,
      Permission.VIEW_ANALYTICS,
    ],
    [RoleType.CUSTOMER]: [
      Permission.READ_EVENT,
      Permission.CREATE_ORDER,
      Permission.READ_ORDER,
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

/**
 * Configuración de mapeo de businessType a rol + contexto
 */
export interface BusinessTypeConfig {
  role: RoleType;
  context: BusinessContext;
  needsCustomerRole: boolean;
}

/**
 * Mapeo de businessType (rubro) a rol del sistema y contexto
 * Usado en registro de usuarios y cambio de rol
 */
export const BUSINESS_TYPE_MAPPING: Record<string, BusinessTypeConfig> = {
  customer: {
    role: RoleType.CUSTOMER,
    context: BusinessContext.GENERAL,
    needsCustomerRole: false,
  },
  events: {
    role: RoleType.OWNER,
    context: BusinessContext.EVENTS,
    needsCustomerRole: true,
  },
  food: {
    role: RoleType.OWNER,
    context: BusinessContext.RESTAURANT,
    needsCustomerRole: true,
  },
  dinning: {
    role: RoleType.OWNER,
    context: BusinessContext.RESTAURANT,
    needsCustomerRole: true,
  },
  clothes: {
    role: RoleType.OWNER,
    context: BusinessContext.WARDROBE,
    needsCustomerRole: true,
  },
  retail: {
    role: RoleType.OWNER,
    context: BusinessContext.RETAIL,
    needsCustomerRole: true,
  },
  grocery: {
    role: RoleType.OWNER,
    context: BusinessContext.MARKETPLACE,
    needsCustomerRole: true,
  },
  electronics: {
    role: RoleType.OWNER,
    context: BusinessContext.MARKETPLACE,
    needsCustomerRole: true,
  },
  accessories: {
    role: RoleType.OWNER,
    context: BusinessContext.MARKETPLACE,
    needsCustomerRole: true,
  },
  pharmacy: {
    role: RoleType.OWNER,
    context: BusinessContext.RETAIL,
    needsCustomerRole: true,
  },
  beauty: {
    role: RoleType.OWNER,
    context: BusinessContext.RETAIL,
    needsCustomerRole: true,
  },
  construction: {
    role: RoleType.OWNER,
    context: BusinessContext.RETAIL,
    needsCustomerRole: true,
  },
  automotive: {
    role: RoleType.OWNER,
    context: BusinessContext.RETAIL,
    needsCustomerRole: true,
  },
  pets: {
    role: RoleType.OWNER,
    context: BusinessContext.MARKETPLACE,
    needsCustomerRole: true,
  },
  water_distributor: {
    role: RoleType.OWNER,
    context: BusinessContext.MARKETPLACE,
    needsCustomerRole: true,
  },
  admin: {
    role: RoleType.ADMIN,
    context: BusinessContext.GENERAL,
    needsCustomerRole: false,
  },
  operador: {
    role: RoleType.OPERATOR,
    context: BusinessContext.GENERAL,
    needsCustomerRole: false,
  },
};
