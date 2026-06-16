# Transparencia en la respuesta de órdenes

## Cómo se devuelven los detalles hoy

Toda orden se devuelve como la entidad `Order` de TypeORM con su relación `items` incluida.
No hay transformador ni mapper — se serializa directamente a JSON.

**Endpoints:**

| Endpoint | Uso |
|----------|-----|
| `GET /orders/:id` | Detalle de una orden individual |
| `GET /orders/byOwner` | Órdenes del comprador autenticado (paginado) |
| `GET /orders/byAnonymous` | Órdenes por `x-anonymous-id` |
| `GET /orders/byBusinessOwner/:ownerId` | Órdenes recibidas por un vendedor (paginado) |
| `POST /orders` | Crear orden, devuelve la orden creada |
| `GET /orders/admin/all` | Todas las órdenes (admin, paginado) |

---

## Fortalezas

### 1. Precios validados del lado del servidor
El backend ignora el `total` y `price` que envía el frontend y los recalcula con los precios reales de la base de datos (`discountPrice ?? price`). Esto evita manipulación de precios desde el cliente.

### 2. Relación items siempre incluida
Todos los métodos de consulta usan `relations: ['items']`, por lo que el array de productos siempre viaja en la respuesta. No hay llamadas adicionales para obtener los ítems.

### 3. Estructura plana y predecible
La orden se devuelve siempre con la misma forma, sin variaciones entre endpoints. El frontend puede tipificar una interfaz única (`OrderResponseDto`) y usarla en todos los casos.

### 4. Desglose de comisión del marketplace
Se incluyen `marketplaceFeePercentage` y `marketplaceFeeAmount`, lo que permite al vendedor entender cuánto retiene la plataforma.

### 5. Link de pago incluido
`paymentUrl` (init_point de MP) viene en la respuesta, permitiendo al frontend redirigir al checkout sin lógica adicional.

### 6. Trazabilidad con MP
`operationID` almacena el ID de la preferencia de MP, útil para conciliación y debugging.

---

## Debilidades (actuales)

~~Resueltas en migración `007` + código asociado.~~

---

## Estado actual de la implementación ✅

A continuación se detalla qué se implementó en las migraciones `006` y `007` y cambios de código asociados.

### Entidades modificadas

**`Order`** (`src/orders/entities/order.entity.ts`):

| Columna | Tipo | Nullable | Descripción |
|---------|------|----------|-------------|
| `mpProcessingFee` | `decimal(10,2)` | Sí | Comisión de procesamiento de MP extraída de `fee_details[mercadopago_fee]` |
| `netAmount` | `decimal(10,2)` | Sí | `net_amount` devuelto por MP = lo que realmente recibe el vendedor |
| `paymentStatus` | `varchar(50)` | Sí | 🆕 Estado del pago en MP (`approved`, `pending`, `rejected`). Migración `007`. |

**`PaymentIntent`** (`src/payments/entities/payment_intent_entity.ts`):

| Columna | Tipo | Nullable | Descripción |
|---------|------|----------|-------------|
| `mpProcessingFee` | `decimal(10,2)` | Sí | Suma de `fee_details` donde `type === 'mercadopago_fee'` |
| `mpFeeDetails` | `json` | Sí | Array completo de `fee_details` devuelto por MP |
| `mpNetAmount` | `decimal(10,2)` | Sí | `net_amount` de la respuesta del pago de MP |

### Cómo se genera la data

1. MP envía webhook de tipo `payment` con `data.id` = ID del pago en MP
2. `payment-webhook.service.ts` llama a `getPaymentInfo(paymentId)` que devuelve un `PaymentResponse`
3. Se extraen:
   - `paymentInfo.status` → estado del pago (`approved`, `pending`, `rejected`)
   - `paymentInfo.net_amount` → monto neto que recibe el vendedor
   - `paymentInfo.fee_details` → array con desglose de comisiones
4. Se filtra `fee_details` donde `type === 'mercadopago_fee'` y se suman los montos
5. Se persiste en `PaymentIntent` (via `updatePaymentFees()`)
6. Se persiste en `Order` (via `updateOrderPaymentFees()`):
   - `mpProcessingFee`, `netAmount`, **`paymentStatus`** ✅

**Vinculación:** El `external_reference` de la preferencia de MP es el UUID del `PaymentIntent`, que a su vez es el `operationID` de la `Order`.

### Endpoints que devuelven los nuevos campos

Todos los endpoints existentes que devuelven `Order` incluyen ahora `mpProcessingFee`, `netAmount` y `paymentStatus` automáticamente, dado que la entidad se serializa completa:

| Endpoint | ¿Incluye fees y paymentStatus? |
|----------|----------------|
| `GET /orders/:id` | ✅ Sí (cuando el webhook los pobló) |
| `GET /orders/byOwner` | ✅ Sí |
| `GET /orders/byBusinessOwner/:ownerId` | ✅ Sí |
| `POST /orders` | ❌ No (aún no hay pago) |
| `GET /orders/admin/all` | ✅ Sí |
| `PUT /orders/:id/status` | 🆕 Endpoint para que el vendedor avance la orden a `processing`, `shipped` o `delivered` |

### Response JSON real

```jsonc
{
  "id": "uuid-123-456",
  "customerEmail": "cliente@email.com",
  "customerName": "Juan",
  "customerLastName": "Pérez",
  "subtotal": 1200.00,
  "marketplaceFeePercentage": 5.5,
  "marketplaceFeeAmount": 66.00,
  "total": 1266.00,
  "mpProcessingFee": 45.58,          // ✅ NUEVO — comisión de MP
  "netAmount": 1154.42,              // ✅ NUEVO — neto para el vendedor
  "paymentStatus": "approved",       // ✅ NUEVO — estado del pago en MP
  "status": "confirmed",
  "items": [
    {
      "productName": "Hamburguesa Clásica",
      "quantity": 2,
      "price": 600.00,
      "sourceType": "menu"
    }
  ]
  // ... otros campos
}
```

Los campos `mpProcessingFee`, `netAmount` y `paymentStatus` son `null` hasta que MP confirma el pago y el webhook los popula.

---

## Transparencia para el vendedor

El vendedor (business owner) ahora puede ver:

> **¿Cuánto pagó el comprador? → `total: $1.266`**
> **¿Cuánto descuenta la plataforma? → `marketplaceFeeAmount: -$66`**
> **¿Cuánto descuenta MP? → `mpProcessingFee: -$45.58`**
> **¿Cuánto recibo yo? → `netAmount: $1.154,42`**

### Interpretación desde el frontend

```typescript
interface OrderForSeller {
  total: number;                // Lo que pagó el comprador
  marketplaceFeeAmount: number; // Comisión de la plataforma
  mpProcessingFee: number | null; // Comisión de MP (null si aún no se procesó)
  netAmount: number | null;     // Neto para el vendedor (null si aún no se procesó)
  paymentStatus: string | null; // Estado del pago en MP (approved, pending, rejected)
  status: string;               // Estado de cumplimiento (confirmed, processing, shipped, delivered)
  items: OrderItem[];
}
```

Regla de visualización:

| `paymentStatus` / `status` | Qué mostrar |
|----------------|-------------|
| `paymentStatus === "pending"` | "Pendiente de pago" — no mostrar fees |
| `paymentStatus === "approved"` | Mostrar desglose completo con `mpProcessingFee`, `netAmount` y `paymentStatus` |
| `paymentStatus === "rejected"` / `"refunded"` | No mostrar fees, el pago no se concretó |
| `status === "processing"` / `"shipped"` / `"delivered"` | El vendedor ya avanzó el cumplimiento. Mostrar estado actual |

### Vista sugerida para el vendedor (frontend)

```
┌─────────────────────────────────────────────┐
│  Resumen de ingresos — Orden #abcd1234      │
├─────────────────────────────────────────────┤
│                                              │
│  💰 Total pagado por el cliente:  $1,266.00 │
│                                              │
│  📦 Subtotal (productos):        $1,200.00   │
│  ─────────────────────────────────────────── │
│  📉 Comisión de Menucom (5.5%):   -$66.00   │
│  🏦 Comisión de MP (3.6% + IVA): -$45.58   │
│  ─────────────────────────────────────────── │
│  ✅ Neto que recibes:            $1,154.42  │
│                                              │
│  Estado: ✓ Confirmado (pago acreditado)      │
└─────────────────────────────────────────────┘
```

Cuando `mpProcessingFee` o `netAmount` son `null`, se puede mostrar un esqueleto (skeleton) o simplemente omitir la sección de desglose hasta que el webhook actualice los datos.

### Flujo de datos completo

```
POST /orders → Order creada con total, marketplaceFeeAmount
                mpProcessingFee = null, netAmount = null, paymentStatus = null

MP checkOut → Usuario paga

Webhook MP (payment) → GET /v1/payments/{paymentId}
                     → paymentInfo.status = "approved"
                     → paymentInfo.net_amount = 1154.42
                     → paymentInfo.fee_details = [{ type: "mercadopago_fee", amount: 45.58 }]
                     → Se actualiza PaymentIntent.mpProcessingFee, .mpFeeDetails, .mpNetAmount
                     → Se actualiza Order.mpProcessingFee, .netAmount, .paymentStatus ✅

GET /orders/byBusinessOwner/:ownerId → Ahora incluye mpProcessingFee, netAmount y paymentStatus

PUT /orders/:id/status → Vendedor cambia a processing/shipped/delivered
                         (solo si paymentStatus === "approved")
```

---

## DTO por rol: comprador vs vendedor

Se implementaron DTOs diferenciados vía `PickType` de Swagger para que cada endpoint exponga solo los campos relevantes a su rol.

### DTOs definidos

| DTO | Campos que incluye | Endpoints donde se usa |
|-----|-------------------|------------------------|
| `OrderForBuyerDto` | id, customerEmail, customerName, customerLastName, items, subtotal, total, status, paymentUrl, createdAt, updatedAt | `GET /orders/:id`, `GET /orders/byOwner`, `GET /orders/byAnonymous`, `POST /orders` |
| `OrderForSellerDto` | Todo lo del buyer + customerPhone, marketplaceFeePercentage, marketplaceFeeAmount, mpProcessingFee, netAmount, **paymentStatus** | `GET /orders/byBusinessOwner/:ownerId` |
| `OrderResponseDto` (completo) | Todos los campos de la entidad | `GET /orders/admin/all` |

### Ventajas

1. **Seguridad por diseño** — El comprador nunca recibe `mpProcessingFee` ni `netAmount`. El vendedor nunca recibe `paymentUrl` (ya usó el suyo). Cada rol ve solo lo que necesita.

2. **Documentación Swagger precisa** — Cada endpoint documenta exactamente los campos que devuelve. El frontend puede generar tipos cliente específicos por endpoint sin ambigüedad.

3. **Cero costo en runtime** — `PickType` opera en tiempo de definición (decoradores). La serialización sigue siendo la entidad directamente. No hay transformadores, mappers ni pipelines adicionales.

4. **Mantenible** — Los DTOs por rol heredan decoradores del DTO base (`OrderResponseDto`). Si se agrega un campo nuevo, solo se actualiza el DTO base y cada rol lo incluye o excluye explícitamente en su `PickType`.

5. **Extensible** — Agregar un nuevo rol (ej. `OrderForAdminDto`) es tan simple como agregar un `PickType` con los campos que necesita el panel de administración.

### Cómo funcionan en el código

```typescript
// order-response.dto.ts
export class OrderForBuyerDto extends PickType(OrderResponseDto, [
  'id', 'customerEmail', 'items', 'subtotal', 'total', 'status',
  'paymentUrl', 'createdAt', 'updatedAt',
] as const) {}

export class OrderForSellerDto extends PickType(OrderResponseDto, [
  'id', 'customerEmail', 'customerPhone', 'items', 'subtotal', 'total',
  'marketplaceFeePercentage', 'marketplaceFeeAmount',
  'mpProcessingFee', 'netAmount', 'status', 'paymentStatus',
  'createdAt', 'updatedAt',
] as const) {}
```

El controlador referencia el DTO apropiado en `@ApiOkResponse`:

```typescript
@Get('byBusinessOwner/:ownerId')
@ApiOkResponse({ type: OrderForSellerDto, isArray: true })
async findByOwnerId(...) { ... }
```

El runtime sigue devolviendo la entidad `Order` serializada; los DTOs son solo contratos de documentación. Para una separación real en runtime (ej. ocultar campos internos), aplicar un transformer (ClassSerializerInterceptor) sigue siendo una mejora futura.

---

## Estado de pago vs estado de orden

### El problema

Hoy `Order.status` es un solo campo que mezcla dos conceptos distintos:

| Concepto | Qué significa | Quién lo controla | Valores |
|----------|--------------|-------------------|---------|
| **Estado de pago** | Si el comprador pagó, está procesando, o le rechazaron | MercadoPago (webhook) | `pending`, `approved`, `rejected`, `refunded` |
| **Estado de cumplimiento** | En qué etapa está la preparación y entrega | El comerciante (vendedor) | `confirmed`, `processing`, `shipped`, `delivered` |

Actualmente el webhook de MP escribe directamente sobre `Order.status`, mezclando ambos dominios:

```
MP dice "approved"  → Order.status = "confirmed"  (cumplimiento arranca)
MP dice "rejected"  → Order.status = "cancelled"   (orden cancelada)
```

El comerciante **no tiene forma** de mover la orden a `processing`, `shipped` o `delivered`. Esos estados existen en el enum `OrderStatus` pero ningún endpoint los usa.

### Lo que se agregó

El DTO `OrderForSellerDto` ahora incluye `paymentStatus` como campo documentado:

```typescript
@ApiProperty({
  example: 'approved',
  description: 'Estado del pago en MercadoPago. Independiente del status de la orden.',
  required: false,
})
paymentStatus?: string;
```

Esto permite que el frontend del vendedor muestre ambas cosas:

```
┌─────────────────────────────────────────────┐
│  Resumen de ingresos — Orden #abcd1234      │
├─────────────────────────────────────────────┤
│  Estado del pago:  ✅ Aprobado (MP)          │
│  Estado de la orden: 🟡 En preparación       │
│  ─────────────────────────────────────────── │
│  Total pagado: $1,266.00                     │
│  Neto a recibir: $1,154.42                   │
└─────────────────────────────────────────────┘
```

### Estado real del `paymentStatus` en runtime ✅

| Situación | `paymentStatus` en la respuesta |
|-----------|--------------------------------|
| Hoy | `"approved"`, `"rejected"`, `"pending"` — el webhook persiste el estado de MP en `Order.paymentStatus` |

Se implementó la **opción A (desnormalizar)** por simplicidad y rendimiento en consultas.

### Reglas de negocio implementadas ✅

El comerciante puede cambiar `Order.status` a `processing` → `shipped` → `delivered` mediante:

1. **`PUT /orders/:id/status`** — endpoint con DTO `UpdateOrderStatusDto` que acepta `{ status: OrderStatus }`
2. **Validación de pago** — rechaza la transición si `paymentStatus !== "approved"`
3. **Transiciones válidas** — solo `confirmed → processing → shipped → delivered`, sin saltos ni reversiones. Estados finales (`delivered`, `cancelled`, `failed`) no permiten cambios.

---

## Próximos pasos (futuros)

| Prioridad | Acción | Estado | Impacto |
|-----------|--------|--------|---------|
| 🟢 Completa | Metadatos de paginación en endpoints list | ✅ `ResponseTransformInterceptor` + `findAndCount` | Frontend recibe `{ data, pagination: { page, limit, total, totalPages, hasNext, hasPrev } }` |
| 🟢 Completa | Persistir `paymentStatus` en Order y endpoint para que el comerciante actualice estado de cumplimiento | ✅ Migración `007` + `PUT /orders/:id/status` | Separación pago/cumplimiento; vendedor gestiona la orden |
| 🟢 Completa | Response wrapper estándar | ✅ `ResponseTransformInterceptor` en `main.ts` | Todas las respuestas HTTP envueltas en `{ statusCode, data, message }` |
| 🟢 Completa | `paymentStatus` en runtime | ✅ Webhook persiste `paymentStatus` en `Order` | El frontend del vendedor recibe el estado de MP |
| 🟢 Completa | Reglas de transición de cumplimiento | ✅ Validación en service | Solo avance lineal si pago approved |
