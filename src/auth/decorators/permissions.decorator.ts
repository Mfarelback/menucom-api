import { SetMetadata } from '@nestjs/common';
import { Permission } from '../models/permissions.model';
import { BusinessContext } from '../models/permissions.model';

/**
 * Decorator para especificar qué permisos se requieren para acceder a un endpoint
 *
 * @param permissions - Lista de permisos requeridos (el usuario debe tener al menos uno)
 *
 * @example
 * @RequirePermissions(Permission.CREATE_CATALOG)
 * async createCatalog() { ... }
 *
 * @example
 * @RequirePermissions(Permission.UPDATE_CATALOG, Permission.DELETE_CATALOG)
 * async modifyCatalog() { ... }
 */
export const PERMISSIONS_KEY = 'permissions';
export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

/**
 * Decorator para especificar el contexto de negocio en el que se evalúan los permisos
 *
 * @param context - Contexto de negocio (RESTAURANT, WARDROBE, etc.)
 *
 * @example
 * @BusinessContextDecorator(BusinessContext.RESTAURANT)
 * @RequirePermissions(Permission.CREATE_CATALOG)
 * async createRestaurantMenu() { ... }
 */
export const CONTEXT_KEY = 'business_context';
export const InBusinessContext = (context: BusinessContext) =>
  SetMetadata(CONTEXT_KEY, context);

/**
 * Decorator combinado para especificar permisos y contexto en una sola línea
 *
 * @param context - Contexto de negocio
 * @param permissions - Lista de permisos requeridos
 *
 * @example
 * @RequireContextPermissions(BusinessContext.RESTAURANT, Permission.CREATE_CATALOG)
 * async createRestaurantMenu() { ... }
 */
export const RequireContextPermissions = (
  context: BusinessContext,
  ...permissions: Permission[]
) => {
  return (
    target: any,
    propertyKey?: string,
    descriptor?: PropertyDescriptor,
  ) => {
    SetMetadata(CONTEXT_KEY, context)(target, propertyKey, descriptor);
    SetMetadata(PERMISSIONS_KEY, permissions)(target, propertyKey, descriptor);
  };
};
