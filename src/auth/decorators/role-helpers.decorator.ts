import { applyDecorators, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt.auth.gards';
import { PermissionsGuard } from '../guards/permissions.guard';
import { InBusinessContext, RequirePermissions } from './permissions.decorator';
import { Permission, BusinessContext } from '../models/permissions.model';

/**
 * Decoradores combinados para simplificar el uso de permisos contextuales
 * Estos decoradores combinan guards, contexto y permisos en una sola línea
 */

/**
 * Requiere permisos de propietario de restaurante
 * @example
 * @RestaurantOwner()
 * async createMenu() { ... }
 */
export function RestaurantOwner() {
  return applyDecorators(
    UseGuards(JwtAuthGuard, PermissionsGuard),
    InBusinessContext(BusinessContext.RESTAURANT),
    RequirePermissions(
      Permission.CREATE_CATALOG,
      Permission.UPDATE_CATALOG,
      Permission.DELETE_CATALOG,
    ),
    ApiBearerAuth(),
    ApiUnauthorizedResponse({ description: 'No autorizado' }),
  );
}

/**
 * Requiere permisos de gerente de restaurante
 * @example
 * @RestaurantManager()
 * async updateMenuItem() { ... }
 */
export function RestaurantManager() {
  return applyDecorators(
    UseGuards(JwtAuthGuard, PermissionsGuard),
    InBusinessContext(BusinessContext.RESTAURANT),
    RequirePermissions(Permission.UPDATE_CATALOG, Permission.UPDATE_ITEM),
    ApiBearerAuth(),
    ApiUnauthorizedResponse({ description: 'No autorizado' }),
  );
}

/**
 * Requiere permisos de lectura de restaurante (cliente)
 * @example
 * @RestaurantRead()
 * async getMenu() { ... }
 */
export function RestaurantRead() {
  return applyDecorators(
    UseGuards(JwtAuthGuard, PermissionsGuard),
    InBusinessContext(BusinessContext.RESTAURANT),
    RequirePermissions(Permission.READ_CATALOG, Permission.READ_ITEM),
    ApiBearerAuth(),
    ApiUnauthorizedResponse({ description: 'No autorizado' }),
  );
}

/**
 * Requiere permisos de propietario de guardarropa
 * @example
 * @WardrobeOwner()
 * async createWardrobe() { ... }
 */
export function WardrobeOwner() {
  return applyDecorators(
    UseGuards(JwtAuthGuard, PermissionsGuard),
    InBusinessContext(BusinessContext.WARDROBE),
    RequirePermissions(
      Permission.CREATE_CATALOG,
      Permission.UPDATE_CATALOG,
      Permission.DELETE_CATALOG,
    ),
    ApiBearerAuth(),
    ApiUnauthorizedResponse({ description: 'No autorizado' }),
  );
}

/**
 * Requiere permisos de gerente de guardarropa
 * @example
 * @WardrobeManager()
 * async updateClothingItem() { ... }
 */
export function WardrobeManager() {
  return applyDecorators(
    UseGuards(JwtAuthGuard, PermissionsGuard),
    InBusinessContext(BusinessContext.WARDROBE),
    RequirePermissions(Permission.UPDATE_CATALOG, Permission.UPDATE_ITEM),
    ApiBearerAuth(),
    ApiUnauthorizedResponse({ description: 'No autorizado' }),
  );
}

/**
 * Requiere permisos de propietario de marketplace
 * @example
 * @MarketplaceOwner()
 * async createProduct() { ... }
 */
export function MarketplaceOwner() {
  return applyDecorators(
    UseGuards(JwtAuthGuard, PermissionsGuard),
    InBusinessContext(BusinessContext.MARKETPLACE),
    RequirePermissions(
      Permission.CREATE_CATALOG,
      Permission.UPDATE_CATALOG,
      Permission.DELETE_CATALOG,
      Permission.MANAGE_PAYMENTS,
    ),
    ApiBearerAuth(),
    ApiUnauthorizedResponse({ description: 'No autorizado' }),
  );
}

/**
 * Requiere poder crear órdenes (cualquier contexto)
 * @example
 * @CanCreateOrders()
 * async placeOrder() { ... }
 */
export function CanCreateOrders(
  context: BusinessContext = BusinessContext.GENERAL,
) {
  return applyDecorators(
    UseGuards(JwtAuthGuard, PermissionsGuard),
    InBusinessContext(context),
    RequirePermissions(Permission.CREATE_ORDER),
    ApiBearerAuth(),
    ApiUnauthorizedResponse({ description: 'No autorizado' }),
  );
}

/**
 * Requiere poder gestionar pagos
 * @example
 * @CanManagePayments()
 * async processRefund() { ... }
 */
export function CanManagePayments(
  context: BusinessContext = BusinessContext.GENERAL,
) {
  return applyDecorators(
    UseGuards(JwtAuthGuard, PermissionsGuard),
    InBusinessContext(context),
    RequirePermissions(Permission.MANAGE_PAYMENTS),
    ApiBearerAuth(),
    ApiUnauthorizedResponse({ description: 'No autorizado' }),
  );
}

/**
 * Requiere poder ver analíticas
 * @example
 * @CanViewAnalytics()
 * async getDashboard() { ... }
 */
export function CanViewAnalytics(
  context: BusinessContext = BusinessContext.GENERAL,
) {
  return applyDecorators(
    UseGuards(JwtAuthGuard, PermissionsGuard),
    InBusinessContext(context),
    RequirePermissions(Permission.VIEW_ANALYTICS),
    ApiBearerAuth(),
    ApiUnauthorizedResponse({ description: 'No autorizado' }),
  );
}

/**
 * Requiere poder gestionar usuarios (admin/operador)
 * @example
 * @CanManageUsers()
 * async deleteUser() { ... }
 */
export function CanManageUsers() {
  return applyDecorators(
    UseGuards(JwtAuthGuard, PermissionsGuard),
    InBusinessContext(BusinessContext.GENERAL),
    RequirePermissions(Permission.MANAGE_USERS),
    ApiBearerAuth(),
    ApiUnauthorizedResponse({ description: 'No autorizado' }),
  );
}

/**
 * Requiere autenticación básica sin permisos específicos
 * @example
 * @Authenticated()
 * async getMyProfile() { ... }
 */
export function Authenticated() {
  return applyDecorators(
    UseGuards(JwtAuthGuard),
    ApiBearerAuth(),
    ApiUnauthorizedResponse({ description: 'No autorizado' }),
  );
}
