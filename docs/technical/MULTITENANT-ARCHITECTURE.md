---
tags:
  - domain/multi-tenant
  - domain/commerce
  - repo/api
  - type/technical
  - status/in-progress
aliases:
  - Multi-tenant Architecture API
  - Arquitectura Multi-Tenant Backend
  - Tenant Resolution
---
# Arquitectura Multi-Tenant — menucom-api (Backend)

> Documento técnico de la arquitectura multitenant del backend NestJS, estado actual, problemas y plan de migración.

---

## 1. Situación Actual

### 1.1 Cómo se identifica el tenant hoy
El tenant se identifica mediante la entidad `Commerce`. Cada usuario puede tener uno o varios comercios.

```
Commerce (id: "uuid-com")
  ├── Owner: User (id: "user-abc")
  ├── Catalog (commerceId: "uuid-com")
  ├── Order (commerceId: "uuid-com")
  ├── Event (commerceId: "uuid-com")
  └── UserRole (resourceId: "uuid-com", role: OWNER)
```

### 1.2 Cómo se resuelve el tenant en requests

```
[Request] → JwtAuthGuard → req.user = { userId, username: "owner | restaurant", role, commerceId }
    ↓
[TenantInterceptor] → resuelve tenantId desde header X-Tenant-Id o JWT commerceId
    ↓
[PermissionsGuard] → userRoleService.getUserPermissions(userId, context)
    ↓
[Controller/Service] → filtra por req.tenantId (commerceId)
```

**Solución**: El JWT incluye `commerceId` y el `TenantInterceptor` resuelve el tenant desde el header o el JWT. Usuarios legacy sin commerce reciben uno auto-creado al hacer login.

### 1.3 Archivos con dependencia directa de `userId` como tenant

| Archivo | Campo usado | Problema | Estado |
|---------|------------|----------|--------|
| `src/catalog/services/catalog.service.ts` | `ownerId` / `commerceId` | Filtra por commerceId si disponible, sino ownerId | ✅ Migrado |
| `src/orders/orders.service.ts` | `ownerId` | Filtra por userId | ✅ Migrado |
| `src/events/events.service.ts` | `organizerId` | Filtra por userId | ✅ Migrado |
| `src/payments/services/marketplace-fee-resolver.service.ts` | `tenantId` (userId) | Resuelve fee por userId | ✅ Migrado |
| `src/auth/services/user-role.service.ts` | `userId` | getPermissions usa userId | ✅ `hasAccessToCommerce()` agregado |
| `src/auth/guards/permissions.guard.ts` | `user.userId` | Valida permisos por userId | ✅ Migrado |

### 1.4 Archivos creados/modificados en esta iteración

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `src/auth/types/auth.types.ts` | **Creado** | Interfaces `JwtPayload` y `AuthenticatedUser` |
| `src/auth/types/request.types.ts` | **Modificado** | `tenantId` en Express Request, tipos estrictos |
| `src/auth/jwt.strategy.ts` | **Modificado** | Fix bug `role=username`, usa `JwtPayload` |
| `src/auth/services/auth.service.ts` | **Modificado** | JWT con `commerceId` + visual username `"role | context"`, `switchContext()`, `resolveInitialCommerceId()` con auto-creación de commerce para usuarios legacy |
| `src/auth/interceptors/tenant.interceptor.ts` | **Creado** | Resuelve `req.tenantId` desde header o JWT |
| `src/auth/dto/switch-context.dto.ts` | **Creado** | DTO para switch-context endpoint |
| `src/auth/controllers/auth.controller.ts` | **Modificado** | Endpoints `switch-context` y `my-contexts` |
| `src/auth/services/user-role.service.ts` | **Modificado** | Método `hasAccessToCommerce()` |
| `src/auth/auth.module.ts` | **Modificado** | Importa `CommerceModule`, registra `TenantInterceptor` |
| `src/commerce/commerce.module.ts` | **Modificado** | `forwardRef` para evitar dependencia circular |
| `src/app.module.ts` | **Modificado** | `APP_INTERCEPTOR` para `TenantInterceptor` |

### 1.8 Fixes aplicados (Code Review — Junio 2026)

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `src/membership/membership.controller.ts` | **Corregido** | `req.tenantId` → `req.user.userId` (BUG: estaba usando commerceId como userId) |
| `src/commerce/controllers/commerce.controller.ts` | **Limpiado** | Eliminado endpoint duplicado `GET /commerce/my-contexts` |
| `src/auth/guards/permissions.guard.ts` | **Optimizado** | Saltea resolución de tenant si `request.tenantId` ya está seteado |
| `src/events/services/ticket-types.service.ts` | **Corregido** | Importa `TenantContext` compartido en vez de definición inline |
| `src/orders/services/orders.service.ts` | **Mejorado** | `findAll()` acepta `TenantContext` opcional y filtra por `commerceId` |
| `src/commerce/services/commerce.service.ts` | **Mejorado** | `update()` y `deactivate()` permiten MANAGERs vía `hasAccessToCommerce()` |
| DB migration `014_populate_user_roles_resource_id` | **Creada** | Pobla `user_roles.resourceId` desde `commerce.id` para roles legacy |

### 1.5 Archivos modificados en migración de Catalog

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `src/catalog/entities/catalog.entity.ts` | **Modificado** | Agregado `commerceId` (uuid nullable) + relación `Commerce` |
| `src/catalog/services/catalog.service.ts` | **Reescrito** | Soporta `commerceId` en todos los métodos, `TenantContext` interface |
| `src/catalog/controllers/catalog.controller.ts` | **Reescrito** | Usa `req.tenantId` (via `TenantInterceptor`), tipado `AuthenticatedRequest` |
| `src/catalog/catalog.module.ts` | **Modificado** | Incluye `Commerce` en `TypeOrmModule.forFeature` |
| DB migration `create_commerce_and_add_commerce_id` | **Aplicada** | Crea tabla `commerce`, pobla desde `catalogs`, agrega `commerceId` a `catalogs` |
| DB migration `add_fk_catalogs_commerce` | **Aplicada** | Cambia `commerceId` a UUID, agrega FK a `commerce(id)` |

### 1.6 Archivos modificados en migración de Events

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `src/events/entities/event.entity.ts` | **Modificado** | Agregado `commerceId` (uuid nullable) + relación `Commerce` + `@Index` |
| `src/events/entities/ticket-purchase.entity.ts` | **Modificado** | Agregado `commerceId` (uuid nullable) + relación `Commerce` + `@Index` |
| `src/events/services/events.service.ts` | **Reescrito** | Usa `TenantContext` interface, `getTenantFilter()`, prefiero `commerceId` sobre `tenantId` legacy |
| `src/events/controllers/events.controller.ts` | **Reescrito** | Usa `AuthenticatedRequest`, `req.tenantId` + `req.user.userId` para `TenantContext` |
| `src/events/services/ticket-types.service.ts` | **Reescrito** | Usa `TenantContext`, valida ownership via `commerceId` o `tenantId` legacy |
| `src/events/controllers/ticket-types.controller.ts` | **Reescrito** | Usa `AuthenticatedRequest` + `TenantContext` |
| `src/events/services/tickets.service.ts` | **Modificado** | `createPendingPurchase` acepta `commerceId` opcional |
| `src/events/services/event-payment.service.ts` | **Modificado** | Pasa `ticketType.event.commerceId` a `createPendingPurchase` |
| `src/events/events.module.ts` | **Modificado** | Agrega `Commerce` en `TypeOrmModule.forFeature` |
| DB migration `010_add_commerce_id_to_events_and_tickets` | **Creada** | Agrega `commerceId` a `events` y `ticket_purchases`, FKs a `commerce(id)`, pobla desde `commerce` |

### 1.7 Archivos modificados en migración de Orders

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `src/orders/entities/order.entity.ts` | **Modificado** | Agregado `commerceId` (uuid nullable) + relación `Commerce` + `@Index` |
| `src/orders/services/orders.service.ts` | **Modificado** | `determineOwnerAndValidate()` resuelve `commerceId` desde el catálogo, `findByOwnerId()` filtra por `commerceId`, `create()` setea `commerceId` |
| `src/orders/controllers/orders.controller.ts` | **Reescrito** | Usa `AuthenticatedRequest` + `TenantContext` en `byBusinessOwner` |
| `src/orders/orders.module.ts` | **Modificado** | Agrega `Commerce` en `TypeOrmModule.forFeature` |
| DB migration `011_add_commerce_id_to_orders` | **Creada** | Agrega `commerceId` a `orders`, FK a `commerce(id)`, index, pobla desde datos existentes |

---

## 2. Modelo de Datos

### 2.1 Tablas existentes relevantes

```sql
-- user_roles — asignación de roles
CREATE TABLE user_roles (
  id UUID PRIMARY KEY,
  user_id VARCHAR NOT NULL,      -- FK -> user.id
  role VARCHAR NOT NULL,         -- 'owner' | 'manager' | 'customer' | etc
  context VARCHAR NOT NULL,      -- 'restaurant' | 'events' | 'general' | etc
  resource_id VARCHAR,           -- nullable → debería ser commerce.id
  is_active BOOLEAN DEFAULT true,
  granted_by VARCHAR,
  expires_at TIMESTAMP,
  metadata JSONB,
  granted_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- user — entidad de usuario (no cambiará)
CREATE TABLE "user" (
  id VARCHAR PRIMARY KEY,
  name VARCHAR,
  email VARCHAR,
  role VARCHAR,                  -- legacy, mantener
  ...
);
```

### 2.2 Entidad Commerce (por crear)

```sql
CREATE TABLE commerce (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id VARCHAR NOT NULL,     -- FK -> user.id
  business_name VARCHAR NOT NULL,
  slug VARCHAR UNIQUE NOT NULL,
  business_type VARCHAR,         -- 'restaurant' | 'wardrobe' | 'marketplace' | 'events'
  context VARCHAR NOT NULL,      -- BusinessContext enum
  logo_url VARCHAR,
  cover_image_url VARCHAR,
  description TEXT,
  address VARCHAR,
  phone VARCHAR,
  is_active BOOLEAN DEFAULT true,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### 2.3 Migración de datos existentes

```sql
-- Para cada usuario con catálogos, crear un Commerce
INSERT INTO commerce (owner_id, business_name, slug, business_type, context)
SELECT 
  u.id,
  COALESCE(c.name, u.name) as business_name,
  COALESCE(c.slug, lower(regexp_replace(u.name, '[^a-zA-Z0-9]', '-', 'g')) || '-' || substr(u.id::text, 1, 8)) as slug,
  c.type as business_type,
  CASE 
    WHEN c.type IN ('food', 'dinning') THEN 'restaurant'
    WHEN c.type = 'clothes' THEN 'wardrobe'
    WHEN c.type IN ('retail', 'grocery', 'electronics') THEN 'marketplace'
    ELSE 'general'
  END as context
FROM "user" u
INNER JOIN catalogs c ON u.id = c.owner_id
WHERE NOT EXISTS (SELECT 1 FROM commerce co WHERE co.owner_id = u.id);
```

---

## 3. Endpoints Afectados por la Migración

### 3.1 Catálogos

| Endpoint | Cambio |
|----------|--------|
| `POST /catalogs` | Asignar `commerceId` al catalog (nuevo campo) |
| `GET /catalogs/my-catalogs` | Filtrar por `commerceId` del contexto activo |
| `GET /catalogs/:catalogId` | Validar que el catalog pertenezca al commerce del usuario |
| `POST /catalogs/:catalogId/items` | Validar ownership |
| `GET /catalogs/public/:slug` | Sin cambios (público, no depende de auth) |

### 3.2 Órdenes

| Endpoint | Cambio |
|----------|--------|
| `POST /orders` | Asociar `commerceId` al crear orden (desde catálogo) |
| `GET /orders/byOwner` | Filtrar por `commerceId` si contexto activo, sino `userId` |
| `GET /orders/byBusinessOwner/:ownerId` | Validar acceso al commerce, filtrar por `commerceId` si disponible |
| `GET /orders` (`findAll()`) | Acepta `TenantContext` opcional, filtra por `commerceId` si se provee |

### 3.3 Eventos

| Endpoint | Cambio |
|----------|--------|
| `POST /events` | Usar `commerceId` del `TenantContext` como tenant, mantener `organizerId` como userId |
| `GET /events` | Filtrar por `commerceId` si disponible, sino `tenantId` (legacy) |
| `GET /events/:id` | Validar ownership via `commerceId` |
| `PUT /events/:id` | Validar ownership via `commerceId` |
| `DELETE /events/:id` | Validar ownership via `commerceId` |
| `POST /ticket-types` | Validar que el event pertenece al commerce del usuario |
| `GET /ticket-types/event/:eventId` | Validar ownership del event via `commerceId` |
| `PUT /ticket-types/:id` | Validar que el ticket type pertenece al commerce |
| `DELETE /ticket-types/:id` | Validar ownership via `commerceId` |

### 3.4 Membresía

| Endpoint | Cambio |
|----------|--------|
| `GET /membership` | Debe resolver membresía por `commerceId`, no por `userId` |
| `POST /membership/subscribe` | Asociar suscripción al commerce |

---

## 4. Flujo de Contexto Objetivo

```
[Login / Register]
  ↓
[JWT emitido con commerceId si tiene 1 commerce]
  ↓
[GET /auth/my-contexts] → lista de comercios donde tiene rol
  ↓
[Si >1 commerce → muestra selector en dashboard]
  ↓
[POST /auth/switch-context { commerceId }] → nuevo JWT con ese commerceId
  ↓
[Request → X-Tenant-Id: <commerceId> header]
  ↓
[TenantInterceptor → resuelve commerceId en req.tenantId]
  ↓
[Services filtran por req.tenantId]
```

### 4.1 TenantResolutionService (Servicio Compartido) ✅

> **Archivo:** `src/auth/services/tenant-resolution.service.ts`

Extrae la lógica de resolución de tenant para evitar duplicación entre `TenantInterceptor` y `PermissionsGuard`.

```typescript
@Injectable()
export class TenantResolutionService {
  constructor(private readonly userRoleService: UserRoleService) {}

  async resolveTenantId(request: any, userId: string): Promise<string | undefined> {
    const headerTenantId = request.headers['x-tenant-id'] as string | undefined;

    if (headerTenantId) {
      const hasAccess = await this.userRoleService.hasAccessToCommerce(userId, headerTenantId);
      if (!hasAccess) throw new ForbiddenException('No tienes acceso al comercio especificado');
      return headerTenantId;
    }

    if (request.user?.commerceId) {
      return request.user.commerceId;
    }

    return undefined;
  }
}
```

### 4.2 TenantInterceptor ✅ REFACTORED (usa TenantResolutionService)

> **Archivo:** `src/auth/interceptors/tenant.interceptor.ts`

```typescript
@Injectable()
export class TenantInterceptor implements NestInterceptor {
  constructor(private readonly tenantResolution: TenantResolutionService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    if (!request.user) return next.handle();

    const resolved = await this.tenantResolution.resolveTenantId(request, request.user.userId);
    if (resolved) request.tenantId = resolved;

    return next.handle();
  }
}
```

**Registro:** Global vía `APP_INTERCEPTOR` en `AppModule`.

### 4.3 JWT Payload ✅ ACTUALIZADO

> **Archivo:** `src/auth/types/auth.types.ts`

```typescript
export interface JwtPayload {
  sub: string;        // userId
  username: string;   // visual helper "role | context" (ej: "owner | restaurant")
  role: string;       // role real (FIX: antes era = username)
  commerceId?: string; // commerce activo (opcional)
}

export interface AuthenticatedUser {
  userId: string;
  username: string;   // visual helper "role | context"
  role: string;
  commerceId?: string;
}
```

**Nota:** `username` es SOLO ayuda visual, no se usa para validar lógica. Formato: `"role | context"` (ej: `"owner | restaurant"`, `"customer | general"`).

### 4.4 Switch Context Endpoint ✅ IMPLEMENTADO

```
POST /auth/switch-context
Body: { commerceId: "uuid" }
Response: { access_token, commerceId, context, availableContexts }

GET /auth/my-contexts
Response: [{ id, businessName, slug, context, businessType }]
```

**Validaciones:**
- Verifica que el usuario tenga un rol en el commerce (via `user_roles.resourceId`)
- Verifica que el commerce esté activo
- Genera nuevo JWT con `commerceId` incluido

---

## 5. Invitación de Miembros (Owner Invite Flow)

### 5.1 Endpoints planeados

| Método | Endpoint | Rol Requerido | Descripción |
|--------|----------|---------------|-------------|
| POST | `/commerce/:commerceId/invite` | OWNER | Invitar usuario por email |
| GET | `/commerce/:commerceId/members` | OWNER/MANAGER | Listar miembros |
| PATCH | `/commerce/:commerceId/members/:userId` | OWNER | Cambiar rol |
| DELETE | `/commerce/:commerceId/members/:userId` | OWNER | Revocar acceso |

### 5.2 Flujo de invitación

```
[OWNER] → POST /commerce/:commerceId/invite { email, role }
  ↓
[Backend busca usuario por email]
  ↓
[Si existe → asigna UserRole con commerceId]
  ↓
[Si no existe → opcional: enviar email de invitación + crear al registrarse]
```

---

## 6. Decisiones Arquitectónicas Pendientes

### 6.1 ¿Header `X-Tenant-Id` vs subdominio?
- **Decisión preliminar**: Header `X-Tenant-Id` (más simple, sin DNS management)
- **Alternativa**: `{commerce-slug}.menucom.app` (mejor para SEO, más complejo)

### 6.2 ¿Commerce slug único globalmente o por contexto?
- **Recomendación**: Globalmente único (con validación al crear)
- Los slugs existentes en catalogs seguirán funcionando para URLs públicas

### 6.3 ¿ResourceId se migra a commerceId?
- **Sí**, el campo `resourceId` en `UserRole` debe apuntar a `commerce.id`
- Para MANAGER: `resourceId = commerce.id`
- Para roles legacy sin commerce: `resourceId` puede quedar null

---

## 7. Dependencias entre Módulos para la Migración

```
commerce (nuevo módulo)
  ├── auth (user-role necesita commerceId)
  ├── catalog (ownerId → commerceId)
  ├── orders (ownerId → commerceId)
  ├── events (organizerId → commerceId)
  ├── membership (userId → commerceId)
  └── payments (asociar a commerce)
```

**Orden de migración recomendado:**
1. `commerce` — crear entidad, endpoints básicos, migración de datos ✅ **HECHO**
2. `auth` — modificar UserRole, JWT, switch-context ✅ **HECHO**
3. `catalog` — migrar queries (menor riesgo) ✅ **HECHO**
4. `events` — migrar queries (mediano riesgo) ✅ **HECHO**
5. `orders` — migrar queries (alto riesgo — datos transaccionales) ✅ **HECHO**
6. `membership` — migrar (riesgo medio) ✅ **HECHO**
7. `payments` — ajustar asociación (fee resolver + merchant_config) ✅ **HECHO**

**Migraciones aplicadas:**
| # | Nombre | Descripción |
|---|--------|-------------|
| 010 | `add_commerce_id_to_events_and_tickets` | `commerceId` a `events` y `ticket_purchases` |
| 011 | `add_commerce_id_to_orders` | `commerceId` a `orders` |
| 014 | `populate_user_roles_resource_id` | Pobla `user_roles.resourceId` desde `commerce.id` |

---

## 8. Code Review — Hallazgos y Refactors

### 8.1 DRY: Duplicación de lógica tenant en Guard e Interceptor

`PermissionsGuard` y `TenantInterceptor` implementan la **misma resolución** de `X-Tenant-Id` + JWT fallback + validación via `hasAccessToCommerce()`.

**Problema:** Los Guards corren antes que los Interceptors en NestJS. El guard resuelve y setea `request.tenantId`, luego el interceptor lo vuelve a resolver — doble query a BD innecesaria.

**Solución:** `TenantResolutionService` (servicio compartido inyectable en ambos) que encapsula:

```
resolveTenantId(request, userId) → string | undefined
```

**Archivo:** `src/auth/services/tenant-resolution.service.ts` ✅ **IMPLEMENTADO**

**Optimización adicional:** `PermissionsGuard` ahora verifica `if (request.tenantId) return true;` al inicio, salteando la re-resolución cuando el `TenantInterceptor` ya corrió. ✅ **RESUELTO**

### 8.2 `hasAccessToCommerce()` no cubre roles legacy — 🟡 PARCIALMENTE RESUELTO

Usuarios registrados antes de la migración tienen `UserRole.resourceId = null`. Para estos usuarios legacy, `hasAccessToCommerce()` retorna `false` aunque sean el `ownerId` del commerce.

**Fix aplicado:** Al hacer login/refresh, `resolveInitialCommerceId()` detecta si el usuario tiene 0 commerces y le auto-crea uno (con el `resourceId` correcto). Esto cubre el caso de usuarios legacy que nunca tuvieron commerce.

**Fix aplicado:** `hasAccessToCommerce()` ahora tiene fallback: si no encuentra `UserRole` con `resourceId`, consulta si `userId === commerce.ownerId`. ✅ **RESUELTO**

### 8.3 `username` en JWT es visual helper `"role | context"` ✅ RESUELTO

```typescript
// auth.service.ts — buildVisualUsername()
private buildVisualUsername(role: string, context?: string): string {
  return context ? `${role} | ${context}` : role;
}
```

`username` ahora contiene un string visual como `"owner | restaurant"` o `"customer | general"`. No se usa para validar lógica.

### 8.4 Endpoints duplicados `my-contexts`

- `GET /auth/my-contexts` — retorna DTO limpio ✅
- ~~`GET /commerce/my-contexts` — retorna entidad `Commerce` completa (expone más datos)~~ ❌ **ELIMINADO**

Se eliminó el endpoint redundante en `commerce.controller.ts`. `GET /auth/my-contexts` es el canónico. ✅ **RESUELTO**

### 8.5 Interfaz `TenantContext` duplicada en 3 módulos

```typescript
interface TenantContext { userId: string; commerceId?: string | null; }
```

Definida inline en:
- `catalog/services/catalog.service.ts:30`
- `orders/services/orders.service.ts:24`
- `events/services/events.service.ts:10`

**Fix:** Mover a `auth/types/tenant-context.types.ts` ✅ **IMPLEMENTADO**

**Verificación:** Todos los módulos (catalog, orders, events, ticket-types) importan desde el shared type. Sin definiciones inline. ✅ **RESUELTO**

---

## 9. Referencias

- `../../AGENTS.md` — Contexto para agentes trabajando en menucom-api
- [[project/ROLES-AND-CONTEXTS-DEEP-DIVE]] — Análisis profundo de roles
- [[implementation/ROLE-SYSTEM-IMPLEMENTATION-PLAN]] — Plan de implementación
- `../../docs/MULTITENANT-STRATEGY.md` — Estrategia global del proyecto
- `../../ARCHITECTURE.md` — Arquitectura general del sistema
- `../../GUIA_COMERCIAL.md` — Modelo de negocio
