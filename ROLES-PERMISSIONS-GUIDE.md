# 🔐 Sistema de Roles y Permisos MenuCom - Guía Completa

## 📚 Tabla de Contenidos

1. [Introducción](#introducción)
2. [Arquitectura del Sistema](#arquitectura-del-sistema)
3. [Conceptos Clave](#conceptos-clave)
4. [Guía de Migración](#guía-de-migración)
5. [Uso en Controladores](#uso-en-controladores)
6. [API de Administración](#api-de-administración)
7. [Mejores Prácticas](#mejores-prácticas)
8. [Ejemplos Completos](#ejemplos-completos)

---

## Introducción

MenuCom ahora cuenta con un **sistema de roles basado en permisos (RBAC - Role-Based Access Control)** que permite gestionar el acceso de usuarios de forma granular y contextual.

### ✨ Características Principales

- ✅ **Roles Contextuales**: Un usuario puede tener diferentes roles en diferentes contextos (restaurante, wardrobe, marketplace)
- ✅ **Permisos Granulares**: Control fino sobre qué puede hacer cada rol
- ✅ **Roles Temporales**: Asignación de roles con fecha de expiración
- ✅ **Recursos Específicos**: Roles aplicables a recursos individuales (ej: gerente de un restaurante específico)
- ✅ **Auditoría Completa**: Registro de quién otorgó roles y cuándo
- ✅ **Compatibilidad hacia atrás**: Coexiste con el sistema legacy durante la transición

---

## Arquitectura del Sistema

### Componentes Principales

```
┌─────────────────────────────────────────────────────────────┐
│                    CAPA DE CONTROLADORES                     │
│  @RestaurantOwner() @WardrobeManager() @Authenticated()     │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                       GUARDS LAYER                           │
│   JwtAuthGuard → PermissionsGuard → RoleGuard (legacy)      │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                    BUSINESS LOGIC                            │
│    UserRoleService → Check Permissions → Allow/Deny         │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                    DATA LAYER                                │
│   UserRole Entity → Context + Role + Permissions Mapping    │
└─────────────────────────────────────────────────────────────┘
```

### Entidades

#### `UserRole` (Nueva)
```typescript
{
  id: string,
  userId: string,
  role: RoleType,           // ADMIN, OWNER, MANAGER, OPERATOR, CUSTOMER
  context: BusinessContext, // RESTAURANT, WARDROBE, MARKETPLACE, GENERAL
  resourceId?: string,      // ID del recurso específico (opcional)
  isActive: boolean,
  grantedBy?: string,
  expiresAt?: Date,
  metadata?: object
}
```

#### `User.role` (Legacy)
```typescript
{
  role: string // 'customer', 'admin', 'pro', 'operador'
}
```
*Nota: Este campo se mantiene por compatibilidad pero eventualmente será deprecado.*

---

## Conceptos Clave

### 1. Tipos de Roles (`RoleType`)

```typescript
enum RoleType {
  CUSTOMER = 'customer',   // Cliente final
  OWNER = 'owner',         // Propietario de negocio
  ADMIN = 'admin',         // Administrador del sistema
  OPERATOR = 'operator',   // Operador del sistema
  MANAGER = 'manager'      // Gerente de negocio (subordinado al owner)
}
```

### 2. Contextos de Negocio (`BusinessContext`)

```typescript
enum BusinessContext {
  RESTAURANT = 'restaurant',     // Gestión de restaurantes y menús
  WARDROBE = 'wardrobe',         // Gestión de guardarropas
  MARKETPLACE = 'marketplace',   // Marketplace/tienda
  GENERAL = 'general'            // Contexto general del sistema
}
```

### 3. Permisos (`Permission`)

```typescript
enum Permission {
  // Catálogo/Productos
  CREATE_CATALOG, READ_CATALOG, UPDATE_CATALOG, DELETE_CATALOG,
  CREATE_ITEM, READ_ITEM, UPDATE_ITEM, DELETE_ITEM,
  
  // Órdenes
  CREATE_ORDER, READ_ORDER, UPDATE_ORDER, CANCEL_ORDER,
  
  // Administrativos
  MANAGE_USERS, MANAGE_PAYMENTS, VIEW_ANALYTICS, MANAGE_ROLES,
  
  // Membresías
  MANAGE_SUBSCRIPTIONS, VIEW_SUBSCRIPTION_PLANS
}
```

### 4. Mapeo de Roles a Permisos

Los permisos se asignan automáticamente según el rol y contexto:

**OWNER en RESTAURANT:**
- ✅ Crear/editar/eliminar catálogos
- ✅ Crear/editar/eliminar items
- ✅ Ver órdenes y actualizarlas
- ✅ Ver analíticas
- ✅ Gestionar pagos

**MANAGER en RESTAURANT:**
- ✅ Editar catálogos (no eliminar)
- ✅ Crear/editar items
- ✅ Ver y actualizar órdenes

**CUSTOMER en RESTAURANT:**
- ✅ Ver catálogos e items
- ✅ Crear órdenes
- ✅ Ver sus propias órdenes

---

## Guía de Migración

### Paso 1: Verificar el Estado de la Migración

```bash
GET /role-migration/status
Authorization: Bearer <admin-token>
```

**Respuesta:**
```json
{
  "message": "Estado de migración obtenido",
  "data": {
    "totalUsers": 150,
    "usersWithLegacyRoles": 150,
    "usersWithNewRoles": 45,
    "needsMigration": 105,
    "roleDistribution": {
      "customer": 120,
      "admin": 5,
      "pro": 20,
      "operador": 5
    }
  }
}
```

### Paso 2: Ejecutar Migración en Modo Simulación

```bash
POST /role-migration/execute?dryRun=true
Authorization: Bearer <admin-token>
```

Esto te mostrará qué cambios se realizarían **sin ejecutarlos**.

### Paso 3: Ejecutar Migración Real

```bash
POST /role-migration/execute?dryRun=false
Authorization: Bearer <admin-token>
```

**Resultado:**
```json
{
  "message": "Migración ejecutada exitosamente",
  "dryRun": false,
  "migrated": 105,
  "skipped": 45,
  "errors": 0,
  "details": [...]
}
```

### Paso 4: Sincronizar Roles Legacy (Opcional)

Si quieres mantener `User.role` sincronizado con `UserRole`:

```bash
POST /role-migration/sync-legacy
Authorization: Bearer <admin-token>
```

---

## Uso en Controladores

### Opción 1: Decoradores Helper (Recomendado) ⭐

```typescript
import { Controller, Get, Post } from '@nestjs/common';
import { RestaurantOwner, WardrobeManager, Authenticated } from '@auth/decorators/role-helpers.decorator';

@Controller('menus')
export class MenuController {
  
  // Solo propietarios de restaurante pueden crear
  @Post()
  @RestaurantOwner()
  async createMenu(@Body() menuData: CreateMenuDto) {
    return this.menuService.create(menuData);
  }
  
  // Gerentes de restaurante pueden editar
  @Patch(':id')
  @RestaurantManager()
  async updateMenu(@Param('id') id: string, @Body() data: UpdateMenuDto) {
    return this.menuService.update(id, data);
  }
  
  // Cualquier usuario autenticado puede ver
  @Get()
  @Authenticated()
  async getAllMenus() {
    return this.menuService.findAll();
  }
}
```

### Opción 2: Decoradores Granulares

```typescript
import { Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@auth/guards/jwt.auth.gards';
import { PermissionsGuard } from '@auth/guards/permissions.guard';
import { InBusinessContext, RequirePermissions } from '@auth/decorators/permissions.decorator';
import { Permission, BusinessContext } from '@auth/models/permissions.model';

@Controller('catalog')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CatalogController {
  
  @Post()
  @InBusinessContext(BusinessContext.RESTAURANT)
  @RequirePermissions(Permission.CREATE_CATALOG)
  async createCatalog(@Body() data: CreateCatalogDto) {
    return this.catalogService.create(data);
  }
  
  @Delete(':id')
  @InBusinessContext(BusinessContext.RESTAURANT)
  @RequirePermissions(Permission.DELETE_CATALOG, Permission.UPDATE_CATALOG)
  async deleteCatalog(@Param('id') id: string) {
    return this.catalogService.delete(id);
  }
}
```

### Decoradores Helper Disponibles

| Decorator | Contexto | Permisos Requeridos | Uso |
|-----------|----------|---------------------|-----|
| `@RestaurantOwner()` | RESTAURANT | CREATE/UPDATE/DELETE_CATALOG | Gestión completa de restaurante |
| `@RestaurantManager()` | RESTAURANT | UPDATE_CATALOG, UPDATE_ITEM | Edición de menús y items |
| `@RestaurantRead()` | RESTAURANT | READ_CATALOG, READ_ITEM | Lectura de menús |
| `@WardrobeOwner()` | WARDROBE | CREATE/UPDATE/DELETE_CATALOG | Gestión de guardarropa |
| `@WardrobeManager()` | WARDROBE | UPDATE_CATALOG, UPDATE_ITEM | Edición de guardarropa |
| `@MarketplaceOwner()` | MARKETPLACE | CREATE/UPDATE/DELETE_CATALOG, MANAGE_PAYMENTS | Gestión de marketplace |
| `@CanCreateOrders()` | Configurable | CREATE_ORDER | Crear órdenes |
| `@CanManagePayments()` | Configurable | MANAGE_PAYMENTS | Gestionar pagos |
| `@CanViewAnalytics()` | Configurable | VIEW_ANALYTICS | Ver analíticas |
| `@CanManageUsers()` | GENERAL | MANAGE_USERS | Gestionar usuarios |
| `@Authenticated()` | N/A | Ninguno | Solo autenticación |

---

## API de Administración

### Asignar Rol a Usuario

```bash
POST /user-roles/assign
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "userId": "user-uuid-123",
  "role": "owner",
  "context": "restaurant",
  "resourceId": "restaurant-uuid-456", // Opcional
  "expiresAt": "2025-12-31T23:59:59.999Z", // Opcional
  "metadata": { // Opcional
    "notes": "Trial period",
    "department": "Sales"
  }
}
```

### Revocar Rol de Usuario

```bash
DELETE /user-roles/revoke
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "userId": "user-uuid-123",
  "role": "owner",
  "context": "restaurant",
  "resourceId": "restaurant-uuid-456" // Opcional
}
```

### Actualizar Rol Existente

```bash
PATCH /user-roles/{roleId}
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "isActive": false,
  "expiresAt": "2026-12-31T23:59:59.999Z",
  "metadata": {
    "updatedReason": "Extended trial"
  }
}
```

### Obtener Roles de Usuario

```bash
GET /user-roles/user/{userId}?context=restaurant
Authorization: Bearer <admin-token>
```

### Obtener Permisos de Usuario

```bash
GET /user-roles/user/{userId}/permissions/restaurant
Authorization: Bearer <admin-token>
```

**Respuesta:**
```json
{
  "message": "Permisos obtenidos exitosamente",
  "data": {
    "userId": "user-uuid-123",
    "context": "restaurant",
    "permissions": [
      "create_catalog",
      "read_catalog",
      "update_catalog",
      "delete_catalog",
      "create_item",
      "read_item",
      "update_item",
      "delete_item",
      "read_order",
      "update_order",
      "view_analytics",
      "manage_payments"
    ]
  }
}
```

### Endpoints para Usuarios Autenticados

```bash
# Obtener mis roles
GET /user-roles/my-roles?context=restaurant
Authorization: Bearer <user-token>

# Obtener mis permisos
GET /user-roles/my-permissions/restaurant
Authorization: Bearer <user-token>
```

---

## Mejores Prácticas

### ✅ DO (Hacer)

1. **Usar decoradores helper** en lugar de guards manuales
   ```typescript
   @RestaurantOwner() // ✅ Fácil de leer
   async createMenu() { }
   ```

2. **Asignar roles específicos a recursos** cuando sea posible
   ```typescript
   await userRoleService.assignRole(
     userId, 
     RoleType.MANAGER, 
     BusinessContext.RESTAURANT,
     { resourceId: 'specific-restaurant-id' }
   );
   ```

3. **Usar roles con expiración** para accesos temporales
   ```typescript
   { expiresAt: new Date('2025-12-31') }
   ```

4. **Documentar metadata** para auditoría
   ```typescript
   { 
     metadata: { 
       reason: 'Holiday coverage',
       approvedBy: 'manager-id' 
     } 
   }
   ```

### ❌ DON'T (Evitar)

1. **No hardcodear roles** en múltiples lugares
   ```typescript
   if (user.role === 'admin') { } // ❌ Usar guards
   ```

2. **No mezclar guards legacy y nuevos** en el mismo controlador
   ```typescript
   @UseGuards(RoleGuard, PermissionsGuard) // ❌ Elegir uno
   ```

3. **No olvidar verificar expiración** en procesos críticos
   ```typescript
   // El sistema verifica automáticamente, pero revisa logs
   ```

4. **No asignar ADMIN sin justificación** documentada
   ```typescript
   // ADMIN tiene acceso total, usar con precaución
   ```

---

## Ejemplos Completos

### Ejemplo 1: Controlador de Menú con Roles Contextuales

```typescript
import { Controller, Get, Post, Patch, Delete, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { RestaurantOwner, RestaurantManager, RestaurantRead } from '@auth/decorators/role-helpers.decorator';

@ApiTags('Menu Management')
@Controller('menus')
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  @Post()
  @RestaurantOwner()
  @ApiOperation({ summary: 'Crear nuevo menú - Solo propietarios' })
  async createMenu(@Body() menuData: CreateMenuDto) {
    return this.menuService.create(menuData);
  }

  @Patch(':id')
  @RestaurantManager()
  @ApiOperation({ summary: 'Actualizar menú - Propietarios y gerentes' })
  async updateMenu(@Param('id') id: string, @Body() data: UpdateMenuDto) {
    return this.menuService.update(id, data);
  }

  @Get()
  @RestaurantRead()
  @ApiOperation({ summary: 'Ver menús - Todos los usuarios autenticados' })
  async getAllMenus() {
    return this.menuService.findAll();
  }

  @Delete(':id')
  @RestaurantOwner()
  @ApiOperation({ summary: 'Eliminar menú - Solo propietarios' })
  async deleteMenu(@Param('id') id: string) {
    return this.menuService.delete(id);
  }
}
```

### Ejemplo 2: Asignación Programática de Roles

```typescript
import { Injectable } from '@nestjs/common';
import { UserRoleService } from '@auth/services/user-role.service';
import { RoleType, BusinessContext } from '@auth/models/permissions.model';

@Injectable()
export class OnboardingService {
  constructor(private userRoleService: UserRoleService) {}

  async onboardNewRestaurantOwner(userId: string, restaurantId: string) {
    // Asignar rol de OWNER para el restaurante específico
    await this.userRoleService.assignRole(
      userId,
      RoleType.OWNER,
      BusinessContext.RESTAURANT,
      {
        resourceId: restaurantId,
        grantedBy: 'system',
        metadata: {
          onboardedAt: new Date().toISOString(),
          plan: 'premium',
          trialEnds: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 días
        },
      }
    );

    // También asignar permisos de CUSTOMER en contexto general
    await this.userRoleService.assignRole(
      userId,
      RoleType.CUSTOMER,
      BusinessContext.GENERAL,
      {
        grantedBy: 'system',
        metadata: { source: 'restaurant-owner-onboarding' },
      }
    );
  }

  async promoteToManager(userId: string, restaurantId: string, promotedBy: string) {
    await this.userRoleService.assignRole(
      userId,
      RoleType.MANAGER,
      BusinessContext.RESTAURANT,
      {
        resourceId: restaurantId,
        grantedBy: promotedBy,
        expiresAt: new Date('2025-12-31'), // Rol temporal
        metadata: {
          promotedAt: new Date().toISOString(),
          reason: 'Coverage during vacation',
        },
      }
    );
  }
}
```

### Ejemplo 3: Verificación de Permisos en Servicio

```typescript
import { Injectable, ForbiddenException } from '@nestjs/common';
import { UserRoleService } from '@auth/services/user-role.service';
import { Permission, BusinessContext } from '@auth/models/permissions.model';

@Injectable()
export class MenuService {
  constructor(private userRoleService: UserRoleService) {}

  async deleteMenuItem(userId: string, menuId: string, itemId: string) {
    // Verificar si el usuario tiene permiso para eliminar items
    const hasPermission = await this.userRoleService.userHasPermission(
      userId,
      BusinessContext.RESTAURANT,
      Permission.DELETE_ITEM
    );

    if (!hasPermission) {
      throw new ForbiddenException(
        'No tienes permisos para eliminar items del menú'
      );
    }

    // Proceder con la eliminación
    return this.menuRepository.deleteItem(menuId, itemId);
  }
}
```

---

## 🔧 Troubleshooting

### Problema: "No tienes permisos para acceder a este recurso"

**Solución:**
1. Verificar que el usuario tiene el rol asignado:
   ```bash
   GET /user-roles/user/{userId}
   ```

2. Verificar que el rol tiene los permisos necesarios:
   ```bash
   GET /user-roles/user/{userId}/permissions/{context}
   ```

3. Revisar si el rol está activo y no expirado

### Problema: Usuario tiene rol legacy pero no nuevo

**Solución:**
Ejecutar la migración:
```bash
POST /role-migration/execute?dryRun=false
```

### Problema: Cambios en permisos no se reflejan

**Solución:**
El mapeo de permisos es estático en `permissions.model.ts`. Si modificaste los permisos, reinicia la aplicación.

---

## 📊 Migración Gradual Recomendada

1. **Fase 1: Preparación** (Completado ✅)
   - ✅ Sistema nuevo implementado
   - ✅ API de administración creada
   - ✅ Decoradores helper listos

2. **Fase 2: Migración de Datos** (Siguiente paso)
   - Ejecutar migración en ambiente de QA
   - Validar que todos los usuarios tienen roles nuevos
   - Sincronizar roles legacy

3. **Fase 3: Actualizar Controladores** (Próximo)
   - Reemplazar `@UseGuards(RoleGuard)` por decoradores helper
   - Aplicar permisos contextuales en catalog, orders, wardrobes

4. **Fase 4: Deprecación Legacy**
   - Marcar `User.role` como deprecated
   - Eventualmente eliminar campo legacy

---

## 🎓 Recursos Adicionales

- **Código Fuente**: `src/auth/`
- **Tests**: `test/auth/user-roles.e2e-spec.ts`
- **API Docs**: `/docs` (Swagger)
- **Análisis Original**: `ROLE-SYSTEM-ANALYSIS.md`

---

## 📞 Soporte

Para dudas o problemas:
1. Revisar esta guía completa
2. Consultar el código en `src/auth/`
3. Contactar al equipo de desarrollo

**¡El sistema está listo para usar! 🚀**
