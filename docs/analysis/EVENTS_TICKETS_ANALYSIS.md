---
tags:
  - domain/events
  - repo/api
  - type/analysis
  - status/completed
aliases:
  - Events Tickets Analysis
  - Eventos y Tickets
---
# Análisis: Organizadores de Eventos y Venta de Tickets en Menucom

## Estado Actual

Menucom API es una plataforma multi-tenant en NestJS enfocada en:
- Gestión de catálogos digitales (menús, ropa, productos)
- Sistema de membresías (FREE, PREMIUM, ENTERPRISE)
- Procesamiento de pagos con MercadoPago
- Control de acceso basado en roles

### Módulos Existentes
| Módulo | Descripción |
|--------|-------------|
| AuthModule | JWT, Firebase social login, roles |
| UserModule | Gestión de usuarios |
| CatalogModule | Catálogos genéricos (MENU, WARDROBE, PRODUCT_LIST) |
| OrdersModule | Pedidos/órdenes |
| PaymentsModule | MercadoPago (preferencias, webhooks, OAuth) |
| MembershipModule | Suscripciones y planes |
| NotificationsModule | Firebase push notifications |

### Roles Actuales (RoleType)
- CUSTOMER, OWNER, ADMIN, OPERATOR, MANAGER

### Contextos de Negocio (BusinessContext)
- RESTAURANT, WARDROBE, MARKETPLACE, GENERAL

---

## ¿Qué Falta para Soportar Organizadores de Eventos y Venta de Tickets?

### 1. Nuevas Entidades (TypeORM)

```typescript
// Entidades necesarias
Event              // Datos del evento (nombre, fecha, lugar, descripción)
EventOrganizer     // Relación User -> Evento (organizador)
TicketType         // Tipos de entrada (General, VIP, Early Bird)
Ticket             // Entrada individual (código QR, estado)
TicketPurchase     // Compra/orden de entradas (referencia a Order existente)
EventCategory      // Categorías de eventos (Concierto, Teatro, Deportes)
```

### 2. Nuevo Módulo: EventsModule (Clean Architecture)

Se seguirá la estructura modular del proyecto, separando la lógica de negocio en servicios, repositorios y proveedores externos.

```
src/events/
├── events.module.ts
├── controllers/
│   ├── events.controller.ts       // CRUD eventos (Swagger docs)
│   ├── ticket-types.controller.ts  // Gestión tipos de entrada
│   ├── tickets.controller.ts      // Validación/escaneo entradas
│   └── organizers.controller.ts  // Gestión organizadores
├── services/
│   ├── events.service.ts
│   ├── ticket-types.service.ts
│   ├── tickets.service.ts         // Lógica de validación
│   └── event-payment.service.ts   // Orquestador de pagos
├── repositories/                  // Abstracción de TypeORM
│   ├── event.repository.ts
│   ├── ticket.repository.ts
│   └── ticket-type.repository.ts
├── providers/                     // Servicios externos / Utilidades
│   ├── qr-generator.provider.ts   // Generación de QR firmados
│   ├── pdf-generator.provider.ts  // Generación de tickets PDF
│   └── external-notifications.provider.ts // Email/SMS
├── entities/
│   ├── event.entity.ts
│   ├── ticket-type.entity.ts
│   ├── ticket.entity.ts
│   └── ticket-purchase.entity.ts
├── dto/
│   ├── create-event.dto.ts
│   └── purchase-tickets.dto.ts
└── guards/
    └── event-owner.guard.ts
```


### 3. Modificaciones en Enums Existentes

**auth/models/role-type.enum.ts:**
```typescript
export enum RoleType {
  CUSTOMER = 'CUSTOMER',
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  OPERATOR = 'OPERATOR',
  MANAGER = 'MANAGER',
  EVENT_ORGANIZER = 'EVENT_ORGANIZER', // NUEVO
}
```

**auth/models/business-context.enum.ts:**
```typescript
export enum BusinessContext {
  RESTAURANT = 'RESTAURANT',
  WARDROBE = 'WARDROBE',
  MARKETPLACE = 'MARKETPLACE',
  GENERAL = 'GENERAL',
  EVENTS = 'EVENTS', // NUEVO
}
```

### 4. Integración con MercadoPago y Flujo de Fondos

El sistema utilizará un modelo de **Cobro Directo** aprovechando el sistema de OAuth existente.

- **Flujo de Fondos**: El comprador paga al organizador. Menucom recibe una comisión (fee) automáticamente en la transacción.
- **Fee Dinámico**: Se aplicará un porcentaje personalizado según el comercio (Ver [DYNAMIC_MARKETPLACE_FEE.md](docs/technical/DYNAMIC_MARKETPLACE_FEE.md)).
- **Adaptación `PaymentIntent`**: Identificar el pago como `type: 'EVENT_TICKET'`.
- **Uso de `application_fee`**: Al crear la preferencia, se enviará el monto de comisión calculado.
- **Soporte para reembolsos**: Los reembolsos devolverán el ticket a estado `REFUNDED` y liberarán el inventario.

### 5. Funcionalidades Faltantes Críticas

| Funcionalidad | Descripción | Prioridad |
|--------------|-------------|----------|
| **CRUD Eventos** | Crear, editar, publicar con Swagger documentation | ALTA |
| **Gestión de Inventario** | Bloqueo pesimista para evitar sobreventa | ALTA |
| **Venta de Tickets** | Cobro directo con application_fee dinámico | ALTA |
| **Códigos QR Firmados** | QR con hash HMAC para evitar falsificaciones | ALTA |
| **Validación Offline** | Validación mediante JWT firmado (sin DB) | ALTA |
| **Generación de PDF** | Ticket descargable para el usuario | MEDIA |
| **Cupones y Descuentos** | Códigos promocionales por evento | MEDIA |
| **Dashboard Organizador** | Estadísticas de ventas y asistencia | MEDIA |
| **Notificaciones Email** | Comprobante de compra y ticket adjunto | MEDIA |
| **Reembolsos Automáticos** | Integración total con Webhooks de MP | MEDIA |
| **Transferencia de Tickets** | Cambio de titularidad de entrada | BAJA |

### 6. Consideraciones Técnicas Adicionales

- **Concurrencia**: Manejar múltiples compras simultáneas sin sobrevender
- **Expiración de carrito**: Liberar entradas reservadas si no se completa el pago
- **Límites de compra**: Máximo de entradas por persona
- **Fechas**: Inicio/Fin de venta de entradas, fecha del evento
- **Geolocalización**: Mapa del lugar del evento
- **Multimedia**: Imágenes del evento (usar CloudinaryModule existente)

### 7. Análisis Exhaustivo de Riesgos y Puntos de Error Clave

#### 7.1. Inconsistencias en Modelado de Datos
- **Relación TicketPurchase ↔ Order**: El módulo `OrdersModule` actual gestiona pedidos de ítems de catálogo (menús, ropa, productos). Los tickets no son ítems de catálogo, por lo que vincular `TicketPurchase` a la entidad `Order` existente puede causar errores de tipo, validaciones fallidas o lógica de negocio rota en el módulo de órdenes. Se recomienda extender `Order` con un discriminador (`type: 'CATALOG' | 'TICKET'`) o crear una entidad de pago genérica compartida.
- **Falta de Aislamiento Multi-Tenant**: Menucom es una plataforma multi-tenant, pero el análisis no menciona el campo `tenantId` en las nuevas entidades (`Event`, `TicketPurchase`, etc.). Sin esto, los eventos y tickets de un tenant serán visibles/modificables por otros tenants, riesgo crítico de seguridad.
- **Enums de Estado Faltantes**: No se definen enums para:
  - `EventStatus`: (DRAFT, PUBLISHED, CANCELLED, COMPLETED)
  - `TicketStatus`: (VALID, USED, CANCELLED, REFUNDED)
  - `PaymentStatus` para tickets: (PENDING, COMPLETED, FAILED, REFUNDED)
  La ausencia de estos enums llevará a lógica de negocio dispersa, uso de strings mágicos y errores de validación.

#### 7.2. Riesgos en Integración con MercadoPago y Cobro Directo
- **Colisión de Webhooks**: Los webhooks existentes de MercadoPago están diseñados para pagos de pedidos de catálogo. Si no se agrega un discriminador en las preferencias de pago (ej. `metadata.type = 'TICKET_PURCHASE'`), los webhooks podrían actualizar estados de órdenes de catálogo por error.
- **Dependencia de OAuth**: En el modelo de cobro directo, si el organizador no ha vinculado su cuenta o el token de acceso ha expirado, la compra fallará. Se requiere un chequeo proactivo del estado del token antes de permitir la publicación de un evento.
- **Configuración de Application Fee**: Un error en el cálculo del fee dinámico (ver [DYNAMIC_MARKETPLACE_FEE.md](docs/technical/DYNAMIC_MARKETPLACE_FEE.md)) podría resultar en cobros de comisión incorrectos (0% o 100%), afectando las finanzas de la plataforma.
- **Reembolsos Automáticos**: El análisis menciona reembolsos, pero no especifica que los reembolsos manuales en el dashboard de MercadoPago no actualizarán el estado de los tickets automáticamente. Se requiere un listener de webhook para el evento `payment.updated` con estado `refunded`.


#### 7.3. Problemas de Concurrencia y Consistencia
- **Sobreventa de Tickets**: El análisis menciona concurrencia como consideración, pero no propone una solución técnica. Sin bloqueos pesimistas (ej. `SELECT FOR UPDATE` en TypeORM) o colas de reserva, dos usuarios pueden comprar el último ticket disponible simultáneamente.
- **Expiración de Reservas**: No se especifica un mecanismo para liberar tickets reservados si el pago no se completa. Se requiere un job cron periódico o uso de Redis con TTL para liberar reservas expiradas (ej. 15 minutos).
- **Validación de Inventario**: No hay mención de check constraints en base de datos para asegurar que `soldQuantity` no exceda `totalQuantity` en `TicketType`. La validación solo en el servicio es propensa a errores por race conditions.

#### 7.4. Vulnerabilidades de Seguridad
- **QR Codes Manipulables**: No se menciona encriptación o firmado de los códigos QR. Si el contenido del QR es predecible (ej. solo ticketId), un atacante puede generar QRs falsos. Se recomienda usar un hash firmado con una clave secreta.
- **Validación de Entradas Sin Auditoría**: No se registra quién validó una entrada, cuándo ni desde qué dispositivo. Esto dificulta la detección de fraudes o errores de validación.
- **Falta de Validación de Webhooks**: Los webhooks de MercadoPago para tickets deben validar la firma `X-Signature` al igual que los webhooks existentes. Si no se hace, atacantes pueden enviar peticiones falsas marcando tickets como pagados.

#### 7.5. Fallos en Autenticación y Autorización
- **Rol EVENT_ORGANIZER**: Guards existentes que restrinjan acceso a roles específicos (ej. solo `OWNER`/`ADMIN` para gestión de recursos) no reconocerán el nuevo rol `EVENT_ORGANIZER`, causando denegaciones de acceso incorrectas o fugas de permisos.
- **BusinessContext EVENTS**: Módulos existentes que usen sentencias switch o validaciones sobre `BusinessContext` no manejarán el nuevo valor `EVENTS`, llevando a comportamientos inesperados o errores no detectados en tiempo de ejecución.
- **Validación de Entradas**: El rol `OPERATOR` existente debería tener permisos para validar entradas en puerta, pero el análisis no lo menciona. No agregar `OPERATOR` a la lista de roles autorizados causará bloqueos en la validación en sitio.

#### 7.6. Funcionalidades Críticas No Mencionadas
- **Entidad Venue (Lugar del Evento)**: La entidad `Event` menciona un campo "lugar", pero no se define una entidad `Venue` con dirección, coordenadas GPS, capacidad máxima y servicios. Esto llevará a datos de ubicación dispersos y difíciles de consultar.
- **Límites de Compra Granulares**: No se especifica cómo aplicar el máximo de tickets por usuario. ¿Se valida en frontend y backend? ¿Se permiten excepciones para organizadores o staff?
- **Notificaciones por Email/SMS**: El módulo `NotificationsModule` actual solo usa Firebase Push. Las confirmaciones de compra de tickets y recordatorios de evento suelen requerir email/SMS, que no están contemplados.

### 8. Expansión de Documentación Técnica

#### 8.1. Esquema Completo de Entidades (TypeORM)
```typescript
// event.entity.ts
@Entity()
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

  @Column({ type: 'enum', enum: ['DRAFT', 'PUBLISHED', 'CANCELLED', 'COMPLETED'] })
  status: string;

  @ManyToOne(() => User)
  organizer: User;

  @OneToMany(() => TicketType, (ticketType) => ticketType.event)
  ticketTypes: TicketType[];

  @ManyToOne(() => Venue, { nullable: true })
  venue: Venue;

  @Column({ nullable: true })
  imageUrl: string; // Integración con CloudinaryModule existente
}

// ticket-type.entity.ts
@Entity()
export class TicketType {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Event)
  event: Event;

  @Column()
  name: string; // General, VIP, Early Bird

  @Column('decimal', { precision: 10, scale: 2 })
  price: number;

  @Column()
  totalQuantity: number;

  @Column({ default: 0 })
  soldQuantity: number;

  @Column({ type: 'timestamp' })
  saleStartDate: Date;

  @Column({ type: 'timestamp' })
  saleEndDate: Date;

  @Column({ default: 10 })
  maxPerUser: number; // Límite de compra por usuario
}

// ticket.entity.ts
@Entity()
export class Ticket {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => TicketType)
  ticketType: TicketType;

  @ManyToOne(() => TicketPurchase)
  purchase: TicketPurchase;

  @Column()
  qrCodeHash: string; // Hash firmado único

  @Column({ type: 'enum', enum: ['VALID', 'USED', 'CANCELLED', 'REFUNDED'] })
  status: string;

  @Column({ nullable: true })
  validatedAt: Date;

  @ManyToOne(() => User, { nullable: true })
  validatedBy: User; // Usuario que validó la entrada
}

// ticket-purchase.entity.ts
@Entity()
export class TicketPurchase {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  tenantId: string;

  @ManyToOne(() => User)
  buyer: User;

  @ManyToOne(() => Event)
  event: Event;

  @Column('decimal', { precision: 10, scale: 2 })
  totalAmount: number;

  @Column('decimal', { precision: 10, scale: 2 })
  appliedFeePercentage: number; // Porcentaje aplicado en el momento de la compra

  @Column('decimal', { precision: 10, scale: 2 })
  feeAmount: number; // Monto exacto que recibió la plataforma

  @Column({ type: 'enum', enum: ['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED'] })
  paymentStatus: string;

  @OneToMany(() => Ticket, (ticket) => ticket.purchase)
  tickets: Ticket[];

  @ManyToOne(() => Order, { nullable: true })
  order: Order; // Opcional, integración con módulo Orders
}

```

#### 8.2. Estrategia de Concurrencia para Inventario
Usar bloqueo pesimista en TypeORM para reservar tickets de forma atómica:
```typescript
async purchaseTickets(ticketTypeId: string, quantity: number) {
  await this.dataSource.transaction(async (manager) => {
    const ticketType = await manager
      .getRepository(TicketType)
      .createQueryBuilder('tt')
      .setLock('pessimistic_write')
      .where('tt.id = :id', { id: ticketTypeId })
      .getOne();

    if (ticketType.soldQuantity + quantity > ticketType.totalQuantity) {
      throw new Error('Inventario insuficiente');
    }

    ticketType.soldQuantity += quantity;
    await manager.save(ticketType);

    // Crear TicketPurchase y Tickets
  });
}
```

#### 8.3. Plan de Migración Segura
1. **Migraciones de Base de Datos**: Crear migraciones separadas para nuevas entidades, teniendo en cuenta `tenantId` y relaciones. Hacer backup de producción antes de aplicar.
2. **Modificación de Enums**: Agregar `EVENT_ORGANIZER` y `EVENTS` a los enums existentes en una migración aparte, luego actualizar guards y switches de contexto.
3. **Webhooks de MercadoPago**: Agregar un endpoint dedicado para webhooks de tickets y validar la firma `X-Signature` antes de procesar cualquier evento.
4. **Pruebas de Regresión**: Ejecutar pruebas completas del módulo Payments y Orders existentes después de cada cambio para evitar romper funcionalidad existente.

---

## Resumen de Trabajo Estimado

| Área | Tareas | Complejidad |
|------|--------|-------------|
| Backend - Entidades | 5-6 nuevas entidades TypeORM | Media |
| Backend - Módulo Events | Controllers, Services, DTOs | Alta |
| Backend - Pagos | Adaptar MercadoPago para tickets | Media |
| Backend - Auth | Nuevo rol EVENT_ORGANIZER | Baja |
| QR/Validación | Generación y escaneo de códigos | Media |
| Notificaciones | Nuevos tipos de notificación | Baja |
| Frontend (no incluido) | Vistas de eventos, compra, validación | Alta |

---

## Conclusión

Menucom **NO puede** mantener organizadores de eventos y venta de tickets en su estado actual. La infraestructura base (NestJS, TypeORM, MercadoPago, Auth) está sólidamente establecida y puede ser aprovechada, pero **falta implementar el módulo completo de eventos** desde cero.

La integración con MercadoPago ya existe y es robusta, lo que facilita la implementación de pagos para tickets. El sistema de roles también es extensible para agregar `EVENT_ORGANIZER`.
