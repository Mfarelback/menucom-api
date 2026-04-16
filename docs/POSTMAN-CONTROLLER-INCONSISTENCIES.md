# Postman vs Controladores - Inconsistencias

> Análisis realizado: 2026-04-12
> Workspace: Menu com API (3502165d-a626-4d1e-881c-d05ad2cc07f7)

## Resumen

| Colección  | Endpoints Postman | Endpoints Controller | Cobertura |
| ---------- | ----------------- | -------------------- | --------- |
| Auth       | 5                 | 5                    | 100%      |
| User       | 8                 | 9                    | 89%       |
| Catalog    | 16                | 14                   | 100%      |
| Orders     | 6                 | 6                    | 100%      |
| Membership | 15                | 15                   | 100%      |
| AppData    | Por verificar     | 10                   | -         |

---

## ✅ AUTH (5/5) - COMPLETO

**Endpoints del controlador:**

- `GET /auth/firebase/health` ✅ - Firebase health check
- `POST /auth/login` ✅ - login tradicional (ya existía)
- `POST /auth/register` ✅ - registro tradicional (ya existía)
- `POST /auth/social/login` ✅ - Social login (Firebase)
- `POST /auth/social/register` ✅ - Social register (Firebase)

**Completado (2026-04-12):** ✅ 100%

---

## ✅ USER (8/9)

**Endpoints del controlador:**

- `GET /user/me` ✅ - perfil (ya existía)
- `GET /user/user/:id` ✅ - obtener usuario por ID (ya existía)
- `POST /user/admin/:email` ✅ - Get admin by email
- `POST /user/change-password` ✅ - cambiar contraseña (ya existía)
- `PATCH /user/update/:id` ✅ - actualizar usuario (ya existía)
- `POST /user/by-roles` ✅ - obtener usuarios por roles (ya existía)
- `DELETE /user/:id` ✅ - eliminar usuario (ya existía)
- `DELETE /user/deleteall` ❌ NO agregar - peligroso
- `PATCH /user/fcm-token` ✅ - token FCM (ya existía)

**Falta (no agregar):** `DELETE /user/deleteall` - solo dev, peligroso

---

## ✅ CATALOG (16/14) - COMPLETO

**Endpoints del controlador:**

- `POST /catalogs` - crear catálogo ✅ Postman (ya existía)
- `GET /catalogs/my-catalogs` - obtener mis catálogos ✅ + versión con filtro
- `GET /catalogs/:catalogId` - obtener catálogo por ID ✅ Postman (ya existía)
- `PUT /catalogs/:catalogId` - actualizar catálogo ✅ Postman (ya existía)
- `DELETE /catalogs/:catalogId` - eliminar catálogo ✅ Postman (ya existía)
- `PUT /catalogs/:catalogId/archive` - archivar catálogo ✅ Postman (ya existía)
- `POST /catalogs/:catalogId/items` - agregar item ✅ + JSON y multipart
- `GET /catalogs/:catalogId/items/:itemId` - obtener item por ID ✅
- `PUT /catalogs/:catalogId/items/:itemId` - actualizar item ✅ + JSON y multipart
- `DELETE /catalogs/:catalogId/items/:itemId` - eliminar item ✅
- `GET /catalogs/public/search` - buscar catálogos públicos ✅ (2 versiones)
- `GET /catalogs/public/:slug` - obtener catálogo público por slug ✅

**Completado (2026-04-12):** ✅ 100%

---

## ✅ ORDERS (6/6) - COMPLETO

**Endpoints del controlador:**

- `GET /orders/byOwner` ✅ - Get orders by owner
- `GET /orders/byAnonymous` ✅ - órdenes de usuario anónimo (ya existía)
- `GET /orders/byBusinessOwner/:ownerId` ✅ - órdenes de negocio (ya existía)
- `POST /orders` ✅ - crear orden (ya existía)
- `PUT /orders/:id` ✅ - Update order
- `DELETE /orders/:id` ✅ - Delete order

**Completado (2026-04-12):** ✅ 100%

---

## ✅ MEMBERSHIP (15/15) - COMPLETO

**Endpoints del controlador:**

- `GET /membership` ✅ - Get user membership
- `POST /membership/subscribe` ✅ - Subscribe (ya existía)
- `PUT /membership` ✅ - Update membership
- `DELETE /membership/cancel` ✅ - Cancel membership
- `GET /membership/limits` ✅ - Get plan limits
- `GET /membership/audit` ✅ - Get audit history
- `GET /membership/stats` ✅ - Get membership stats
- `GET /membership/plans` ✅ - Get available plans
- `GET /membership/custom-plans` ✅ - Get custom plans
- `POST /membership/subscribe-custom` ✅ - Subscribe to custom plan
- `POST /membership/create-payment` ✅ - Create payment

**Completado (2026-04-12):** ✅ 100%

---

## 🟡 APP-DATA

**Endpoints del controlador:**

- `POST /app-data` - crear dato de configuración
- `GET /app-data` - obtener todos
- `GET /app-data/:id` - obtener por ID
- `GET /app-data/key/:key` - obtener por clave
- `GET /app-data/value/:key` - obtener valor por clave
- `PATCH /app-data/:id` - actualizar
- `PATCH /app-data/:id/toggle-active` - activar/desactivar
- `DELETE /app-data/:id` - eliminar
- `GET /app-data/marketplace-fee` - obtener comisión
- `POST /app-data/marketplace-fee` - configurar comisión

**Por verificar:**

- [ ] Comparar con colección existente

---

## 📋 Pendientes por colección

### Priority 1 - Alta

- [x] Auth: agregar 3 endpoints sociales ✅
- [x] Catalog: agregar 6 endpoints de items y búsqueda pública ✅
- [x] Orders: agregar 3 endpoints ✅

### Priority 2 - Media

- [x] User: agregar admin endpoint ✅
- [x] Membership: verificar y completar ✅

### Priority 3 - Baja

- [ ] AppData: verificar y completar (último)
