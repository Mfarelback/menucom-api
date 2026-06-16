# Sistema de Membresías con Mercado Pago - Integración Completa

## Estado de la Integración ✅

- **AppID**: 3187197425165664
- **Tipo**: Suscripciones
- **Webhooks**: ✅ Configurados

### Webhooks Configurados:

| Topic                             | Estado |
| --------------------------------- | ------ |
| `payment`                         | ✅     |
| `subscription_authorized_payment` | ✅     |
| `subscription_preapproval`        | ✅     |
| `subscription_preapproval_plan`   | ✅     |

**URL**: `https://menucom-api.onrender.com/webhook/mercadopago`

---

## Arquitectura

### Flujo de Suscripción:

```
1. User → POST /membership/subscribe-with-card
2. API → MercadoPago (preapproval) → Init Point
3. User completa pago en MP
4. Webhook → Actualiza membership en DB
```

### Modelo de Datos:

#### Membership (extend):

| Campo                | Tipo    | Descripción                   |
| -------------------- | ------- | ----------------------------- |
| `mpPreapprovalId`    | string  | ID del preapproval en MP      |
| `subscriptionStatus` | enum    | authorized, paused, cancelled |
| `discountCode`       | string? | Código de descuento           |
| `discountPercentage` | number? | Porcentaje aplicado           |
| `originalPrice`      | number? | Precio sin descuento          |
| `nextBillingDate`    | Date?   | Próxima fecha de cobro        |
| `lastPaymentAt`      | Date?   | Último pago exitoso           |
| `paymentMethodId`    | string? | Método de pago guardado       |

#### SubscriptionDiscount:

| Campo             | Tipo     | Descripción       |
| ----------------- | -------- | ----------------- |
| `code`            | string   | Código único      |
| `type`            | enum     | percentage, fixed |
| `value`           | number   | Monto/porcentaje  |
| `validFrom`       | Date     | Inicio validez    |
| `validUntil`      | Date     | Fin validez       |
| `maxUses`         | number   | Usos máximos      |
| `usedCount`       | number   | Veces usado       |
| `applicablePlans` | string[] | Planes aplicables |

#### SubscriptionPayment:

| Campo          | Tipo   | Descripción                 |
| -------------- | ------ | --------------------------- |
| `membershipId` | string | Relación membresía          |
| `mpPaymentId`  | string | ID del pago MP              |
| `amount`       | number | Monto cobrado               |
| `status`       | enum   | approved, pending, rejected |
| `paidAt`       | Date?  | Fecha de cobro              |

---

## Endpoints de API

### Endpoints de Usuario:

| Método | Path                              | Descripción                      |
| ------ | --------------------------------- | -------------------------------- |
| GET    | `/membership`                     | Obtener membresía actual         |
| POST   | `/membership/subscribe`           | Suscribirse a plan               |
| PUT    | `/membership`                     | Actualizar plan                  |
| DELETE | `/membership/cancel`              | Cancelar membresía               |
| GET    | `/membership/limits`              | Ver límites del plan             |
| GET    | `/membership/audit`               | Historial de cambios             |
| GET    | `/membership/stats`               | Estadísticas                     |
| GET    | `/membership/plans`               | Planes disponibles               |
| GET    | `/membership/custom-plans`        | Planes personalizados            |
| POST   | `/membership/subscribe-custom`    | Suscribirse a plan personalizado |
| POST   | `/membership/create-payment`      | Crear pago MP                    |
| POST   | `/membership/subscribe-with-card` | Suscribirse con tarjeta          |
| GET    | `/membership/status`              | Estado de suscripción MP         |
| POST   | `/membership/apply-discount`      | Aplicar descuento                |
| DELETE | `/membership/subscription`        | Cancelar suscripción MP          |
| POST   | `/membership/subscription/pause`  | Pausar suscripción               |
| POST   | `/membership/subscription/resume` | Reanudar suscripción             |

### Endpoints de Administrador:

| Método | Path                                       | Descripción             |
| ------ | ------------------------------------------ | ----------------------- |
| GET    | `/admin/subscription-plans`                | Listar planes           |
| POST   | `/admin/subscription-plans`                | Crear plan              |
| GET    | `/admin/subscription-plans/:id`            | Ver plan                |
| PUT    | `/admin/subscription-plans/:id`            | Actualizar plan         |
| DELETE | `/admin/subscription-plans/:id`            | Eliminar plan           |
| GET    | `/admin/discounts`                         | Listar descuentos       |
| POST   | `/admin/discounts`                         | Crear descuento         |
| PUT    | `/admin/discounts/:id`                     | Actualizar descuento    |
| DELETE | `/admin/discounts/:id`                     | Eliminar descuento      |
| GET    | `/admin/subscriptions`                     | Listar suscripciones    |
| GET    | `/admin/subscriptions/:userId`             | Ver suscripción usuario |
| POST   | `/admin/subscriptions/:userId/pause`       | Pausar                  |
| POST   | `/admin/subscriptions/:userId/resume`      | Reanudar                |
| POST   | `/admin/subscriptions/:userId/cancel`      | Cancelar                |
| POST   | `/admin/subscriptions/:userId/change-plan` | Cambiar plan            |

---

## DTOs

### SubscribeWithCardDto:

```typescript
{
  plan: MembershipPlan;        // PREMIUM | ENTERPRISE
  cardTokenId: string;         // Token de tarjeta MP
  discountCode?: string;      // Código de descuento opcional
}
```

### SubscriptionStatusResponseDto:

```typescript
{
  isActive: boolean;
  plan: MembershipPlan;
  status: string;
  amount: number;
  currency: string;
  originalPrice?: number;
  discountPercentage?: number;
  nextBillingDate?: string;
  lastPaymentAt?: string;
  paymentMethodId?: string;
  hasDiscount: boolean;
  discountCode?: string;
}
```

### CancelSubscriptionResponseDto:

```typescript
{
  success: boolean;
  message: string;
  cancelledAt: Date;
}
```

---

## Servicios

### MercadoPagoSubscriptionService:

- `createPreapproval(params)` → Crea preapproval en MP
- `getPreapproval(id)` → Obtiene estado
- `pauseSubscription(id)` → Pausa facturación
- `resumeSubscription(id)` → Reanuda facturación
- `cancelSubscription(id)` → Cancela suscripción
- `getPlanPrice(plan)` →Precio del plan

### SubscriptionDiscountService:

- `validateDiscount(code, plan, userId)` → Valida descuento
- `applyDiscount(membershipId, code)` → Aplica descuento
- `createDiscount(data)` → Crea descuento
- `getDiscounts()` → Lista descuentos
- `updateDiscount(id, data)` → Actualiza descuento
- `deleteDiscount(id)` → Elimina descuento

---

## Webhooks

### Eventos Manejados:

| Evento                                       | Acción                 |
| -------------------------------------------- | ---------------------- |
| `payment.created`                            | Crear registro de pago |
| `payment.updated`                            | Actualizar estado      |
| `subscription_preapproval.created`           | Guardar preapproval ID |
| `subscription_preapproval.updated`           | Actualizar estado      |
| `subscription_authorized_payment.authorized` | Activar suscripción    |
| `subscription_authorized_payment.pending`    | Esperar pago           |
| `subscription_authorized_payment.cancelled`  | Cancelar               |

### Ejemplo payload webhook:

```json
{
  "type": "subscription_authorized_payment",
  "data": {
    "id": "1234567890"
  },
  "date_created": "2024-01-15T10:00:00Z",
  "preapproval_id": "preapproval_abc123",
  "merchant_order_id": "1234567890",
  "status": "authorized"
}
```

---

## Notas

1. **Tokens**: Usar `MP_ACCESS_TOKEN` (no `MERCADOPAGO_ACCESS_TOKEN`)
2. **Cuenta real**: Los webhooks de suscripción requieren cuenta de vendedor verificada
3. **Testing**: Usar sandbox hasta tener cuenta productiva
4. **Límites por plan**:
   - FREE: 10 items, 1 wardrobe
   - PREMIUM: 500 items, 5 wardrobes
   - ENTERPRISE: unlimited

---

## Progreso

| Fase              | Estado                  |
| ----------------- | ----------------------- |
| Modelo de datos   | ✅ Completado           |
| Servicios MP      | ✅ Completado           |
| Webhooks          | ✅ Completado           |
| Endpoints usuario | ✅ Completado           |
| Endpoints admin   | ⏳ Pendiente (opcional) |
