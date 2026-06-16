# Revisión de Arquitectura Multi-Tenant

**Fecha:** 2026-06-12
**Revisor:** opencode
**Estado:** 🔴 Bloqueante para MANAGER

---

## 1. Cómo funciona la resolución de tenant actualmente

### Componentes y flujo

```
Request → JwtStrategy (extrae JWT con commerceId opcional)
        → TenantInterceptor (resuelve tenant → asigna request.tenantId)
        → PermissionsGuard (resuelve tenant si falta, verifica permisos)
        → Controller → Service (lee req.tenantId / req.user.userId)
```

**TenantInterceptor** (`src/auth/interceptors/tenant.interceptor.ts:26-29`):
1. Revisa header `X-Tenant-Id` — si existe, valida acceso via `UserRoleService.hasAccessToCommerce()` y lo retorna
2. Fallback a `request.user.commerceId` del payload JWT
3. Retorna `undefined` si no hay ninguno
4. Salta resolución si `request.user` es falsy (requests no autenticados)

**TenantResolutionService** (`src/auth/services/tenant-resolution.service.ts:33-66`):
- Header tiene prioridad sobre commerceId del JWT
- Valida acceso del header contra UserRole.resourceId
- Método estático `buildTenantFilter()`: si hay `commerceId` → filtra por él; si no → filtra por `tenantId: tenant.userId`
- Este fallback (`{ tenantId: tenant.userId }`) está **roto**: ninguna entidad core (Catalog, Order, Commerce) tiene columna `tenantId` — solo entidades de Eventos la tienen

**PermissionsGuard** (`src/auth/guards/permissions.guard.ts:78-86`):
- Re-resuelve tenant si `request.tenantId` no está seteado (duplica lógica del interceptor)
- Verifica permisos por rol+contexto, **NO por resource ID** — solo valida que el usuario *tenga* un permiso en un contexto, no que lo tenga *para este commerce específico*

**Payload JWT** (`src/auth/types/auth.types.ts`):
- Contiene `commerceId` como propiedad opcional
- Inyectado al login/refresh via `resolveInitialCommerceId()` que auto-crea un Commerce para usuarios legacy
- `switchContext()` genera un nuevo JWT con el `commerceId` objetivo

---

## 2. Lugares donde se filtra por `userId` en vez de `commerceId`

### 🔴 CRÍTICO — MANAGER no puede operar

| Archivo | Línea(s) | Problema |
|---------|----------|----------|
| `src/commerce/services/commerce.service.ts` | 61-65 | `findByOwner(ownerId)` filtra solo por `ownerId` — MANAGER nunca puede listar su commerce |
| `src/commerce/services/commerce.service.ts` | 38 | `CommerceController.getMyCommerces()` llama `findByOwner(req.user.userId)` — MANAGER ve vacío |
| `src/commerce/services/commerce.service.ts` | 28 | `create(ownerId, dto)` guarda `userId` como ownerId — un MANAGER creando un commerce se vuelve su dueño |
| `src/orders/controllers/orders.controller.ts` | 59-62 | `findAll` usa `req.user.userId` → llama `findByUserId()` que filtra por `customerEmail` — salta tenant |
| `src/orders/controllers/orders.controller.ts` | 85-95 | `findByOwnerId(ownerId)` acepta `ownerId` como parámetro URL — **sin validación** de acceso |
| `src/orders/services/orders.service.ts` | 339-352 | `findByOwner(customerEmail)` filtra solo por email — sin scope de commerceId |
| `src/orders/services/orders.service.ts` | 373-400 | `findByUserId(userId)` resuelve email del user, filtra por ese email — sin commerceId |
| `src/orders/services/orders.service.ts` | 402-414 | `findByCreator(createdBy)` filtra por `createdBy` — sin aislamiento de tenant |
| `src/orders/services/orders.service.ts` | 417-458 | `findByOwnerId(ownerId)` acepta `ownerId` como param principal, commerceId es secundario/opcional |
| `src/membership/services/resource-limit.service.ts` | 31, 41, 52, 62, 70 | Todos los métodos llaman `getUserMembership(ctx.userId)` — **ignoran commerceId** |
| `src/membership/services/resource-limit.service.ts` | 145 | Fallback filter `{ ownerId: ctx.userId }` — excluye catálogos del MANAGER del conteo |
| `src/membership/membership.service.ts` | 424, 433 | Vencimiento/aplicación de membresía keyed por `userId`, no `commerceId` |
| `src/catalog/services/catalog.service.ts` | 546-548 | `getPublicCatalogsByOwnerId(ownerId)` — endpoint público sin filtro commerceId |
| `src/catalog/services/catalog.service.ts` | 51, 71, 289 | Validación de recursos pasa `{ userId: ownerId, commerceId }` pero el servicio usa solo `ctx.userId` |

### 🟡 Problemas potenciales

| Archivo | Línea(s) | Problema |
|---------|----------|----------|
| `src/catalog/services/catalog.service.ts` | 125 | Fallback: si no hay `commerceId`, filtra por `ownerId` — MANAGER ve cero catálogos |
| `src/catalog/services/catalog.service.ts` | 168-169 | Fallback: si no hay `commerceId`, valida por `ownerId` — MANAGER obtiene no autorizado |
| `src/catalog/services/catalog.service.ts` | 389, 438 | Fallback: si no hay `commerceId`, valida por `catalog.ownerId !== catalogOwnerId` — MANAGER no autorizado |
| `src/orders/services/orders.service.ts` | 442 | Fallback: `where.ownerId = ownerId` — sin scope commerceId |
| `src/auth/services/tenant-resolution.service.ts` | 30 | `buildTenantFilter` fallback usa `{ tenantId: tenant.userId }` — ninguna entidad tiene esta columna |
| `src/events/services/events.service.ts` | 44 | Eventos guardados con `tenantId: tenant.userId` — no `commerceId` |
| `src/events/entities/event.entity.ts` | 25 | Entidad Event usa `tenantId` (legacy userId), sin columna `commerceId` |

---

## 3. Propagación de contexto de tenant faltante

1. **TenantInterceptor salta requests no autenticados** (`tenant.interceptor.ts:22-24`) — correcto para endpoints públicos, pero si una ruta que debería estar protegida no tiene el auth guard, no se resuelve tenant.

2. **Creación de orden** (`orders.controller.ts:98-113`) no usa `req.tenantId` — el dueño de la orden se determina desde los items del catálogo, no desde el contexto del usuario autenticado. Un MANAGER creando una orden para su commerce usaría su **userId**, no el del dueño del commerce.

3. **Membership está scoped a usuario** — entidad `Membership` tiene `userId`, no `commerceId`. Pasar `req.tenantId` como segundo argumento a métodos del servicio no tiene efecto porque esos métodos lo ignoran o lo usan como fallback de búsqueda.

4. **Commerce entity no tiene `tenantId` ni auto-referencia** — ES el tenant pero no tiene marcador. El `ownerId` es el único identificador.

5. **Interfaz `TenantContext`** duplicada:
   - `src/auth/types/tenant-context.types.ts` — canónica
   - `src/membership/services/resource-limit.service.ts:11-14` — copia local
   - Son idénticas pero no compartidas

---

## 4. Estado de la migración `ownerId → commerceId`

### Lo que se ha migrado:
- **Catalog entity**: Tiene `commerceId` (nullable), indexado
- **Order entity**: Tiene `commerceId` (nullable), indexado
- **Payments marketplace fee resolver**: Soporta ambos `commerceId` (preferido) y `tenantId` (legacy userId)
- **Controllers**: Leen `req.tenantId` y lo pasan a servicios
- **JWT**: Lleva `commerceId` para usuarios con un solo commerce

### Lo que NO se ha migrado:
- **Commerce entity**: Solo `ownerId`, sin migración a modelo basado en `commerceId`
- **Membership entity**: Keyed por `userId` completamente
- **Entidades de Eventos**: Usan `tenantId` legacy (userId), sin soporte `commerceId`
- **Entidad `MerchantConfig`**: Usa `tenantId` legacy (userId)
- **Resource limits**: Filtran por `ownerId` como fallback
- **Commerce service**: `findByOwner` solo por ownerId

### Estado de migración: **~40% completo**
El schema soporta commerceId pero el filtrado principal en servicios sigue usando `ownerId` cuando `commerceId` está ausente o es null. La migración está en fase **dual-write/dual-read** — ambos campos existen pero `commerceId` puede ser null.

---

## 5. ¿Puede el rol MANAGER operar realmente?

**Respuesta corta: Parcialmente, con brechas significativas.**

### Lo que funciona para MANAGER:
1. **Catalog CRUD** — Cuando `req.tenantId` (commerceId) se pasa, el filtrado usa `commerceId` correctamente
2. **Listado de órdenes** — `findAll` con contexto tenant filtra por `commerceId`
3. **Actualización/desactivación de Commerce** — Usa `hasAccessToCommerce()` que verifica UserRole
4. **Permisos** — MANAGER tiene permisos correctos en la matriz de permisos

### Lo que NO funciona para MANAGER:
1. **Resource limit enforcement** — `ResourceLimitService.getUserLimits()` llama `membershipService.getPlanLimits(ctx.userId)` que busca la membresía del MANAGER, NO la del commerce. MANAGER en plan FREE obtiene límites FREE aunque el commerce sea PREMIUM.
2. **Listado de commerces** — `GET /commerce/my` no retorna nada para MANAGER
3. **Creación de catálogo** (resource validation) — Usa límites del MANAGER, no del plan del commerce
4. **Gestión de membresía** — Completamente scoped a usuario

### Causa raíz de los problemas de MANAGER:

La suposición core en la capa de servicios es **1:1 Usuario→Commerce**. Cada servicio fallbackea a `userId`/`ownerId` cuando `commerceId` está ausente. Como MANAGER no tiene commerce propio (gestiona el de otro), los patrones de fallback se rompen.

---

## 6. Recomendaciones específicas

### 🔴 Inmediato (bloquea a MANAGER)

| Prioridad | Archivo | Recomendación |
|-----------|---------|---------------|
| P0 | `src/membership/services/resource-limit.service.ts` | Cambiar `getUserMembership(ctx.userId)` para resolver membresía por `commerceId` o fallback al OWNER del commerce. Agregar método `getMembershipByCommerceId(commerceId)` |
| P0 | `src/membership/membership.service.ts` | Agregar columna `commerceId` a Membership entity (nullable). Vincular membresía al commerce, no solo al usuario. El plan del commerce debe gobernar a sus managers |
| P1 | `src/commerce/services/commerce.service.ts` | Agregar `findByMembership(userId)` que haga join UserRole → Commerce, así MANAGER puede listar sus commerces accesibles |
| P1 | `src/commerce/controllers/commerce.controller.ts` | `GET /commerce/my` debe consultar `getUserContexts(userId)` en vez de `findByOwner(userId)` |

### 🟡 Corto plazo

| Prioridad | Archivo | Recomendación |
|-----------|---------|---------------|
| P2 | `src/orders/controllers/orders.controller.ts:85-95` | `findByOwnerId(ownerId)` debe validar que `req.tenantId` coincida o que el caller tenga acceso, no aceptar cualquier ownerId |
| P2 | `src/orders/services/orders.service.ts:442` | Eliminar fallback a `ownerId` — siempre requerir `commerceId` via contexto tenant |
| P2 | `src/catalog/services/catalog.service.ts:546-548` | `getPublicCatalogsByOwnerId` es público pero debería soportar también `commerceId` para migración futura |
| P2 | `src/auth/services/tenant-resolution.service.ts:30` | Arreglar fallback de `buildTenantFilter` — ninguna entidad tiene `tenantId`. O resolver ownerId del commerce o lanzar error |
| P2 | Todos los controllers | Crear decorador `@TenantId()` (similar a `@Req()`) que retorne el tenant resuelto, en vez de cada controller leyendo `req.tenantId` manualmente |

### 🟢 Largo plazo

| Prioridad | Archivo | Recomendación |
|-----------|---------|---------------|
| P3 | `src/commerce/entities/commerce.entity.ts` | Hacer `commerceId` NOT NULL en Catalog y Order después de backfill. Eliminar `ownerId` de entidades de datos (mantener en Commerce) |
| P3 | `Membership entity` | Agregar FK a `commerceId`, migrar membresías existentes al modelo scoped por commerce |
| P3 | `Entidades de Eventos` | Agregar columna `commerceId`, migrar desde `tenantId` (legacy userId) |
| P3 | `src/auth/types/tenant-context.types.ts` | Eliminar interfaz `TenantContext` duplicada en `resource-limit.service.ts` |
| P3 | `src/auth/interceptors/tenant.interceptor.ts` | Agregar objeto `TenantContext` al request (contiene `userId` y `commerceId`), no solo `tenantId` string |
| P3 | Todos los servicios | Reemplazar pares de parámetros `(ownerId, commerceId?)` con un solo objeto `TenantContext` |

### Recomendaciones arquitectónicas

1. **Hacer commerceId obligatorio** — Hacer backfill de todos los `commerceId` null en Catalog y Order desde el commerce del ownerId (el id de la entidad Commerce). Luego agregar constraint NOT NULL.

2. **Resolver membresía por commerce** — Agregar columna `commerceId` a Membership. Cambiar `getUserMembership` para resolver la membresía del dueño del commerce cuando un MANAGER está operando.

3. **Resolución de tenant por defecto** — Cuando `X-Tenant-Id` no se provee y el usuario tiene exactamente un commerce, auto-resolver a él en el interceptor (actualmente solo se hace en generación de JWT, no por request).

4. **Eliminar fallback a ownerId** — Cada if/else `if (commerceId) { ... } else { where.ownerId = ownerId }` es una mina para MANAGER. Una vez que commerceId sea obligatorio, eliminar la rama else.

5. **Guard a nivel de controller** — Crear un `TenantGuard` que rechace requests sin tenant resuelto para rutas no públicas, en vez de que los servicios silenciosamente fallbackeen a userId.
