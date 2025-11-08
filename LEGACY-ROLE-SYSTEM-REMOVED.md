# Sistema Legacy de Roles - Completamente Removido

## ✅ Archivos Eliminados

### Modelos Legacy
- ❌ `src/auth/models/roles.model.ts` - Enum Role (CUSTOMER, ADMIN, PRO, OPERADOR)

### Servicios y Controladores de Migración
- ❌ `src/auth/services/role-migration.service.ts` - Servicio de migración
- ❌ `src/auth/contollers/role-migration.controller.ts` - Endpoints de migración

### Guards y Decoradores Legacy
- ❌ `src/auth/guards/role.guards.ts` - RoleGuard básico
- ❌ `src/auth/decorators/role.decorator.ts` - Decorador @Roles()

## 📝 Archivos Actualizados

### DTOs de Usuario
```typescript
// ✅ src/user/dto/create-user.dto.ts
// Removido: readonly role: string;

// ✅ src/user/dto/update-user.dto.ts
// Removido: readonly role?: string;

// ✅ src/user/dto/social-user.dto.ts
// Removido: readonly role?: string;
```

### Entidad de Usuario
```typescript
// ✅ src/user/entities/user.entity.ts
/**
 * @deprecated Legacy role field. Use UserRole entity for role management.
 * This field is kept for backward compatibility but should not be used in new code.
 */
@Column({ type: 'varchar', length: 100, nullable: true })
role: string;
```
**Nota**: El campo `role` se mantiene nullable para compatibilidad con datos existentes, pero está marcado como deprecated.

### Controladores Actualizados

#### UserRoleController
```typescript
// ✅ src/auth/contollers/user-role.controller.ts

// ANTES:
import { RoleGuard } from '../guards/role.guards';
import { Roles } from '../decorators/role.decorator';
import { Role } from '../models/roles.model';
@UseGuards(JwtAuthGuard, RoleGuard)
@Roles(Role.ADMIN, Role.OPERADOR)

// AHORA:
import { PermissionsGuard } from '../guards/permissions.guard';
import { RequirePermissions } from '../decorators/permissions.decorator';
import { Permission, BusinessContext } from '../models/permissions.model';
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions(Permission.MANAGE_USERS, BusinessContext.GENERAL)
```

#### SubscriptionPlanController
```typescript
// ✅ src/membership/controllers/subscription-plan.controller.ts

// ANTES:
import { RoleGuard } from '../../auth/guards/role.guards';
import { Roles } from '../../auth/decorators/role.decorator';
import { Role } from '../../auth/models/roles.model';
@UseGuards(JwtAuthGuard, RoleGuard)
@Roles(Role.ADMIN)

// AHORA:
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { Permission, BusinessContext } from '../../auth/models/permissions.model';
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions(Permission.MANAGE_USERS, BusinessContext.GENERAL)
```

### AuthModule
```typescript
// ✅ src/auth/auth.module.ts

// Removido de imports:
// - RoleMigrationService
// - RoleMigrationController

// Removido de providers:
// - RoleMigrationService

// Removido de controllers:
// - RoleMigrationController
```

## 🎯 Sistema Actual (Solo RBAC Nuevo)

### Estructura de Permisos

```typescript
// src/auth/models/permissions.model.ts

export enum RoleType {
  CUSTOMER = 'customer',
  OWNER = 'owner',
  ADMIN = 'admin',
  OPERATOR = 'operator',
  MANAGER = 'manager',
}

export enum BusinessContext {
  RESTAURANT = 'restaurant',
  WARDROBE = 'wardrobe',
  MARKETPLACE = 'marketplace',
  GENERAL = 'general',
}

export enum Permission {
  // Gestión de catálogo
  CREATE_CATALOG = 'create:catalog',
  READ_CATALOG = 'read:catalog',
  UPDATE_CATALOG = 'update:catalog',
  DELETE_CATALOG = 'delete:catalog',
  
  // Items/productos
  CREATE_ITEM = 'create:item',
  READ_ITEM = 'read:item',
  UPDATE_ITEM = 'update:item',
  DELETE_ITEM = 'delete:item',
  
  // Pedidos
  CREATE_ORDER = 'create:order',
  READ_ORDER = 'read:order',
  UPDATE_ORDER = 'update:order',
  DELETE_ORDER = 'delete:order',
  
  // Análisis y reportes
  READ_ANALYTICS = 'read:analytics',
  
  // Gestión de usuarios
  MANAGE_USERS = 'manage:users',
  
  // Gestión de pagos
  MANAGE_PAYMENTS = 'manage:payments',
  
  // Configuración del negocio
  MANAGE_SETTINGS = 'manage:settings',
}
```

### Mapeo de Roles a Permisos

```typescript
export const ROLE_PERMISSIONS_BY_CONTEXT: Record<
  BusinessContext,
  Record<RoleType, Permission[]>
> = {
  [BusinessContext.RESTAURANT]: {
    [RoleType.CUSTOMER]: [
      Permission.READ_CATALOG,
      Permission.READ_ITEM,
      Permission.CREATE_ORDER,
      Permission.READ_ORDER,
    ],
    [RoleType.OWNER]: [
      Permission.CREATE_CATALOG,
      Permission.READ_CATALOG,
      Permission.UPDATE_CATALOG,
      Permission.DELETE_CATALOG,
      Permission.CREATE_ITEM,
      Permission.READ_ITEM,
      Permission.UPDATE_ITEM,
      Permission.DELETE_ITEM,
      Permission.CREATE_ORDER,
      Permission.READ_ORDER,
      Permission.UPDATE_ORDER,
      Permission.DELETE_ORDER,
      Permission.READ_ANALYTICS,
      Permission.MANAGE_USERS,
      Permission.MANAGE_PAYMENTS,
      Permission.MANAGE_SETTINGS,
    ],
    [RoleType.MANAGER]: [
      Permission.READ_CATALOG,
      Permission.UPDATE_CATALOG,
      Permission.CREATE_ITEM,
      Permission.READ_ITEM,
      Permission.UPDATE_ITEM,
      Permission.CREATE_ORDER,
      Permission.READ_ORDER,
      Permission.UPDATE_ORDER,
      Permission.READ_ANALYTICS,
    ],
    [RoleType.OPERATOR]: [
      Permission.READ_CATALOG,
      Permission.READ_ITEM,
      Permission.CREATE_ORDER,
      Permission.READ_ORDER,
      Permission.UPDATE_ORDER,
    ],
    [RoleType.ADMIN]: [], // Admin global, no necesita permisos específicos en contexto
  },
  // ... otros contextos
};
```

### Guardias de Seguridad

#### PermissionsGuard
```typescript
// src/auth/guards/permissions.guard.ts
// Valida permisos basados en:
// - Rol del usuario
// - Contexto de negocio
// - Recurso específico (opcional)
// - Estado activo del rol
// - Fecha de expiración
```

### Decoradores Helper

```typescript
// src/auth/decorators/role-helpers.decorator.ts

@RestaurantOwner()        // OWNER en contexto RESTAURANT
@RestaurantManager()      // MANAGER en contexto RESTAURANT
@WardrobeOwner()          // OWNER en contexto WARDROBE
@MarketplaceOwner()       // OWNER en contexto MARKETPLACE
@CanCreateCatalog()       // Permiso CREATE_CATALOG
@CanManageOrders()        // Permiso UPDATE_ORDER + DELETE_ORDER
@CanManageUsers()         // Permiso MANAGE_USERS
@CanViewAnalytics()       // Permiso READ_ANALYTICS
@CanManagePayments()      // Permiso MANAGE_PAYMENTS
@CanManageSettings()      // Permiso MANAGE_SETTINGS
@Authenticated()          // Solo requiere autenticación
```

## 🔄 Migración de Código Existente

### Patrón de Actualización

```typescript
// ❌ ANTES (Legacy)
import { RoleGuard } from '../guards/role.guards';
import { Roles } from '../decorators/role.decorator';
import { Role } from '../models/roles.model';

@UseGuards(JwtAuthGuard, RoleGuard)
@Roles(Role.ADMIN, Role.PRO)
async someMethod() { }

// ✅ AHORA (Nuevo RBAC)
import { PermissionsGuard } from '../guards/permissions.guard';
import { RequirePermissions } from '../decorators/permissions.decorator';
import { Permission, BusinessContext } from '../models/permissions.model';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions(Permission.MANAGE_USERS, BusinessContext.GENERAL)
async someMethod() { }

// ✅ O usar helper decorators:
import { CanManageUsers } from '../decorators/role-helpers.decorator';

@CanManageUsers()
async someMethod() { }
```

## 📋 Checklist de Limpieza

- [x] Eliminar `Role` enum de `roles.model.ts`
- [x] Eliminar `RoleMigrationService`
- [x] Eliminar `RoleMigrationController`
- [x] Eliminar `RoleGuard`
- [x] Eliminar decorador `@Roles()`
- [x] Actualizar `CreateUserDto` - remover campo `role`
- [x] Actualizar `UpdateUserDto` - remover campo `role`
- [x] Actualizar `SocialUserDto` - remover campo `role`
- [x] Deprecar campo `role` en entidad `User`
- [x] Actualizar `UserRoleController` a usar `PermissionsGuard`
- [x] Actualizar `SubscriptionPlanController` a usar `PermissionsGuard`
- [x] Limpiar imports en `AuthModule`

## 🚀 Próximos Pasos

### Si encuentras código usando el sistema legacy:

1. **Identificar el guard usado**: Buscar `@UseGuards(JwtAuthGuard, RoleGuard)`
2. **Identificar el decorador**: Buscar `@Roles()`
3. **Reemplazar imports**:
   ```typescript
   // Eliminar
   import { RoleGuard } from '../guards/role.guards';
   import { Roles } from '../decorators/role.decorator';
   import { Role } from '../models/roles.model';
   
   // Agregar
   import { PermissionsGuard } from '../guards/permissions.guard';
   import { RequirePermissions } from '../decorators/permissions.decorator';
   import { Permission, BusinessContext } from '../models/permissions.model';
   ```

4. **Actualizar guards**:
   ```typescript
   // Cambiar
   @UseGuards(JwtAuthGuard, RoleGuard)
   // Por
   @UseGuards(JwtAuthGuard, PermissionsGuard)
   ```

5. **Actualizar decoradores**:
   ```typescript
   // Cambiar
   @Roles(Role.ADMIN)
   // Por (elegir según el caso)
   @RequirePermissions(Permission.MANAGE_USERS, BusinessContext.GENERAL)
   // O usar helper:
   @CanManageUsers()
   ```

### Para nuevos controladores:

Usa siempre:
- `PermissionsGuard` en lugar de `RoleGuard`
- `@RequirePermissions()` o decoradores helper en lugar de `@Roles()`
- Tipos del nuevo sistema (`RoleType`, `BusinessContext`, `Permission`)

## 📚 Referencias

- [ROLES-QUICK-START.md](./ROLES-QUICK-START.md) - Guía rápida del nuevo sistema
- [ROLES-PERMISSIONS-GUIDE.md](./ROLES-PERMISSIONS-GUIDE.md) - Guía completa
- [ROLES-IMPLEMENTATION-SUMMARY.md](./ROLES-IMPLEMENTATION-SUMMARY.md) - Resumen de implementación
- [FILES-CREATED.md](./FILES-CREATED.md) - Lista de archivos del sistema nuevo
