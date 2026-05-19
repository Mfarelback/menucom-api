# Análisis de Seguridad — Proceso de Compra de Tickets

> **Proyecto:** Menucom API (NestJS + PostgreSQL + MercadoPago)
> **Fecha:** Mayo 2026

---

## Índice

1. [Arquitectura del Flujo](#1-arquitectura-del-flujo)
2. [Medidas de Seguridad Existentes](#2-medidas-de-seguridad-existentes)
3. [Hallazgos Críticos](#3-hallazgos-críticos)
4. [Hallazgos Altos](#4-hallazgos-altos)
5. [Hallazgos Medios](#5-hallazgos-medios)
6. [Hallazgos Bajos](#6-hallazgos-bajos)
7. [Resumen de Riesgos](#7-resumen-de-riesgos)
8. [Recomendaciones Priorizadas](#8-recomendaciones-priorizadas)

---

## 1. Arquitectura del Flujo

```
Cliente                    Menucom API                    MercadoPago
   │                           │                              │
   │  POST /tickets/checkout   │                              │
   │─────────────────────────► │  Valida stock + crea         │
   │                           │  TicketPurchase (PENDING)    │
   │                           │  Reserva inventario          │
   │                           │  Crea MP Preference          │
   │◄───────────────────────── │  Devuelve initPoint          │
   │                           │                              │
   │  (Redirige a MP)          │                              │
   │──────────────────────────────────────────────────────►   │
   │                           │                              │
   │                           │  POST /webhooks/tickets      │
   │                           │◄─────────────────────────────│
   │                           │  Valida firma HMAC           │
   │                           │  Procesa orden               │
   │                           │  Genera tickets + QR         │
   │                           │  Actualiza estado            │
   │                           │                              │
   │  GET /tickets/:id/pdf     │                              │
   │─────────────────────────► │  Devuelve PDF (sin auth)     │
   │◄───────────────────────── │                              │
```

### Endpoints involucrados

| Endpoint | Método | Auth | Propósito |
|----------|--------|------|-----------|
| `/tickets/checkout` | POST | ❌ Público | Inicia compra, crea preferencia MP |
| `/tickets/purchase` | POST | ❌ Público | Genera tickets **sin pago** |
| `/tickets/:id/pdf` | GET | ❌ Público | Descarga PDF del ticket |
| `/webhooks/tickets` | POST | ❌ Público | Webhook MP (firma HMAC) |
| `/payments/webhooks` | POST | ❌ Público | Webhook MP alterno |
| `/tickets/validate/:code` | POST | ✅ JWT | Valida y usa ticket |
| `/tickets/validate` | POST | ✅ JWT + Perms | Validación online/offline |

### Modelos de datos principales

- **`ticket_types`**: `id`, `event_id`, `price`, `totalQuantity`, `soldQuantity`, `maxPerUser`, `@Check("soldQuantity" <= "totalQuantity")`
- **`ticket_purchases`**: `id`, `tenantId`, `buyer_id`, `event_id`, `ticket_type_id`, `totalAmount`, `quantity`, `paymentStatus` (PENDING | COMPLETED | FAILED | REFUNDED)
- **`tickets`**: `id`, `purchase_id`, `qrCode` (HMAC firmado), `ownerName`, `ownerEmail`, `status`, `validatedBy`
- **`payment_intents`**: `id`, `transaction_id` (MP preference ID), `state`, `amount`

---

## 2. Medidas de Seguridad Existentes

### ✅ Autenticación y Autorización
- **JWT** con Passport Strategy para proteger endpoints operativos
- **PermissionsGuard** con permisos finos (`VALIDATE_TICKETS`, `MANAGE_TICKETS`)
- **@InBusinessContext** para aislar por contexto de negocio (EVENTS)
- **Multi-tenancy** vía `tenantId` en eventos y compras

### ✅ Integridad de Datos
- **Firma HMAC SHA-256** en códigos QR anti-falsificación
- **Comparación timing-safe** (`crypto.timingSafeEqual`) en verificación QR
- **@Check** constraint en DB: `soldQuantity <= totalQuantity`
- **Pessimistic Write Lock** en operaciones de stock para evitar over-selling
- **Transacciones** en TypeORM para operaciones críticas

### ✅ Webhooks
- **Validación de firma HMAC** en headers `x-signature` y `x-request-id`
- Verificación de `external_reference` con prefijo `TICKET_`
- Filtro por tipo de evento (`type === 'order'`)

### ✅ Protección General
- **ValidationPipe** global con `whitelist: true` y `transform: true`
- **GlobalExceptionFilter** que sanitiza campos sensibles en errores
- **Soporte de validación offline** con JWT en QR para eventos sin conectividad
- **Expiración de QR** a 7 días

---

## 3. Hallazgos Críticos

### 🔴 C-01: Endpoint `/tickets/purchase` sin autenticación ni pago

**Endpoint:** `POST /tickets/purchase`
**Archivo:** `src/events/controllers/tickets.controller.ts`
**Riesgo:** Cualquier persona puede generar tickets válidos directamente sin pagar, llamando a este endpoint con un `ticketTypeId` y `quantity`. By-passea completamente MercadoPago.

**Impacto:** Pérdida total de ingresos. Un atacante puede generar miles de tickets gratuitos para cualquier evento.

**Solución:** Requerir JWT + verificar que el usuario tenga permisos de organización del evento, o eliminar el endpoint si no se usa.

---

### 🔴 C-02: Endpoint `/tickets/checkout` público sin rate limiting

**Endpoint:** `POST /tickets/checkout`
**Archivo:** `src/events/controllers/tickets.controller.ts`
**Riesgo:** Sin autenticación ni rate limiting, un atacante puede:
- Agotar el inventario reservando tickets (soldQuantity se incrementa)
- Generar cientos de preferencias de pago huérfanas en MercadoPago
- Causar denegación de servicio económica (costos de transacción MP)

**Impacto:** Eventos pueden mostrar "Sold Out" falsamente. Costos operativos elevados.

**Solución:** Rate limiting por IP, CAPTCHA, o requerir autenticación mínima (ej. cuenta gratuita).

---

### 🔴 C-03: Endpoint `/tickets/:id/pdf` público — sin verificación de propiedad

**Endpoint:** `GET /tickets/:id/pdf`
**Archivo:** `src/events/controllers/tickets.controller.ts`
**Riesgo:** Cualquier persona con un UUID de ticket puede descargar el PDF. Aunque los UUID son difíciles de adivinar, pueden ser:
- Filtrados en logs del servidor
- Expuestos en referers HTTP
- Obtenidos de captures de pantalla

**Impacto:** Falsificación de tickets para ingreso a eventos, violación de privacidad (nombre/email del comprador expuestos).

**Solución:** Requerir autenticación y verificar que el usuario sea el comprador o un organizador del evento.

---

### 🔴 C-04: Ausencia total de rate limiting

**Archivos:** `src/app.module.ts`, `package.json`
**Riesgo:** No existe `@nestjs/throttler`, `express-rate-limit`, ni ningún middleware de rate limiting. Todos los endpoints públicos son vulnerables a:
- Fuerza bruta en endpoints de autenticación
- Denegación de servicio
- Inventory exhaustion attacks
- Webhook replay abuse

**Impacto:** Ataques automatizados sin restricción.

**Solución:** Implementar `@nestjs/throttler` con límites conservadores en endpoints públicos y más restrictivos en checkout/purchase.

---

### 🔴 C-05: Idempotencia no implementada en webhooks

**Archivos:**
- `src/payments/controller/payments.controller.ts` — `x-idempotency-key` se loguea pero no se usa
- `src/events/controllers/tickets-webhook.controller.ts` — chequea `paymentStatus !== PENDING` pero no hay clave de idempotencia

**Riesgo:** MercadoPago puede reenviar webhooks (especialmente en caso de timeout o error de red). Sin idempotencia:
- Una orden `COMPLETED` podría procesarse múltiples veces
- Múltiples generaciones de tickets para una misma compra
- Doble contabilidad en reportes financieros

**Solución:** Implementar almacén de idempotencia (Redis o tabla en DB) con TTL de 24h para `x-idempotency-key`.

---

### 🔴 C-06: `synchronize: true` activo en producción

**Archivo:** `src/database/database.module.ts`
**Código:** `synchronize: process.env.DB_SYNC === 'true'`
**Riesgo:** Si `DB_SYNC=true` en producción (por error de configuración o variable de entorno), TypeORM alterará el esquema automáticamente. Esto puede:
- Eliminar columnas con datos
- Cambiar tipos de datos
- Borrar constraints incluyendo `@Check("soldQuantity" <= "totalQuantity")`
- Causar downtime completo

**Solución:** Forzar `synchronize: false` en producción. Usar migraciones formales.

---

## 4. Hallazgos Altos

### 🟠 A-01: `binary_mode` deshabilitado en preferencias MP

**Archivo:** `src/payments/services/mercado_pago.service.ts`
**Riesgo:** Sin `binary_mode`, los pagos pueden quedar en estado `in_process` (pendiente de aprobación). El inventario queda reservado (soldQuantity incrementado) pero el ticket no se genera. No hay expiración automática.

**Escenario:** Atacante inicia 100 checkouts sin completar el pago → se reservan 100 tickets → compradores legítimos ven "Sold Out".

**Solución:** Habilitar `binary_mode: true` o implementar un cron job que libere reservas PENDING con más de N minutos de antigüedad.

---

### 🟠 A-02: Sin limpieza de reservas expiradas (PENDING)

**Archivo:** `src/events/services/tickets.service.ts`
**Riesgo:** No existe un proceso programado (cron) que libere tickets en estado PENDING que nunca se completaron. Las reservas huérfanas se acumulan permanentemente.

**Solución:** Implementar cron job (puede ser `@nestjs/schedule`) que periódicamente encuentre purchases PENDING con más de 30 minutos y:
1. Libere el stock (decrementar `soldQuantity`)
2. Marque como FAILED
3. Notifique si aplica

---

### 🟠 A-03: Validación de firma webhook se salta si falta `MP_WEBHOOK_SECRET`

**Archivo:** `src/payments/services/payment-webhook.service.ts:64-68`
**Código:**
```typescript
if (!this.webhookSecret) {
  this.logger.warn('MP_WEBHOOK_SECRET not configured — skipping signature validation');
  return true;
}
```
**Riesgo:** Si la variable de entorno `MP_WEBHOOK_SECRET` no está configurada (por error de deploy, entorno nuevo, etc.), **cualquier POST a `/webhooks/tickets` o `/payments/webhooks` será aceptado sin verificación de firma**. Un atacante podría falsificar notificaciones de pago para obtener tickets gratis.

**Solución:**
- Validar al iniciar la app que `MP_WEBHOOK_SECRET` esté configurado; si no, lanzar error fatal
- O agregar IP whitelist de MercadoPago como respaldo

---

### 🟠 A-04: `TICKET_QR_SECRET` con default inseguro

**Archivo:** `src/events/services/qrcode-secure.service.ts`
**Código:**
```typescript
private secretKey = process.env.TICKET_QR_SECRET || 'default-secret-change-in-production';
```
**Riesgo:** Si `TICKET_QR_SECRET` no está configurado en producción, todos los QR se firman con `'default-secret-change-in-production'`. Cualquier persona que conozca este secreto (público en código fuente) puede generar QR válidos falsos.

**Solución:** Validar al startup que `TICKET_QR_SECRET` esté configurado y sea diferente del default. Lanzar error si no.

---

### 🟠 A-05: Sin validación de `maxPerUser` en checkout

**Archivo:** `src/events/dto/event.dto.ts` (CreatePurchaseDto)
**Riesgo:** El DTO de compra acepta cualquier `quantity` sin validar contra `ticketType.maxPerUser`. Un atacante puede comprar 1000 tickets en una sola transacción aunque `maxPerUser = 10`.

**Solución:** Agregar validación en `EventPaymentService.createTicketPreference()` o en el DTO con `@Validate` personalizado.

---

### 🟠 A-06: Sin verificación de tenantId en compra

**Archivo:** `src/events/controllers/tickets.controller.ts`
**Riesgo:** El `tenantId` se recibe del body de la solicitud sin verificar que el usuario tenga acceso a ese tenant. En el endpoint público `/tickets/checkout`, un atacante puede manipular `tenantId` para:
- Comprar tickets de eventos de otros tenants
- Cruzar datos entre organizaciones

**Solución:** Derivar `tenantId` del evento (obtenido de DB) en lugar del body, o validar que el `tenantId` corresponda al evento solicitado.

---

## 5. Hallazgos Medios

### 🟡 M-01: Sin límites de tamaño en request body

**Riesgo:** Los endpoints públicos aceptan payloads sin límite de tamaño (`body-parser` default sin `limit`). Un atacante puede enviar payloads de varios megabytes para consumir memoria y CPU.

**Solución:** Configurar `bodyParser: { limit: '1mb' }` en `main.ts`.

---

### 🟡 M-02: CORS abierto sin restricciones

**Archivo:** `src/main.ts`
**Código:** `app.enableCors()`
**Riesgo:** Cualquier origen web puede hacer requests a la API desde el navegador de un usuario. Esto no es crítico porque no hay cookies de sesión (solo JWT en header), pero permite:
- Scanners de origen cruzado
- CSRF en endpoints públicos

**Solución:** Configurar `origin` con lista blanca de dominios conocidos.

---

### 🟡 M-03: WebSocket gateway sin restricción de origen

**Archivo:** `src/ws/payments.gateway.ts`
**Código:** `cors: { origin: true }`
**Riesgo:** Conexiones WebSocket desde cualquier origen. Posible exfiltración de datos o suscripción no autorizada a eventos de pago.

**Solución:** Limitar a orígenes conocidos o requerir autenticación JWT en el handshake.

---

### 🟡 M-04: Sin helmet / security headers

**Riesgo:** La API no envía cabeceras de seguridad HTTP como:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Strict-Transport-Security`
- `X-XSS-Protection`

**Solución:** Agregar `app.use(helmet())` en `main.ts`.

---

### 🟡 M-05: Swagger `/docs` expuesto sin autenticación

**Riesgo:** La documentación de Swagger está públicamente accesible, exponiendo:
- Todos los endpoints y sus parámetros
- Esquemas de datos completos
- Ejemplos de requests

Esto facilita el reconocimiento para atacantes.

**Solución:** Proteger `/docs` con autenticación básica o deshabilitarlo en producción.

---

### 🟡 M-06: Validación offline sin revocación

**Archivo:** `src/events/services/ticket-validation.service.ts`
**Riesgo:** Los JWT de validación offline no tienen mecanismo de revocación. Una vez generados, son válidos hasta su expiración (7 días). Si un ticket se cancela o reembolsa, el JWT offline sigue siendo válido.

**Solución:** Implementar lista negra de JWT (Redis o DB) o reducir ventana de expiración offline.

---

### 🟡 M-07: `console.log`/`console.error` en lugar de logger estructurado

**Archivos:** Varios servicios
**Riesgo:** Mensajes de log sin formato estructurado, imposibles de agregar/correlacionar en producción. En particular, `console.error` puede exponer trazas de error completas.

**Solución:** Usar el Logger de NestJS (`@nestjs/common`) consistentemente.

---

### 🟡 M-08: `x-anonymous-id` completamente auto-assertado

**Archivo:** `src/orders/controllers/orders.controller.ts`
**Riesgo:** La identidad anónima se toma directamente del header sin validación. Un usuario puede suplantar a otro simplemente cambiando el header.

**Solución:** Firmar el `x-anonymous-id` con HMAC o usar un token generado por el servidor.

---

## 6. Hallazgos Bajos

### 🔵 B-01: Archivo `.env` de desarrollo Commiteado

**Archivo:** `DESKTOP-AQ5AGA6.env` en la raíz
**Riesgo:** Potencial exposición de credenciales de desarrollo si el repositorio es público.

**Solución:** Agregar a `.gitignore` y rotar cualquier secreto expuesto.

---

### 🔵 B-02: `role: payload.username` en JWT Strategy

**Archivo:** `src/auth/guards/jwt.strategy.ts:26`
**Riesgo:** Parece un bug de mapeo (username asignado a role). No es crítico porque PermissionsGuard usa otro mecanismo, pero puede causar confusiones en autorización.

**Solución:** Revisar el mapeo de claims JWT.

---

### 🔵 B-03: Validación offline acepta `any` en payload

**Archivo:** `src/events/services/ticket-validation.service.ts`
**Riesgo:** El payload del JWT offline no tiene tipos estrictos, permitiendo manipulación potencial de campos no esperados.

**Solución:** Definir interfaz estricta y validar payload con class-validator o zod.

---

## 7. Resumen de Riesgos

| Categoría | Nivel | Cantidad |
|-----------|-------|----------|
| Crítico | 🔴 | 6 |
| Alto | 🟠 | 6 |
| Medio | 🟡 | 8 |
| Bajo | 🔵 | 3 |
| **Total** | | **23** |

### Matriz de Impacto

```
Impacto:  Catastrófico   ● ● ○ ○ ○ ○  (C-01, C-02, C-03)
          Alto           ○ ○ ● ● ○ ○  (C-04, C-05, C-06, A-01..A-06)
          Moderado       ○ ○ ○ ○ ● ○  (M-01..M-08)
          Bajo           ○ ○ ○ ○ ○ ●  (B-01..B-03)
                         Fácil  ──►  Difícil
                           Explotabilidad
```

---

## 8. Recomendaciones Priorizadas

### Inmediatas (Semana 1)

| # | Acción | Hallazgo | Esfuerzo |
|---|--------|----------|----------|
| 1 | **Proteger o eliminar** `POST /tickets/purchase` | C-01 | 1h |
| 2 | **Agregar rate limiting** (`@nestjs/throttler`) | C-04 | 2h |
| 3 | **Proteger** `GET /tickets/:id/pdf` con JWT y verificación de propiedad | C-03 | 2h |
| 4 | **Forzar `synchronize: false`** en producción + migraciones | C-06 | 1h |
| 5 | **Validar presencia de secrets** al startup (`MP_WEBHOOK_SECRET`, `TICKET_QR_SECRET`) | A-03, A-04 | 1h |

### Corto Plazo (Semana 2-3)

| # | Acción | Hallazgo | Esfuerzo |
|---|--------|----------|----------|
| 6 | **Idempotencia en webhooks** con Redis o tabla DB | C-05 | 4h |
| 7 | **Cron job de limpieza** de reservas PENDING expiradas | A-02 | 3h |
| 8 | **Validar `maxPerUser`** en checkout | A-05 | 1h |
| 9 | **Limitar tamaño de body** y habilitar helmet | M-01, M-04 | 1h |
| 10 | **Restringir CORS** | M-02 | 1h |

### Mediano Plazo (Mes 1-2)

| # | Acción | Hallazgo | Esfuerzo |
|---|--------|----------|----------|
| 11 | **Evaluar `binary_mode`** en MP o implementar manejo de `in_process` | A-01 | 4h |
| 12 | **Validar tenantId** desde DB en lugar del body | A-06 | 2h |
| 13 | **Proteger Swagger** `/docs` | M-05 | 1h |
| 14 | **Implementar revocación de JWT offline** | M-06 | 4h |
| 15 | **Migrar console.log a Logger estructurado** | M-07 | 3h |
| 16 | **Restringir WebSocket** por origen y/o JWT | M-03 | 2h |

---

*Documento generado a partir del análisis estático del código fuente. Se recomienda complementar con pruebas de penetración dinámicas y revisión de dependencias (`npm audit`).*
