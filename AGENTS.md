# AGENTS.md — Contexto para Agentes de IA en menucom-api

> Propósito: Proporcionar contexto técnico específico del backend NestJS, orientado por la misión de profesionalizar emprendedores.

---

## Stack Tecnológico

- **Runtime**: Node.js (NestJS 10, TypeScript 5)
- **ORM**: TypeORM 0.3 con PostgreSQL
- **Auth**: Passport JWT + Firebase Admin (social login)
- **Pagos**: MercadoPago SDK (preferences, suscripciones, webhooks)
- **Storage**: Cloudinary (imágenes)
- **Testing**: Jest + Supertest (e2e)

---

## Arquitectura Multi-Tenant (Estado Actual)

### Cómo funciona hoy
- El tenant se identifica implícitamente por `userId`
- YA EXISTE entidad `Commerce` con `ownerId`, `slug`, `businessName`, `context`, `logoUrl`, `description`, `address`, `phone`
- `ownerId` en catálogos/órdenes todavía = `userId` (pendiente de migrar a `commerceId`)
- `resourceId` en `UserRole` ya se usa al crear Commerce (asigna commerceId automáticamente)
- JWT lleva `sub` (userId), `username` (role legacy) y opcionalmente `commerceId`
- `TenantInterceptor` global resuelve tenant desde header `X-Tenant-Id` o JWT
- `PermissionsGuard` verifica permisos usando tenant resuelto

### Problemas conocidos
1. MANAGER no puede operar — datos filtrados por `userId`, no `commerceId`
2. Owner tiene 1:1 con User en la práctica
3. Sin switch de contexto real (`POST /auth/switch-context` pendiente)

---

## Sistema de Roles

### Entidad `UserRole`
```typescript
userId: string;       // FK -> User
role: RoleType;       // OWNER | MANAGER | OPERATOR | ADMIN | CUSTOMER | EVENT_ORGANIZER
context: BusinessContext; // RESTAURANT | WARDROBE | MARKETPLACE | GENERAL | EVENTS
resourceId: string;   // commerceId cuando aplica
```

### Permisos
Matriz completa en `src/auth/models/permissions.model.ts` con 23 permisos por rol/contexto.

---

## Convenciones de Código (Mission-Aware)

### Al crear endpoints
```typescript
// INCORRECTO:
@Get('my-catalogs')
findByOwner(req.user.userId); // filtra por userId — rompe multi-tenant

// CORRECTO:
const commerceId = req.headers['x-tenant-id'] || req.user.commerceId;
findByCommerce(commerceId);
```

### Reglas generales
- Usar `commerceId` para filtrar datos, no `userId`
- Siempre validar que el usuario tenga rol sobre el `commerceId`
- Documentar servicios con `ownerId` como pendiente de migrar a `commerceId`

---

## Alineación con la Misión: Profesionalización del Emprendedor

> Misión global: **Convertir a los Emprendedores (que venden productos u ofrecen servicios) en profesionales**

La misión impacta directamente las decisiones técnicas de backend. Cada entidad, endpoint y servicio debe responder a esta pregunta.

### Lo que el backend YA provee para la misión
| Componente | Aporte |
|-----------|--------|
| `Commerce` entity | Identidad de negocio separada del usuario |
| `Membership` + planes | Monetización profesional escalonada (incluye `maxCommerces`) |
| `MercadoPago` integration | Pagos profesionales con desglose |
| `Orders` + status flow | Tracking profesional de pedidos |
| `Catalog` + `CatalogItem` | Catálogo digital con precios, fotos, atributos |
| `UserRole` + matriz permisos | Delegación profesional (OWNER/MANAGER) |
| `Public` endpoints | API pública para landing, catálogos compartidos |
| Multi-tenant infra | Aislamiento de datos por commerce |

### Gaps que debe resolver el backend (priorizados)

#### 🔴 Fase 1 — Fundación profesional (inmediata)

**1. BusinessProfile module** (`src/business-profile/`)
```
Commerce ──1:1──> BusinessProfile
   hours (JSON): [{day, open, close, isHoliday}]
   socialLinks (JSON): {instagram, facebook, whatsapp, website}
   certifications (string[])
   bio (text)
   coverage (text) — área de cobertura/entrega
   policies (JSON): {returns, shipping, warranty, payment}
```
- CRUD endpoints (solo OWNER/MANAGER del commerce)
- Public endpoint para display en catálogo
- Validación de horarios (no overlapp, formato correcto)

**2. Onboarding module** (`src/onboarding/`)
```
User ──1:1──> OnboardingProgress
   wizardStep (int)
   completedSteps (string[])
   templateUsed (string | null)
   isComplete (boolean)
   startedAt, completedAt
```
- `POST /onboarding/start` — Inicia wizard, asigna template
- `PATCH /onboarding/step` — Avanza paso
- `GET /onboarding/progress` — Estado actual
- `POST /onboarding/complete` — Marca completado

**3. Reviews module** (`src/reviews/`)
```
Commerce ──1:N──> Review
   catalogItemId (FK, nullable — reseña a producto)
   customerId (FK -> User or anonymous)
   rating (int 1-5)
   comment (text)
   reply (text, nullable — respuesta del comercio)
   status: PENDING | APPROVED | REJECTED
```
- `POST /reviews` — Cliente crea reseña (autenticado o anónimo con rate-limit)
- `GET /public/commerce/:commerceId/reviews` — Reseñas públicas
- `PATCH /reviews/:id/reply` — Comercio responde
- `GET /commerce/:commerceId/reviews` — Dashboard (con filtros, moderación)

#### 🟡 Fase 2 — Operación profesional (corto plazo)

**4. CRM module** (`src/crm/`)
```
Commerce ──1:N──> Customer
   userId (nullable, FK)
   email, phone, name
   totalOrders, totalSpent, lastPurchaseAt
   notes (JSON array)
   segment (string): VIP | REGULAR | NEW | INACTIVE
```
- `GET /commerce/:commerceId/customers` — Lista con filtros
- `GET /commerce/:commerceId/customers/:id` — Detalle con historial
- `PATCH /commerce/:commerceId/customers/:id/notes` — Notas internas

**5. BI/Analytics** (`src/analytics/`)
- `GET /commerce/:commerceId/analytics/sales` — Ventas por período
- `GET /commerce/:commerceId/analytics/top-products` — Top N productos
- `GET /commerce/:commerceId/analytics/orders-by-hour` — Horarios pico
- `GET /commerce/:commerceId/analytics/summary` — Resumen dashboard

**6. Invoicing module** (`src/invoicing/`)
- Entity `Invoice` con datos fiscales (taxId, CUIT/RUT/RFC según país)
- `POST /orders/:id/invoice` — Generar comprobante
- `GET /commerce/:commerceId/invoices` — Lista histórica
- `GET /invoices/:id/pdf` — Descargar PDF

### Prerrequisitos técnicos bloqueantes

```
┌──────────────────────────────────────────────┐
│  PRERREQUISITO CRÍTICO para TODAS las fases  │
│                                              │
│  Completar migración: ownerId → commerceId   │
│  en TODOS los servicios y endpoints.         │
│  Sin esto, MANAGER no puede operar, y        │
│  cualquier feature nueva se filtra mal.      │
└──────────────────────────────────────────────┘
```

### Impacto Cross-Project (backend específico)

| Feature | Entidades nuevas | Endpoints | DTOs |
|---------|-----------------|-----------|------|
| BusinessProfile | business_profile (1) | 6 (CRUD + public) | 4 |
| Onboarding | onboarding_progress (1) | 4 | 3 |
| Reseñas | reviews, review_reports (2) | 8 (submit, list, reply, moderate, report) | 6 |
| CRM | customers, customer_notes (2) | 5 | 4 |
| BI | analytics_cache (1) | 4 | 3 |
| Facturación | invoices, invoice_items (2) | 5 + PDF generation | 4 |

---

## Archivos Clave para Referencia

| Archivo | Propósito |
|---------|-----------|
| `src/commerce/entities/commerce.entity.ts` | Entidad tenant principal |
| `src/auth/models/permissions.model.ts` | Matriz permisos por rol/contexto |
| `src/auth/guards/permissions.guard.ts` | Guard de permisos |
| `src/auth/interceptors/tenant.interceptor.ts` | Resolución de tenant |
| `src/auth/services/tenant-resolution.service.ts` | Lógica de resolución |
| `src/auth/jwt.strategy.ts` | Payload JWT (commerceId incluido) |
| `src/membership/` | Sistema de membresías y suscripciones |
| `src/payments/` | Integración MercadoPago |
| `src/orders/` | Órdenes y desglose financiero |
| `src/catalog/` | Catálogos e items |

---

## Testing

```bash
npm run test          # Tests unitarios
npm run test:e2e      # Tests end-to-end
```

- Tests en `test/` con Jest + Supertest
- Al crear features nuevas (BusinessProfile, Reviews, etc.), crear tests E2E por endpoint
- Mockear `UserRoleService` para tests de permisos

---

## Documentación Relacionada

- `docs/MISSION-ALIGNMENT.md` — Análisis completo de misión (cross-project)
- `docs/MULTITENANT-STRATEGY.md` — Estrategia multi-tenant
- `docs/ROLES-SYSTEM-UPDATE-2026.md` — Sistema de roles
- `GUIA_COMERCIAL.md` — Guía comercial
- `ARCHITECTURE.md` — Arquitectura general
- `MEMBERSHIP-MERCADOPAGO-INTEGRATION.md` — Membresías MP
