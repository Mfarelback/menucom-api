# Membership API

API para gestión de membresías y suscripciones en Menucom.

## Endpoints (Usuario)

| Método | Endpoint | Descripción | Auth |
|--------|---------|-----------|------|
| GET | `/membership` | Obtiene membresía actual del usuario | ✅ |
| POST | `/membership/subscribe` | Suscribe a un plan | ✅ |
| PUT | `/membership` | Actualiza membresía | ✅ |
| DELETE | `/membership` | Cancela y downgrada a FREE | ✅ |
| GET | `/membership/plans` | Planes estándar disponibles | ❌ |
| GET | `/membership/custom-plans` | Planes personalizados | ❌ |
| GET | `/membership/status` | Estado detallado de suscripción | ✅ |
| DELETE | `/membership/subscription` | Cancela suscripción activa | ✅ |

---

## Endpoints (Admin)

Requiere permiso `MANAGE_USERS` en contexto `GENERAL`.

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/admin/memberships` | Lista membresías (paginación + filtros) |
| GET | `/admin/memberships/stats` | Estadísticas generales |
| GET | `/admin/memberships/:id` | Membresía por ID |
| GET | `/admin/memberships/user/:userId` | Membresía por usuario |
| PUT | `/admin/memberships/:id` | Actualiza membresía |
| GET | `/admin/memberships/:id/audit` | Historial de auditoría |
| GET | `/admin/memberships/user/:userId/audit` | Auditoría por usuario |
| POST | `/admin/memberships/user/:userId/assign/:plan` | Asigna plan a usuario |
| GET | `/admin/memberships/plans` | Todos los planes (std + custom) |
| GET | `/admin/memberships/plans/custom` | Planes personalizados |
| POST | `/admin/memberships/plans/custom` | Crea plan personalizado |
| GET | `/admin/memberships/plans/custom/:id` | Plan por ID |
| PUT | `/admin/memberships/plans/custom/:id` | Actualiza plan |
| DELETE | `/admin/memberships/plans/custom/:id` | Archiva/Desactiva plan |
| GET | `/admin/memberships/plans/custom/:id/usage` | Uso del plan |

---

## GET /membership

Obtiene la membresía actual del usuario. Si no tiene, se le asigna FREE automáticamente.

**Respuesta:**
```json
{
  "id": "uuid",
  "plan": "free",
  "features": ["basic_menu_management"],
  "isActive": true,
  "expiresAt": null,
  "remainingDays": -1,
  "isExpired": false
}
```

---

## POST /membership/subscribe

Suscribe al usuario a un plan con tarjeta. Flujo completo con Mercado Pago.

**Body:**
```json
{
  "plan": "premium",
  "cardTokenId": "tok_xxx"
}
```

**Respuesta:**
```json
{
  "subscriptionId": "preapproval_xxx",
  "status": "pending",
  "initPoint": "https://www.mercadopago.com/...",
  "amount": 1500,
  "currency": "ARS",
  "membership": {
    "id": "uuid",
    "plan": "premium",
    "isActive": true
  }
}
```

---

## PUT /membership

Actualiza la membresía.

**Body:**
```json
{
  "plan": "enterprise"
}
```

---

## DELETE /membership

Cancela la membresía y la downgrada a FREE.

---

## GET /membership/plans

Planes estándar disponibles. Público.

**Respuesta:**
```json
{
  "plans": [
    {
      "name": "free",
      "price": 0,
      "features": ["Basic menu management", "Up to 10 items"]
    },
    {
      "name": "premium",
      "price": 1500,
      "features": ["Advanced analytics", "Custom branding"]
    },
    {
      "name": "enterprise",
      "price": 5000,
      "features": ["Unlimited", "API access", "White label"]
    }
  ],
  "currency": "ARS"
}
```

---

## GET /membership/custom-plans

Planes personalizados creados por admins. Público.

---

## GET /membership/status

Estado detallado de la suscripción activa.

**Respuesta:**
```json
{
  "isActive": true,
  "plan": "premium",
  "status": "authorized",
  "amount": 1500,
  "currency": "ARS",
  "nextBillingDate": "2026-05-01",
  "lastPaymentAt": "2026-04-01",
  "paymentMethodId": "xxx"
}
```

---

## DELETE /membership/subscription

Cancela la suscripción activa de Mercado Pago.

**Respuesta:**
```json
{
  "success": true,
  "message": "Subscription cancelled successfully",
  "cancelledAt": "2026-04-24T12:00:00Z"
}
```

---

## Planes

### FREE
- Basic menu management
- Up to 10 items
- 1 wardrobe
- 10 clothing items
- 7 days analytics

### PREMIUM
- Advanced analytics
- Custom branding
- Up to 500 menu items
- 5 wardrobes
- Priority support

### ENTERPRISE
- Unlimited menu items
- Unlimited wardrobes
- API access
- White label
- Dedicated support

---

## Admin Endpoints

### GET /admin/memberships

Lista membresías con filtros y paginación.

**Query Parameters:**
| Param | Tipo | Descripción |
|-------|------|------------|
| `search` | string | Busca por email, nombre o userId |
| `plan` | enum | `free`, `premium`, `enterprise` |
| `status` | enum | `active`, `pending`, `expired`, `cancelled`, `trialing` |
| `page` | number | Página (default: 1) |
| `limit` | number | Items por página (default: 20, max: 100) |
| `sortBy` | enum | `createdAt`, `updatedAt`, `plan`, `expiresAt`, `amount` |
| `sortOrder` | enum | `ASC`, `DESC` |

**Respuesta:**
```json
{
  "data": [
    {
      "id": "uuid",
      "userId": "uuid",
      "plan": "premium",
      "isActive": true,
      "expiresAt": "2026-05-01",
      "remainingDays": 7,
      "isExpired": false,
      "subscriptionStatus": "authorized",
      "amount": 1500,
      "user": { "id": "uuid", "email": "user@example.com", "name": "John" }
    }
  ],
  "total": 150,
  "page": 1,
  "limit": 20,
  "totalPages": 8
}
```

---

### GET /admin/memberships/stats

Estadísticas generales.

**Respuesta:**
```json
{
  "byPlan": [
    { "plan": "free", "count": 100 },
    { "plan": "premium", "count": 30 },
    { "plan": "enterprise", "count": 20 }
  ],
  "active": 50,
  "expired": 10,
  "total": 150,
  "byStatus": { "active": 50, "pending": 5, "cancelled": 85, "expired": 10 },
  "revenue": { "monthly": 85000, "yearly": 1020000, "projected": 918000 }
}
```

---

### GET /admin/memberships/plans

Todos los planes disponibles (estándar + personalizados).

**Respuesta:**
```json
{
  "standardPlans": [
    { "name": "free", "price": 0, "features": [...], "limits": {...} },
    { "name": "premium", "price": 1500, "features": [...], "limits": {...} },
    { "name": "enterprise", "price": 5000, "features": [...], "limits": {...} }
  ],
  "customPlans": [...]
}
```

---

### POST /admin/memberships/user/:userId/assign/:plan

Asigna un plan directamente (sin pago).

**Ejemplo:** `POST /admin/memberships/user/abc123/assign/premium`

**Respuesta:**
```json
{
  "id": "uuid",
  "userId": "abc123",
  "plan": "premium",
  "features": ["basic_menu", "advanced_analytics", ...],
  "isActive": true
}
```

**Validación:** Plan debe ser `free`, `premium` o `enterprise`.

---

### POST /admin/memberships/plans/custom

Crea plan personalizado.

**Body:**
```json
{
  "name": "startup",
  "displayName": "Startup",
  "description": "Para startups en crecimiento",
  "price": 2500,
  "currency": "ARS",
  "billingCycle": "monthly",
  "features": ["basic_menu", "advanced_analytics", "custom_branding"],
  "limits": {
    "maxCatalogs": 5,
    "maxCatalogItems": 1000,
    "maxLocations": 5,
    "analyticsRetention": 180
  },
  "metadata": { "color": "#4F46E5", "popular": false }
}
```

---

### DELETE /admin/memberships/plans/custom/:id

Archiva o desactiva un plan.

- Si tiene suscripciones activas → estado cambia a `inactive`
- Si no tiene → estado cambia a `archived`

---

### GET /admin/memberships/plans/custom/:id/usage

Estadísticas de uso del plan.

**Respuesta:**
```json
{
  "plan": { "id": "uuid", "name": "startup", "displayName": "Startup", "price": 2500 },
  "activeSubscriptions": 25,
  "totalRevenue": 62500
}
```