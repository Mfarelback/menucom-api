# Documentación Técnica: Eventos y Tickets - Menucom API

> **Referencia cruzada**: Este documento expande y complementa el análisis inicial en [[analysis/EVENTS_TICKETS_ANALYSIS]]. Ambos documentos deben leerse en conjunto para una visión completa del sistema.

---

## Índice
1. [Resumen Ejecutivo](#resumen-ejecutivo)
2. [Estado Actual de la Plataforma](#estado-actual)
3. [Nuevas Entidades Requeridas](#nuevas-entidades)
4. [Integración con MercadoPago: Webhooks](#webhooks-mercadopago)
5. [Lo que Falta: Análisis de Brechas Críticas](#brechas-criticas)
6. [Plan de Implementación Técnica](#plan-implementacion)
7. [Referencias](#referencias)

---

## Resumen Ejecutivo

Menucom API es una plataforma NestJS multi-tenant sólidamente establecida que requiere expansión para soportar **organizadores de eventos y venta de tickets**. 

**Estado**: El análisis en [[analysis/EVENTS_TICKETS_ANALYSIS]] identifica la estructura base necesaria, pero **falta implementar**:
- Validación robusta de webhooks (HMAC SHA256)
- Manejo correcto de eventos de Order de MercadoPago
- Discriminación entre pagos de catálogo y tickets
- Vinculación correcta de `external_reference` con `TicketPurchase`

---

## Estado Actual

### Módulos Existentes (Base Sólida)
| Módulo | Descripción | Estado para Tickets |
|--------|-------------|---------------------|
| AuthModule | JWT, Firebase social login, roles | ✅ Reutilizable (agregar EVENT_ORGANIZER) |
| UserModule | Gestión de usuarios | ✅ Reutilizable |
| CatalogModule | Catálogos genéricos | ⚠️ Requiere discriminador |
| OrdersModule | Pedidos/órdenes | ⚠️ Requiere discriminador type |
| PaymentsModule | MercadoPago (preferencias, webhooks, OAuth) | ⚠️ Requiere webhook dedicado para tickets |
| MembershipModule | Suscripciones y planes | ✅ Reutilizable |
| NotificationsModule | Firebase push notifications | ⚠️ Requiere email/SMS |

### Enums Actuales que Requieren Expansión
> **⚠️ NOTA (Code Review)**: Los enums `RoleType` y `BusinessContext` en el código real (`src/auth/models/permissions.model.ts`) NO tienen los valores nuevos. Es crítico agregarlos.

```typescript
// ⚠️ CÓDIGO REAL (src/auth/models/permissions.model.ts) - FALTA ACTUALIZAR:
// RoleType actual: CUSTOMER, OWNER, ADMIN, OPERATOR, MANAGER (sin EVENT_ORGANIZER)
// BusinessContext actual: RESTAURANT, WARDROBE, MARKETPLACE, GENERAL (sin EVENTS)

// ✅ ENUMS DE EVENTOS (correctamente implementados en src/events/enums/):
// EventStatus: DRAFT, PUBLISHED, CANCELLED, COMPLETED
// TicketStatus: PENDING, ACTIVE, VALID, USED, CANCELLED, REFUNDED
// TicketPurchaseStatus: PENDING, COMPLETED, FAILED, REFUNDED (⚠️ se llama TicketPurchaseStatus, no PaymentStatus)
```

---

## Nuevas Entidades Requeridas

### Esquema Completo (TypeORM) - ✅ IMPLEMENTADO EN CÓDIGO REAL

> **✅ NOTA**: Entidades ya implementadas en `src/events/entities/`. Algunos campos difieren de la documentación original.

```typescript
// ✅ src/events/entities/event.entity.ts (IMPLEMENTADO)
@Entity('events')
export class Event {
  @PrimaryGeneratedColumn('uuid')
  id: string;
 
  @Column() // Aislamiento multi-tenant
  tenantId: string;
 
  @Column()
  name: string;
 
  @Column('text')
  description: string;
 
  @Column({ type: 'timestamp' })
  startDate: Date;
 
  @Column({ type: 'timestamp' })
  endDate: Date;
 
  @Column({ type: 'enum', enum: EventStatus, default: EventStatus.DRAFT })
  status: EventStatus; // ✅ Usa enum correctamente
 
  @ManyToOne(() => User)
  organizer: User;
 
  @OneToMany(() => TicketType, (ticketType) => ticketType.event)
  ticketTypes: TicketType[];
 
  @ManyToOne(() => Venue, { nullable: true })
  venue: Venue;
 
  @Column({ nullable: true })
  imageUrl: string;

  @CreateDateColumn()
  createdAt: Date; // ✅ Agregado en implementación real

  @UpdateDateColumn()
  updatedAt: Date; // ✅ Agregado en implementación real
}
```

### Entidad Faltante: Venue (Lugar del Evento)
```typescript
// entities/venue.entity.ts - ← NO MENCIONADA EN ANÁLISIS INICIAL
@Entity()
export class Venue {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  address: string;

  @Column('decimal', { precision: 10, scale: 8, nullable: true })
  latitude: number;

  @Column('decimal', { precision: 11, scale: 8, nullable: true })
  longitude: number;

  @Column({ nullable: true })
  capacity: number;

  @Column('simple-array', { nullable: true })
  services: string[]; // ['parking', 'wifi', 'accessible']
}
```

---

## Webhooks MercadoPago

> **Referencia**: Esta sección implementa lo omitido en [[analysis/EVENTS_TICKETS_ANALYSIS]] sección 7.2 y 7.4.

### Configuración Inicial (Pasos Obligatorios)

1. **Obtener credenciales OAuth del organizador**:
   - El organizador debe autorizar a Menucom via OAuth
   - Almacenar `access_token` y `refresh_token` en la tabla `users` o tabla dedicada `organizer_credentials`

2. **Configurar Webhook en MercadoPago**:
   - Ingresar a [Tus integraciones](https://www.mercadopago.com/developers/panel/app)
   - Seleccionar aplicación > Webhooks > Configurar notificaciones
   - URL: `https://api.menucom.com/webhooks/tickets?client={organizerId}`
   - Evento: **Order (Mercado Pago)**
   - Guardar configuración → Obtener **clave secreta** (necesaria para validación)

### Estructura del Webhook (Lo que MercadoPago Envía)

```
POST /webhooks/tickets?data.id=ORD01JQ4S4KY8HWQ6NA5PXB65B3D3&type=order HTTP/1.1
Host: api.menucom.com
X-Signature: ts=1742505638683,v1=ced36ab6d33566bb1e16c125819b8d840d6b8ef136b0b9127c76064466f5229b
X-Request-Id: 2066ca19-c6f1-498a-be75-1923005edd06
Content-Type: application/json

{
  "action": "order.processed",
  "api_version": "v1",
  "application_id": "76506430185983",
  "data": {
    "external_reference": "ticket_purchase_uuid_here", // ← DEBE ser TicketPurchase.id
    "id": "ORD01JQ4S4KY8HWQ6NA5PXB65B3D3",
    "status": "processed",
    "status_detail": "accredited",
    "total_paid_amount": "120",
    "transactions": {
      "payments": [{
        "amount": "120",
        "id": "PAY01K22Y503EJ8JHGF64KGY1PZ2B",
        "status": "processed",
        "status_detail": "accredited"
      }]
    },
    "type": "qr", // o "point" según método
    "version": 3
  },
  "date_created": "2025-08-07T18:54:40.851374414Z",
  "live_mode": true,
  "type": "order",
  "user_id": "123456"
}
```

### Endpoint en NestJS (Implementación Faltante)

```typescript
// src/webhooks/controllers/tickets-webhook.controller.ts
import { Controller, Post, Body, Headers, Query, HttpCode, HttpStatus } from '@nestjs/common';
import * as crypto from 'crypto';

@Controller('webhooks')
export class TicketsWebhookController {
  
  // ⚠️ SIN AuthGuard - MercadoPago necesita acceso público
  @Post('tickets')
  @HttpCode(HttpStatus.OK)
  async handleTicketWebhook(
    @Body() body: any,
    @Headers('x-signature') xSignature: string,
    @Headers('x-request-id') xRequestId: string,
    @Query('data.id') dataId: string,
    @Query('type') type: string,
    @Query('client') organizerId?: string,
  ) {
    // 1. Validar firma HMAC (CRÍTICO - Faltaba en análisis inicial)
    const isValid = this.validateSignature(xSignature, xRequestId, dataId);
    if (!isValid) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    // 2. Verificar que sea evento de order
    if (type !== 'order') {
      return { status: 'ignored', reason: 'Not an order event' };
    }

    // 3. Obtener detalles de la orden desde MercadoPago
    const orderDetails = await this.getOrderFromMP(body.data.id, organizerId);
    
    // 4. Verificar que sea un pago de tickets (discriminador)
    if (orderDetails.external_reference?.startsWith('TICKET_') === false) {
      // Delegar al webhook existente de catálogo
      return { status: 'delegated', reason: 'Not a ticket purchase' };
    }

    // 5. Procesar según action
    await this.processOrderAction(body.action, orderDetails);

    return { status: 'ok' }; // ← MercadoPago espera respuesta en < 22 seg
  }

  private validateSignature(xSignature: string, xRequestId: string, dataId: string): boolean {
    const parts = xSignature.split(',');
    let ts: string, v1: string;

    parts.forEach(part => {
      const [key, value] = part.split('=');
      if (key?.trim() === 'ts') ts = value?.trim();
      if (key?.trim() === 'v1') v1 = value?.trim();
    });

    // ⚠️ dataId debe estar en minúsculas según docs de MP
    const manifest = `id:${dataId.toLowerCase()};request-id:${xRequestId};ts:${ts};`;
    
    const secret = process.env.MP_WEBHOOK_SECRET; // Obtenida de configuración de webhook
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(manifest);
    const sha = hmac.digest('hex');

    return sha === v1;
  }

  private async processOrderAction(action: string, orderDetails: any) {
    const ticketPurchaseId = orderDetails.external_reference;

    switch (action) {
      case 'order.processed':
        // ✅ Pago exitoso
        await this.ticketPurchaseService.updateStatus(ticketPurchaseId, 'COMPLETED');
        await this.ticketService.generateTickets(ticketPurchaseId);
        break;

      case 'order.refunded':
        // ✅ Reembolso (el análisis mencionaba payment.updated, pero MP usa order.refunded)
        await this.ticketPurchaseService.updateStatus(ticketPurchaseId, 'REFUNDED');
        await this.ticketService.updateStatusByPurchase(ticketPurchaseId, 'REFUNDED');
        await this.ticketTypeService.releaseInventory(ticketPurchaseId);
        break;

      case 'order.expired':
      case 'order.failed':
        // ❌ Pago fallido/expirado
        await this.ticketPurchaseService.updateStatus(ticketPurchaseId, 'FAILED');
        await this.ticketTypeService.releaseInventory(ticketPurchaseId);
        break;

      case 'order.cancelled':
        // ❌ Cancelado
        await this.ticketPurchaseService.updateStatus(ticketPurchaseId, 'FAILED');
        await this.ticketTypeService.releaseInventory(ticketPurchaseId);
        break;
    }
  }
}
```

### Creación de Preferencia de Pago (Cobro Directo)

```typescript
// src/events/services/event-payment.service.ts
async createTicketPreference(dto: PurchaseTicketsDto, buyer: User) {
  // 1. Verificar token OAuth del organizador
  const organizer = await this.getOrganizerWithOAuth(dto.eventId);
  if (!organizer.mpAccessToken || this.isTokenExpired(organizer.tokenExpiry)) {
    throw new Error('Organizer OAuth token invalid. Re-authentication required.');
  }

  // 2. Calcular fee dinámico
  const feePercentage = await this.calculateDynamicFee(dto.eventId);
  
  // 3. Crear preferencia con metadata discriminadora
  const preference = {
    items: [{
      title: `Tickets - ${dto.eventName}`,
      quantity: dto.quantity,
      unit_price: dto.unitPrice,
      currency_id: 'ARS',
    }],
    external_reference: dto.ticketPurchaseId, // ← CRÍTICO: Debe ser TicketPurchase.id
    metadata: {
      type: 'TICKET_PURCHASE', // ← Discriminador para webhook
      eventId: dto.eventId,
      buyerId: buyer.id,
    },
    marketpalce: {
      fee_payer: 'collector', // El organizador paga la comisión
      application_fee: (dto.totalAmount * feePercentage / 100).toFixed(2),
    },
    // ⚠️ Usar token del organizador, NO el de la plataforma
    access_token: organizer.mpAccessToken,
  };

  return await this.mpClient.preferences.create(preference);
}
```

---

## Brechas Críticas

### Lo que [[analysis/EVENTS_TICKETS_ANALYSIS]] NO menciona (o menciona incorrectamente)

| # | Brecha | Impacto | Solución |
|---|--------|---------|---------|
| 1 | **Validación HMAC de webhooks incompleta** | CRÍTICO: Atacantes pueden falsificar pagos | Implementar validación `X-Signature` como se muestra arriba |
| 2 | **Evento de reembolso incorrecto** | MEDIO: Webhook no procesará reembolsos | Usar `order.refunded` no `payment.updated` |
| 3 | **Falta discriminador en preferencia** | ALTO: Webhook actualizará órdenes de catálogo por error | Agregar `metadata.type: 'TICKET_PURCHASE'` |
| 4 | **external_reference no especifica** | ALTO: No se puede mapear webhook a TicketPurchase | Usar `TicketPurchase.id` como `external_reference` |
| 5 | **Token OAuth del organizador** | ALTO: Pagos fallarán | Usar token del organizador, no de la plataforma |
| 6 | **Falta entidad Venue** | MEDIO: Datos de ubicación dispersos | Crear entidad `Venue` independiente |
| 7 | **Sin auditoría de validación** | MEDIO: No se sabe quién validó tickets | Agregar `validatedBy` y `validatedAt` |
| 8 | **Check constraint faltante** | ALTO: Sobreventa por BD | Agregar `@Check` en `TicketType` |
| 9 | **Concurrencia no resuelta** | ALTO: Sobreventa de tickets | Implementar `SELECT FOR UPDATE` como en sección 8.2 del análisis |
| 10 | **Expiración de reservas** | MEDIO: Tickets bloqueados indefinidamente | Implementar job cron + Redis TTL |

---

## Plan de Implementación

### Fase 1: Entidades y Base de Datos (Semana 1-2)
1. Crear migraciones TypeORM para nuevas entidades
2. Agregar `tenantId` a todas las entidades nuevas
3. Agregar enums `EventStatus`, `TicketStatus`, `PaymentStatus`
4. Crear entidad `Venue`
5. Agregar check constraints para integridad de inventario

### Fase 2: Módulo Events (Semana 2-3)
1. Implementar `EventsModule` con estructura Clean Architecture
2. CRUD de eventos con documentación Swagger
3. Gestión de tipos de tickets
4. Implementar bloqueo pesimista para concurrencia

### Fase 3: Integración MercadoPago (Semana 3-4)
1. **CRÍTICO**: Crear endpoint `/webhooks/tickets` dedicado
2. Implementar validación HMAC SHA256
3. Manejar eventos `order.processed`, `order.refunded`, `order.expired`
4. Adaptar `PaymentIntent` para tickets con `application_fee` dinámico
5. Verificar uso de token OAuth del organizador

### Fase 4: QR y Validación (Semana 4-5)
1. Generación de QR con hash HMAC
2. Validación offline mediante JWT firmado
3. Auditoría de validaciones (quién, cuándo, dónde)

### Fase 5: Pruebas y Despliegue (Semana 5-6)
1. Pruebas E2E del flujo completo (ver `typescript-e2e-testing` skill)
2. Pruebas de webhooks con simulador de MercadoPago
3. Pruebas de concurrencia (sobreventa)
4. Despliegue gradual con feature flags

---

## Referencias

### Documentos Internos
- **[[analysis/EVENTS_TICKETS_ANALYSIS]]** → Análisis inicial, entidades propuestas, consideraciones generales
- **[[technical/DYNAMIC_MARKETPLACE_FEE]]** → Cálculo de comisión dinámica
- **[[whoitdone/technical-documentation]]** (este documento) → Implementación técnica detallada, webhooks, brechas

### Documentación Externa (MercadoPago)
- [Configurar notificaciones Webhook](https://www.mercadopago.com/developers/es/docs/qr-code/notifications)
- [Validar origen de notificación (HMAC)](https://www.mercadopago.com/developers/es/docs/qr-code/notifications#bookmark_validar-origen-de-la-notificación)
- [API Orders - Get Order](https://www.mercadopago.com/developers/es/reference/in-person-payments/qr-code/orders/get-order/get)
- [Cobro Directo con Application Fee](https://www.mercadopago.com/developers/es/docs/online-payments/checkout-api/extra-concepts/marketplace)

### Skills Relacionadas
- **`nestjs-patterns`** → Arquitectura de módulos, guards, interceptors
- **`typescript-e2e-testing`** → Pruebas E2E con Docker
- **`postgres-patterns`** → Optimización de consultas, concurrencia
- **`supabase`** → Si se migra a Supabase en el futuro

---

## Conclusión

El sistema **SÍ puede** soportar organizadores de eventos, pero requiere:
1. ✅ Expansión de enums (ya identificado en análisis inicial)
2. ✅ Nuevo módulo Events (ya propuesto en análisis inicial)
3. ⚠️ **NUEVO**: Webhook dedicado con validación HMAC robusta
4. ⚠️ **NUEVO**: Discriminador `metadata.type` en preferencias
5. ⚠️ **NUEVO**: Uso de token OAuth del organizador (no el de la plataforma)
6. ⚠️ **NUEVO**: Entidad `Venue` independiente
7. ⚠️ **CORRECCIÓN**: Evento de reembolso es `order.refunded` no `payment.updated`

> **Nota**: Este documento y [[analysis/EVENTS_TICKETS_ANALYSIS]] deben mantenerse sincronizados. Los cambios en uno deben reflejarse en el otro.

---

## 🏁 Checks de Progreso

### Fase 1: Entidades y Base de Datos (⚠️ Parcialmente completado - VER NOTAS)
- [x] Crear migración SQL para nuevas entidades (`Event`, `TicketType`, `Ticket`, `TicketPurchase`, `Venue`) - *Nota: Es SQL, no TypeORM como indicaba el plan original*
- [x] Agregar `tenantId` a todas las entidades nuevas para aislamiento multi-tenant
- [⚠️] Definir enums: `EventStatus` ✅, `TicketStatus` ✅, `PaymentStatus` ⚠️ *Existe como `TicketPurchaseStatus`*
- [⚠️] **PENDIENTE**: Agregar `EVENT_ORGANIZER` a `RoleType` enum
- [⚠️] **PENDIENTE**: Agregar `EVENTS` a `BusinessContext` enum
- [x] Implementar Check constraints en `TicketType` (evitar sobreventa a nivel BD)

### Fase 2: Módulo Events (✅ Completado, contrario a lo indicado anteriormente)
- [x] Estructura `EventsModule` (Controller, Service, Repository, Provider)
- [x] CRUD de Eventos con documentación Swagger
- [x] CRUD de Tipos de Tickets
- [x] Implementación de bloqueo pesimista (`SELECT FOR UPDATE`) para compra de tickets

### Fase 3: Integración MercadoPago
- [ ] Implementar endpoint `/webhooks/tickets` (público)
- [ ] Implementar validación de firma HMAC SHA256 (`x-signature`)
- [ ] Lógica de procesamiento para `order.processed`, `order.refunded`, `order.expired`, `order.failed`
- [ ] Integración de `application_fee` dinámico en preferencias
- [ ] Implementar flujo OAuth para tokens de organizadores

### Fase 4: QR y Validación (✅ COMPLETADA)
- [x] Algoritmo de generación de QR seguro (HMAC SHA256) - `QRCodeSecureService`
- [x] Sistema de validación offline (JWT firmado) - `TicketValidationService`
- [x] Auditoría de validación (`validatedBy`, `validatedAt`) - Ya existente en entidad

#### Implementación Técnica - Fase 4

##### 1. QR Seguro con HMAC (`qrcode-secure.service.ts`)

```typescript
// Generar QR seguro
const qrCode = this.qrService.generateSecureQR({
  ticketId: ticket.id,
  purchaseId: purchase.id,
  ticketTypeId: ticketType.id,
  eventId: event.id,
});

// Validar QR
const qrData = this.qrService.validateSecureQR(qrCode);
if (qrData) {
  // QR válido - datos extraídos:
  // qrData.ticketId, qrData.purchaseId, qrData.eventId, etc.
}
```

**Características:**
- Firma HMAC SHA256 con secreto configurado (`TICKET_QR_SECRET`)
- Expiración automática (7 días por defecto)
- Timing-safe comparison para prevenir timing attacks
- Formato base64url (compacto y URL-safe)

##### 2. Validación Offline con JWT (`ticket-validation.service.ts`)

```typescript
// Generar token offline (contiene datos del evento)
const token = this.validationService.generateOfflineValidationToken({
  ticketId: ticket.id,
  eventId: event.id,
  eventName: event.name,
  eventDate: event.startDate,
  ticketTypeName: ticketType.name,
  ownerName: ticket.ownerName,
  // ... más datos
});

// Validar sin conexión a DB
const result = this.validationService.validateOfflineToken(token);
if (result.valid) {
  console.log(result.ticketData.eventName); // Datos disponibles offline
}
```

**Formato del JWT Payload:**
```typescript
{
  tid: string;      // ticketId
  pid: string;      // purchaseId
  ttid: string;     // ticketTypeId
  eid: string;      // eventId
  ename: string;    // eventName
  edate: string;    // eventDate (ISO)
  ttname: string;   // ticketTypeName
  owner: string;    // ownerName
  iat: number;      // issued at
  exp: number;      // expiration
  type: 'ticket_offline'
}
```

##### 3. QR Híbrido (Combinado)

Para máxima flexibilidad, se generan 3 formatos:

```typescript
const hybrid = this.validationService.generateHybridQRCode(qrData, ticketData);

// hybrid.secureQR    - QR compacto con HMAC (para escáneres simples)
// hybrid.offlineToken - JWT para validación offline extendida
// hybrid.combinedQR  - Ambos formatos en uno (recomendado)
```

##### 4. Endpoints de Validación

| Endpoint | Método | Auth | Descripción |
|----------|--------|------|-------------|
| `/tickets/validate` | POST | JWT + Permisos | Valida ticket (online/offline) |
| `/tickets/validate-offline` | POST | Público | Valida token JWT offline |
| `/tickets/:id/qr-data` | GET | JWT | Obtiene ticket con todos los QR |
| `/tickets/:id/regenerate-qr` | POST | JWT + Permisos | Regenera QR si se perdió |
| `/tickets/check` | POST | JWT + Permisos | Verifica estado sin consumir |

##### 5. Flujo de Validación

```
Escáner lee QR → POST /tickets/validate
                    │
    ┌───────────────┼───────────────┐
    ▼               ▼               ▼
Modo Online     Modo Offline    QR Híbrido
    │               │               │
    ▼               ▼               ▼
Valida HMAC    Valida JWT      Intenta JWT
    │          (sin DB)       si falla → HMAC
    ▼               │               │
Consulta DB       Retorna      Retorna
    │            datos         datos
    ▼               │          (completo
Marca como          │           o básico)
usado               │
    │               │               │
    └───────────────┴───────────────┘
                    │
                    ▼
              Respuesta JSON
              { valid: true, ticket: {...} }
```

##### 6. Variables de Entorno Requeridas

```bash
# QR Seguro
TICKET_QR_SECRET=your-secure-random-key-min-32-chars

# JWT (ya existente en auth, reutilizado)
JWT_SECRET=your-jwt-secret
```

##### 7. Seguridad

- **Anti-falsificación**: HMAC SHA256 con secreto privado
- **Anti-replicación**: Timestamp único en cada QR
- **Expiración**: QR válido por 7 días (configurable)
- **Timing attack safe**: Comparación de firmas con timing-safe equal
- **Offline validation**: JWT firmado permite validación sin exposición de DB

### Fase 5: Pruebas y QA
- [ ] Pruebas E2E del flujo de compra completo
- [ ] Mock de webhooks de MercadoPago para testing
- [ ] Pruebas de estrés/concurrencia para inventario
- [ ] Configuración de Feature Flags para despliegue gradual

