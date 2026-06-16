# Plan de Regresión — Implementación Multi-Tenant

> **Propósito**: Verificar que la migración multi-tenant (commerceId, TenantInterceptor, switch-context) no rompió endpoints existentes y que los nuevos endpoints funcionan correctamente.
>
> **Referencia**: [[technical/MULTITENANT-ARCHITECTURE]]

---

## Convenciones de Testing

- `[Auth]` = Requiere JWT válido en `Authorization: Bearer <token>`
- `[Tenant]` = Usa `req.tenantId` resuelto por `TenantInterceptor` (desde header `X-Tenant-Id` o JWT)
- `[Commerce]` = Crea o resuelve `commerceId` automáticamente
- `[Legacy]` = Endpoint que aún soporta `userId`/`ownerId` como fallback

---

## 1. Flujos Autenticación (Auth)

### 1.1 Login tradicional
| # | Escenario | Pasos | Expected |
|---|-----------|-------|----------|
| 1.1.1 | Login usuario SIN commerce previo | POST /auth/login con credenciales válidas | ✅ JWT emitido con `commerceId` (commerce auto-creado) |
| 1.1.2 | Login usuario CON commerce existente | POST /auth/login con credenciales válidas | ✅ JWT con `commerceId` del commerce existente |
| 1.1.3 | Login usuario CON múltiples commerces | POST /auth/login | ✅ JWT SIN `commerceId` (indeterminado → dashboard elige) |
| 1.1.4 | Login usuario legacy (sin UserRole.resourceId) | POST /auth/login | ✅ Commerce auto-creado, `resourceId` asignado |
| 1.1.5 | Verificar payload JWT | Decodificar token | ✅ `sub`=userId, `username`="role \| context", `role`=rol real, `commerceId` opcional |

### 1.2 Registro tradicional
| # | Escenario | Pasos | Expected |
|---|-----------|-------|----------|
| 1.2.1 | Registro comerciante (food, retail, etc.) | POST /auth/register con businessType comerciante | ✅ User + Commerce + UserRole(OWNER) + UserRole(CUSTOMER) creados |
| 1.2.2 | Registro customer | POST /auth/register con role=customer | ✅ User + UserRole(CUSTOMER). Sin Commerce |
| 1.2.3 | Registro con foto | POST /auth/register con archivo | ✅ Foto subida a Cloudinary, URL en respuesta |

### 1.3 Login/Registro social (Firebase)
| # | Escenario | Pasos | Expected |
|---|-----------|-------|----------|
| 1.3.1 | Social login 1ra vez | POST /auth/social/login con Firebase token | ✅ User creado + Commerce auto-creado (si aplica) + JWT con `commerceId` |
| 1.3.2 | Social login recurrente | POST /auth/social/login | ✅ JWT refrescado, sin duplicar User/Commerce |
| 1.3.3 | Social register con datos adicionales | POST /auth/social/register | ✅ Igual que 1.3.1 + datos del formulario persistidos |

### 1.4 Refresh
| # | Escenario | Pasos | Expected |
|---|-----------|-------|----------|
| 1.4.1 | Refresh con commerce único | POST /auth/refresh [Auth] | ✅ Nuevo JWT con `commerceId` |
| 1.4.2 | Refresh sin commerce | POST /auth/refresh [Auth] (usuario customer) | ✅ Nuevo JWT sin `commerceId` |

---

## 2. Switch Context (NUEVO)

### 2.1 POST /auth/switch-context
| # | Escenario | Pasos | Expected |
|---|-----------|-------|----------|
| 2.1.1 | Switch a commerce propio | POST /auth/switch-context { commerceId } [Auth] | ✅ Nuevo JWT con ese `commerceId` + `availableContexts` |
| 2.1.2 | Switch a commerce sin acceso | POST /auth/switch-context { commerceId } [Auth] | ❌ 403 Forbidden |
| 2.1.3 | Switch a commerce desactivado | POST /auth/switch-context { commerceId_inactive } [Auth] | ❌ 403 Forbidden |
| 2.1.4 | Switch con UUID inválido | POST /auth/switch-context { commerceId: "invalido" } | ❌ 400 Bad Request (validation) |

### 2.2 GET /auth/my-contexts (NUEVO)
| # | Escenario | Pasos | Expected |
|---|-----------|-------|----------|
| 2.2.1 | Listar contexts con múltiples commerces | GET /auth/my-contexts [Auth] | ✅ Array de { id, businessName, slug, context, businessType } |
| 2.2.2 | Listar contexts con 0 commerces | GET /auth/my-contexts [Auth] (customer) | ✅ Array vacío |
| 2.2.3 | Listar contexts sin auth | GET /auth/my-contexts | ❌ 401 Unauthorized |

---

## 3. Tenant Interceptor (Transversal)

### 3.1 Resolución de tenant
| # | Escenario | Pasos | Expected |
|---|-----------|-------|----------|
| 3.1.1 | Header X-Tenant-Id presente | Request con `X-Tenant-Id: <commerceId>` + JWT | ✅ `req.tenantId` = commerceId del header |
| 3.1.2 | Header X-Tenant-Id sin acceso | Header con commerceId ajeno | ❌ 403 Forbidden |
| 3.1.3 | Sin header, con JWT commerceId | Request sin X-Tenant-Id, JWT con commerceId | ✅ `req.tenantId` = commerceId del JWT |
| 3.1.4 | Sin header, sin JWT commerceId | Request sin ambos | ✅ `req.tenantId` = undefined |
| 3.1.5 | Request sin auth (público) | Endpoint público | ✅ Interceptor no interfiere |

### 3.2 PermissionsGuard + TenantInterceptor coexistencia
| # | Escenario | Pasos | Expected |
|---|-----------|-------|----------|
| 3.2.1 | Guard corre antes que Interceptor | Endpoint con ambos | ✅ `PermissionsGuard` resuelve tenant si `request.tenantId` no está seteado |
| 3.2.2 | Interceptor ya seteó tenantId | Endpoint protegido | ✅ Guard saltea resolución (`if (!request.tenantId)`), evita doble query |

---

## 4. Catálogos (Catalog)

### 4.1 Crear catálogo
| # | Escenario | Pasos | Expected |
|---|-----------|-------|----------|
| 4.1.1 | Crear con tenantId resuelto | POST /catalogs [Auth][Tenant] | ✅ `commerceId` asignado al catálogo |
| 4.1.2 | Crear sin tenantId | POST /catalogs [Auth] (sin commerce) | ✅ `commerceId` = null (backward compat) |
| 4.1.3 | Crear excediendo límite FREE | POST /catalogs con plan FREE y 11+ items | ❌ Resource limit error |

### 4.2 Listar catálogos
| # | Escenario | Pasos | Expected |
|---|-----------|-------|----------|
| 4.2.1 | Listar con tenantId | GET /catalogs/my-catalogs [Auth][Tenant] | ✅ Solo catálogos del commerce activo |
| 4.2.2 | Listar sin tenantId | GET /catalogs/my-catalogs [Auth] | ✅ Todos los catálogos del usuario (legacy) |
| 4.2.3 | Filtrar por tipo | GET /catalogs/my-catalogs?type=MENU [Auth] | ✅ Filtrado por tipo + tenant |

### 4.3 CRUD catálogo
| # | Escenario | Pasos | Expected |
|---|-----------|-------|----------|
| 4.3.1 | Obtener por ID propio | GET /catalogs/:id [Auth][Tenant] | ✅ Catálogo encontrado |
| 4.3.2 | Obtener catálogo de otro commerce | GET /catalogs/:id [Auth] (otro commerceId) | ❌ 404 |
| 4.3.3 | Actualizar catálogo | PUT /catalogs/:id [Auth][Tenant] | ✅ Actualizado, validado por commerceId |
| 4.3.4 | Archivar catálogo | PUT /catalogs/:id/archive [Auth][Tenant] | ✅ Archivado |
| 4.3.5 | Eliminar catálogo | DELETE /catalogs/:id [Auth][Tenant] | ✅ Eliminado |

### 4.4 Items de catálogo
| # | Escenario | Pasos | Expected |
|---|-----------|-------|----------|
| 4.4.1 | Agregar item | POST /catalogs/:id/items [Auth][Tenant] | ✅ Item creado, validado por commerceId |
| 4.4.2 | Actualizar item | PUT /catalogs/:id/items/:itemId [Auth][Tenant] | ✅ Validado |
| 4.4.3 | Eliminar item | DELETE /catalogs/:id/items/:itemId [Auth][Tenant] | ✅ Validado |

### 4.5 Endpoints públicos (sin cambios esperados)
| # | Escenario | Pasos | Expected |
|---|-----------|-------|----------|
| 4.5.1 | Búsqueda pública | GET /catalogs/public/search?type=MENU | ✅ Sin auth, sin tenant |
| 4.5.2 | Catálogo público por slug | GET /catalogs/public/:slug | ✅ Sin auth |
| 4.5.3 | Catálogos públicos por ownerId | GET /catalogs/public/owner/:ownerId | ✅ Sin auth, filtra por ownerId |

---

## 5. Eventos

### 5.1 Crear evento
| # | Escenario | Pasos | Expected |
|---|-----------|-------|----------|
| 5.1.1 | Crear con tenantId | POST /events [Auth][Tenant] | ✅ `commerceId` = tenantId, `organizerId` = userId |
| 5.1.2 | Crear sin tenantId | POST /events [Auth] (sin commerce) | ✅ `commerceId` = null, `tenantId` = userId (legacy) |
| 5.1.3 | Crear con fechas inválidas | POST /events con startDate > endDate | ❌ 400 |

### 5.2 Listar eventos
| # | Escenario | Pasos | Expected |
|---|-----------|-------|----------|
| 5.2.1 | Listar con tenantId | GET /events [Auth][Tenant] | ✅ Solo eventos del commerce activo |
| 5.2.2 | Listar sin tenantId | GET /events [Auth] | ✅ Todos los eventos del usuario (por tenantId legacy) |

### 5.3 CRUD evento
| # | Escenario | Pasos | Expected |
|---|-----------|-------|----------|
| 5.3.1 | Obtener evento propio | GET /events/:id [Auth][Tenant] | ✅ Validado por commerceId |
| 5.3.2 | Obtener evento de otro commerce | GET /events/:id [Auth] (otro commerceId) | ❌ 404 |
| 5.3.3 | Actualizar evento propio | PUT /events/:id [Auth][Tenant] | ✅ Validado |
| 5.3.4 | Eliminar evento propio | DELETE /events/:id [Auth][Tenant] | ✅ Validado |

### 5.4 Ticket Types
| # | Escenario | Pasos | Expected |
|---|-----------|-------|----------|
| 5.4.1 | Crear ticket type | POST /ticket-types [Auth][Tenant] | ✅ Valida que el evento pertenezca al commerce |
| 5.4.2 | Listar por evento | GET /ticket-types/event/:eventId [Auth][Tenant] | ✅ Valida ownership del evento |
| 5.4.3 | Actualizar ticket type | PUT /ticket-types/:id [Auth][Tenant] | ✅ Valida ownership via commerceId |
| 5.4.4 | Eliminar ticket type | DELETE /ticket-types/:id [Auth][Tenant] | ✅ Valida ownership |

---

## 6. Órdenes (Orders)

### 6.1 Crear orden
| # | Escenario | Pasos | Expected |
|---|-----------|-------|----------|
| 6.1.1 | Crear orden con items de 1 catálogo | POST /orders [Auth] | ✅ `commerceId` resuelto desde catalog.items[].catalog.commerceId |
| 6.1.2 | Crear orden con items de distintos commerces | POST /orders [Auth] | ❌ 400 Bad Request (cross-commerce) |
| 6.1.3 | Crear orden anónima | POST /orders con header `x-anonymous-id` | ✅ Sin auth, commerceId resuelto igual |
| 6.1.4 | Crear orden con ítem inexistente | POST /orders | ❌ 400 |

### 6.2 Listar órdenes
| # | Escenario | Pasos | Expected |
|---|-----------|-------|----------|
| 6.2.1 | byOwner (comprador) | GET /orders/byOwner [Auth] | ✅ Filtra por userId del JWT |
| 6.2.2 | byBusinessOwner con tenantId | GET /orders/byBusinessOwner/:ownerId [Auth][Tenant] | ✅ Filtra por commerceId + valida ownerId |
| 6.2.3 | byBusinessOwner sin tenantId | GET /orders/byBusinessOwner/:ownerId [Auth] | ✅ Filtra por ownerId (legacy) |
| 6.2.4 | byAnonymous | GET /orders/byAnonymous con header | ✅ Sin auth |

---

## 7. Membresía (Membership)

### 7.1 Obtener membresía
| # | Escenario | Pasos | Expected |
|---|-----------|-------|----------|
| 7.1.1 | Con tenantId | GET /membership [Auth][Tenant] | ✅ Busca membership por userId + commerceId |
| 7.1.2 | Sin tenantId | GET /membership [Auth] | ✅ Busca membership por userId (legacy) |
| 7.1.3 | Sin membership previa | GET /membership [Auth] | ✅ Crea FREE automáticamente |

### 7.2 Suscribirse
| # | Escenario | Pasos | Expected |
|---|-----------|-------|----------|
| 7.2.1 | Suscribir con tenantId | POST /membership/subscribe [Auth][Tenant] | ✅ Membership asociada al commerce |
| 7.2.2 | Suscribir a FREE | POST /membership/subscribe { plan: FREE } [Auth] | ✅ Sin pago, upgrade inmediato |
| 7.2.3 | Suscribir a plan pago | POST /membership/subscribe { plan: PREMIUM, cardTokenId } [Auth] | ✅ Preaprobación MP + membership actualizada |

---

## 8. Commerce

### 8.1 CRUD Commerce
| # | Escenario | Pasos | Expected |
|---|-----------|-------|----------|
| 8.1.1 | Crear commerce | POST /commerce [Auth] | ✅ Crea Commerce + UserRole OWNER con resourceId |
| 8.1.2 | Listar mis commerces | GET /commerce/my [Auth] | ✅ Solo donde soy OWNER |
| 8.1.3 | Obtener por ID | GET /commerce/:id [Auth] | ✅ Público para autenticados |
| 8.1.4 | Actualizar como OWNER | PUT /commerce/:id [Auth] | ✅ Permitido |
| 8.1.5 | Actualizar como MANAGER | PUT /commerce/:id [Auth] (MANAGER) | ✅ Permitido via `hasAccessToCommerce()` |
| 8.1.6 | Actualizar como otro usuario | PUT /commerce/:id [Auth] (sin rol) | ❌ 403 Forbidden |
| 8.1.7 | Desactivar como OWNER | DELETE /commerce/:id [Auth] | ✅ Soft delete |
| 8.1.8 | Desactivar como MANAGER | DELETE /commerce/:id [Auth] (MANAGER) | ✅ Permitido via `hasAccessToCommerce()` |

---

## 9. Payments / Fee Resolver

### 9.1 Marketplace Fee
| # | Escenario | Pasos | Expected |
|---|-----------|-------|----------|
| 9.1.1 | Fee con merchant_config personalizado | Crear merchant_config con custom fee | ✅ Usa fee personalizado (source: custom) |
| 9.1.2 | Fee por membresía sin config personalizado | Usuario con PREMIUM sin merchant_config | ✅ Usa fee de membresía (source: membership) |
| 9.1.3 | Fee global sin config ni membresía | Usuario FREE sin merchant_config | ✅ Usa fee global de AppData |
| 9.1.4 | Fee con commerceId vs tenantId | Commerce con fee custom vs tenant legacy | ✅ commerceId tiene prioridad |

---

## 10. Permissions y Roles

### 10.1 hasAccessToCommerce()
| # | Escenario | Pasos | Expected |
|---|-----------|-------|----------|
| 10.1.1 | Usuario con UserRole.resourceId | UserRole con resourceId = commerceId | ✅ Acceso concedido |
| 10.1.2 | Usuario legacy = ownerId | User sin UserRole, pero commerce.ownerId = userId | ✅ Acceso concedido (fallback) |
| 10.1.3 | Usuario sin relación | User sin rol ni ownerId | ❌ Sin acceso |

### 10.2 Asignación de rol
| # | Escenario | Pasos | Expected |
|---|-----------|-------|----------|
| 10.2.1 | Asignar rol con resourceId | POST /user-roles/assign con resourceId | ✅ Rol creado con commerceId vinculado |
| 10.2.2 | Asignar rol duplicado | Mismo userId + role + context + resourceId | ❌ 409 Conflict |

---

## 11. Migraciones DB (verificación datos)

| # | Migración | Verificación |
|---|-----------|-------------|
| 11.1 | 009 - commerce table | `SELECT * FROM commerce` — existe, tiene datos |
| 11.2 | 010 - commerceId en events y ticket_purchases | `SELECT commerceId FROM events LIMIT 1` — no nulo para eventos migrados |
| 11.3 | 011 - commerceId en orders | `SELECT commerceId FROM orders LIMIT 1` — no nulo para órdenes migradas |
| 11.4 | 012 - commerceId en merchant_configs | `SELECT commerceId FROM merchant_configs LIMIT 1` |
| 11.5 | 013 - commerceId en membership | `SELECT "commerceId" FROM membership LIMIT 1` |
| 11.6 | 014 - resourceId en user_roles | `SELECT resource_id FROM user_roles WHERE role='owner' LIMIT 1` — no nulo |

---

## Resumen de Cobertura

| Módulo | Modificados | Nuevos | Sin cambios | Total casos |
|--------|-------------|--------|-------------|-------------|
| Auth | 4 (login, register, social, refresh) | 2 (switch-context, my-contexts) | 1 (firebase health) | ~15 |
| Catalog | 7 (CRUD + items) | 0 | 3 (públicos) | ~12 |
| Events | 4 (CRUD) | 0 | 0 | ~8 |
| Ticket Types | 4 (CRUD) | 0 | 0 | ~8 |
| Orders | 2 (byBusinessOwner, create) | 0 | 2 (byOwner, byAnonymous) | ~8 |
| Membership | 2 (GET, POST subscribe) | 0 | 2 (PUT, DELETE) | ~8 |
| Commerce | 4 (CRUD) | 0 | 0 | ~8 |
| Transversal | TenantInterceptor, PermissionsGuard | — | — | ~6 |
| Migraciones | — | 6 scripts | — | ~6 |

**Total casos de regresión: ~80+**
**Prioridad alta:** Auth flujo completo (login → JWT → tenant → datos filtrados)
