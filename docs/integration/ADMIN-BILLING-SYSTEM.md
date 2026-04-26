# Sistema de Facturación Híbrido para Membresías - Menucom API

> **Fecha de implementación**: 2026-04-25
> **Estado**: ✅ Implementado

## Resumen

El admin controla completamente la facturación de membresías con dos modos de operación:

| Modo | Descripción | Cobro Automático | Caso de Uso |
|------|-------------|-------------------|-------------|
| **MANUAL** | Genera links de pago únicos | ❌ No | Descuentos especiales, trials, pagos únicos |
| **AUTO** | Preapproval en MP para suscripciones | ✅ Sí | Membresías recurring mensuales |

---

## 1. Cambios en Entidades

### 1.1 Membership Entity - Nuevos Campos

**Archivo**: `src/membership/entities/membership.entity.ts`

```typescript
// Billing mode - Control de facturación
export enum BillingMode {
  NONE = 'none',           // Sin facturación activa (plan FREE o sin cobrar)
  MANUAL = 'manual',       // Pagos únicos (links de pago)
  AUTO = 'auto',           // Suscripción automática (preapproval)
}

export class Membership {
  // ... campos existentes ...

  // === BILLING MODE ===
  @Column({
    type: 'enum',
    enum: BillingMode,
    default: BillingMode.NONE
  })
  billingMode: BillingMode;

  // Precio override definido por admin (ignora precio del plan)
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  adminSetPrice: number;

  // Período pagado actual (en meses)
  @Column({ type: 'int', default: 1 })
  paidPeriodMonths: number;

  // === PENDING PAYMENT (para links de pago manual) ===
  @Column({ type: 'varchar', nullable: true })
  pendingPaymentId: string;      // MP Payment ID

  @Column({ type: 'varchar', nullable: true })
  pendingPaymentLink: string;    // URL del link de pago

  @Column({ type: 'timestamp', nullable: true })
  pendingPaymentExpiresAt: Date; // Expiración del link

  // === ACCESS PERIOD ===
  @Column({ type: 'timestamp', nullable: true })
  accessStartDate: Date;          // Inicio del período pagado
}
```

### 1.2 SubscriptionPayment Entity - Nuevos Campos

**Archivo**: `src/membership/entities/subscription-payment.entity.ts`

```typescript
export enum PaymentType {
  SUBSCRIPTION_PAYMENT = 'subscription_payment',
  FIRST_PAYMENT = 'first_payment',
  TRIAL = 'trial',
  MANUAL_PAYMENT = 'manual_payment',  // NUEVO: Pago único vía link
}

export class SubscriptionPayment {
  // ... campos existentes ...

  // Período que cubre este pago (en meses)
  @Column({ type: 'int', default: 1 })
  periodMonths: number;

  // Si fue generado por admin
  @Column({ type: 'boolean', default: false })
  isAdminGenerated: boolean;

  // ID del plan asociado
  @Column({ type: 'varchar', nullable: true })
  planName: string;

  // Descripción del cargo
  @Column({ type: 'varchar', nullable: true })
  description: string;

  // Metadata del pago
  @Column({ type: 'json', nullable: true })
  paymentMetadata: Record<string, any>;
}
```

---

## 2. Nuevos Endpoints del Admin

### 2.1 Generar Link de Pago Manual

```
POST /admin/memberships/generate-payment-link
```

**Request Body**:
```json
{
  "userId": "user_xxx",
  "plan": "premium",
  "amount": 12000,
  "periodMonths": 1,
  "description": "Premium + descuento especial 20%"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "paymentId": "mp_payment_123456",
    "paymentLink": "https://www.mercadopago.com.ar/checkout/v1/...",
    "amount": 12000,
    "currency": "ARS",
    "periodMonths": 1,
    "expiresAt": "2026-05-25T00:00:00Z",
    "status": "pending",
    "membership": {
      "id": "uuid-xxx",
      "plan": "premium",
      "pendingPaymentId": "mp_payment_123456",
      "billingMode": "MANUAL"
    }
  }
}
```

### 2.2 Habilitar Auto-Billing (Suscripción)

```
POST /admin/memberships/enable-auto-billing
```

**Request Body**:
```json
{
  "userId": "user_xxx",
  "plan": "premium",
  "amount": 15000,
  "cardTokenId": "tok_xxx",
  "billingCycle": "monthly"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "preapprovalId": "preapproval_xxx",
    "status": "authorized",
    "billingMode": "AUTO",
    "nextBillingDate": "2026-05-25T00:00:00Z",
    "membership": {
      "id": "uuid-xxx",
      "plan": "premium",
      "mpPreapprovalId": "preapproval_xxx",
      "billingMode": "AUTO",
      "isActive": true
    }
  }
}
```

### 2.3 Cambiar Precio de Facturación (Preapproval)

```
PATCH /admin/memberships/:membershipId/billing-amount
```

**Request Body**:
```json
{
  "newAmount": 18000
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "membershipId": "uuid-xxx",
    "previousAmount": 15000,
    "newAmount": 18000,
    "effectiveFrom": "2026-04-25T00:00:00Z",
    "nextBillingDate": "2026-05-25T00:00:00Z"
  }
}
```

### 2.4 Migrar de Manual a Auto

```
POST /admin/memberships/:membershipId/migrate-to-auto-billing
```

**Request Body**:
```json
{
  "cardTokenId": "tok_xxx"
}
```

### 2.5 Migrar de Auto a Manual

```
POST /admin/memberships/:membershipId/migrate-to-manual
```

Cancela el preapproval en MP y limpia `mpPreapprovalId`.

### 2.6 Ver Detalles de Facturación

```
GET /admin/memberships/:membershipId/billing-details
```

**Response**:
```json
{
  "membershipId": "uuid-xxx",
  "userId": "user_xxx",
  "billingMode": "AUTO",
  "currentPlan": {
    "name": "premium",
    "displayName": "Premium Mensual",
    "basePrice": 15000
  },
  "effectivePrice": 12000,
  "adminSetPrice": 12000,
  "autoBilling": {
    "mpPreapprovalId": "preapproval_xxx",
    "status": "authorized",
    "nextBillingDate": "2026-05-25T00:00:00Z",
    "lastPaymentAt": "2026-04-25T10:30:00Z",
    "paymentMethodId": "137894525"
  },
  "manualBilling": {
    "pendingPaymentId": null,
    "pendingPaymentLink": null,
    "pendingPaymentExpiresAt": null
  },
  "paymentHistory": [
    {
      "id": "payment_uuid",
      "date": "2026-04-25T10:30:00Z",
      "amount": 12000,
      "status": "approved",
      "type": "MANUAL_PAYMENT",
      "periodMonths": 1
    }
  ]
}
```

---

## 3. Flujo Completo

### 3.1 Admin Genera Link Manual

```
┌─────────┐     ┌─────────┐     ┌──────────────┐     ┌────────────┐     ┌──────────┐
│  ADMIN  │     │   API   │     │   Mercado    │     │   USUARIO  │     │  WEBHOOK │
│         │     │         │     │    Pago      │     │            │     │          │
└─────────┘     └─────────┘     └──────────────┘     └────────────┘     └──────────┘
    │               │                │                  │                 │
    │ Gen link      │                │                  │                 │
    │──────────────>│                │                  │                 │
    │               │                │                  │                 │
    │               │ Create Payment │                  │                 │
    │               │───────────────>                  │                 │
    │               │                │                  │                 │
    │               │ paymentLink    │                  │                 │
    │<──────────────│<───────────────                  │                 │
    │               │                │                  │                 │
    │ Envía link    │                │                  │                 │
    │───────────────│                │                  │                 │
    │               │                │                  │                 │
    │               │                │   Paga (opcional) │                 │
    │               │                │<──────────────────│                 │
    │               │                │                  │                 │
    │               │                │   Notifica       │                 │
    │               │                │──────────────────>│                 │
    │               │                │                  │                 │
    │               │                │   getPayment(id) │                 │
    │               │                │<─────────────────│                 │
    │               │                │                  │                 │
    │               │  Update membership                 │                 │
    │               │  - expiresAt + periodMonths       │                 │
    │               │  - Clear pendingPaymentId         │                 │
    │               │  - accessStartDate = now           │                 │
    │               │  - Create subscription_payment    │                 │
    │               │<──────────────────────────────────│                 │
    │               │                │                  │                 │
```

### 3.2 Admin Habilita Auto-Billing

```
┌─────────┐     ┌─────────┐     ┌──────────────┐     ┌────────────┐
│  ADMIN  │     │   API   │     │   Mercado    │     │  WEBHOOK   │
│         │     │         │     │    Pago      │     │            │
└─────────┘     └─────────┘     └──────────────┘     └────────────┘
    │               │                │                  │
    │ Enable auto   │                │                  │
    │──────────────>│                │                  │
    │               │                │                  │
    │               │ createPreapproval (con cardToken)│
    │               │──────────────────────────────────>│
    │               │                │                  │
    │               │ preapprovalId  │                  │
    │               │<──────────────────────────────────│
    │               │                │                  │
    │               │ Update membership                 │
    │               │ - mpPreapprovalId                 │
    │               │ - billingMode = AUTO              │
    │               │ - amount = newAmount               │
    │               │ - isActive = true                  │
    │               │ - expiresAt = +1 mes              │
    │               │<──────────────────────────────────│
    │               │                │                  │
    │               │                │ (futuros cobros)  │
    │               │                │<──────────────────│
    │               │                │                  │
    │               │  Cada mes: Update membership       │
    │               │  - nextBillingDate = +1 mes      │
    │               │  - expiresAt = +1 mes            │
    │               │  - Create subscription_payment   │
    │               │<──────────────────────────────────│
    │               │                │                  │
```

### 3.3 Admin Cambia Precio (Auto-Billing Activo)

```
┌─────────┐     ┌─────────┐     ┌──────────────┐
│  ADMIN  │     │   API   │     │   Mercado    │
│         │     │         │     │    Pago      │
└─────────┘     └─────────┘     └──────────────┘
    │               │                │
    │ Change amount│                │
    │──────────────>│                │
    │               │                │
    │               │ updatePreapproval             │
    │               │ (transaction_amount: newAmount)
    │               │────────────────>│
    │               │                │
    │               │ success        │
    │               │<───────────────��│
    │               │                │
    │               │ Update membership
    │               │ - amount = newAmount
    │               │ - adminSetPrice = newAmount
    │               │<────────────────│
    │               │                │
```

---

## 4. Estados del Sistema

### 4.1 Membership.billingMode

| Valor | Significado |
|-------|-------------|
| `NONE` | Sin facturación (plan FREE o acceso sin cobro) |
| `MANUAL` | Pagos únicos vía link de Mercado Pago |
| `AUTO` | Suscripción automática con preapproval |

### 4.2 Membership.subscriptionStatus (para AUTO)

| Valor | Significado |
|-------|-------------|
| `pending` | Preapproval creado, esperando primer cobro |
| `authorized` | Activo y cobrando automáticamente |
| `paused` | Pausado (no se cobra, pero sigue activo) |
| `cancelled` | Cancelado (no se cobra, inactivo) |

### 4.3 Pending Payment (para MANUAL)

| Estado | Significado |
|--------|-------------|
| `pendingPaymentId != null` | Link de pago generado, esperando pago |
| `pendingPaymentId == null` | Sin link pendiente |

---

## 5. Lógica de Negocio

### 5.1 Extender Membresía (al recibir pago)

```typescript
async extendMembership(membershipId: string, paymentAmount: number, periodMonths: number) {
  const membership = await this.membershipRepo.findOne({ where: { id: membershipId } });

  const currentExpires = membership.expiresAt || new Date();
  const newExpires = new Date(currentExpires);

  if (membership.billingMode === BillingMode.MANUAL) {
    // Pago manual: extiende desde fecha actual
    newExpires.setMonth(newExpires.getMonth() + periodMonths);
  } else {
    // Pago automático: extiende desde última fecha de expiración
    newExpires.setMonth(newExpires.getMonth() + periodMonths);
  }

  membership.expiresAt = newExpires;
  membership.lastPaymentAt = new Date();
  membership.isActive = true;
  membership.accessStartDate = new Date();

  // Limpiar pending payment si existe
  if (membership.pendingPaymentId) {
    membership.pendingPaymentId = null;
    membership.pendingPaymentLink = null;
    membership.pendingPaymentExpiresAt = null;
  }

  await this.membershipRepo.save(membership);
}
```

### 5.2 Validar Accesos

```typescript
canAccessFeature(membership: Membership, feature: MembershipFeature): boolean {
  // 1. Verificar que esté activa
  if (!membership.isActive) return false;

  // 2. Verificar que no haya expirado
  if (membership.expiresAt && new Date() > membership.expiresAt) {
    return false;
  }

  // 3. Verificar features del plan
  return membership.features?.includes(feature) || false;
}
```

### 5.3 Migrar de MANUAL a AUTO

```typescript
async migrateToAutoBilling(membershipId: string, cardTokenId: string) {
  const membership = await this.membershipRepo.findOne({ where: { id: membershipId } });

  // 1. Limpiar pending payment si existe
  membership.pendingPaymentId = null;
  membership.pendingPaymentLink = null;
  membership.pendingPaymentExpiresAt = null;

  // 2. Crear preapproval con la tarjeta
  const preapproval = await this.mpSubscriptionService.createPreapproval({
    userId: membership.userId,
    userEmail: membership.user.email,
    plan: membership.plan,
    price: membership.adminSetPrice || membership.amount,
    cardTokenId,
  });

  // 3. Actualizar membership
  membership.billingMode = BillingMode.AUTO;
  membership.mpPreapprovalId = preapproval.preapprovalId;
  membership.subscriptionStatus = preapproval.status;

  await this.membershipRepo.save(membership);
}
```

### 5.4 Migrar de AUTO a MANUAL

```typescript
async migrateToManualBilling(membershipId: string) {
  const membership = await this.membershipRepo.findOne({ where: { id: membershipId } });

  // 1. Cancelar preapproval en MP
  if (membership.mpPreapprovalId) {
    await this.mpSubscriptionService.cancelSubscription(membership.mpPreapprovalId);
  }

  // 2. Actualizar membership
  membership.billingMode = BillingMode.MANUAL;
  membership.mpPreapprovalId = null;
  membership.subscriptionStatus = null;

  await this.membershipRepo.save(membership);
}
```

---

## 6. Webhooks - Procesamiento

### 6.1 Payment (pago único manual)

```typescript
private async handlePaymentWebhook(paymentId: string, action: string) {
  const paymentInfo = await this.mercadoPagoService.getPaymentStatus(paymentId);
  const { status, transaction_amount, metadata } = paymentInfo;

  if (status === 'approved') {
    // Buscar membership por external_reference
    const membership = await this.findMembershipByPayment(paymentId);

    if (membership) {
      const periodMonths = metadata?.period_months || 1;
      const billingMode = metadata?.billing_mode || 'manual';

      if (billingMode === 'manual') {
        // Extender membership por período pagado
        await this.extendMembership(membership.id, transaction_amount, periodMonths);

        // Registrar pago
        await this.paymentRepository.save({
          membershipId: membership.id,
          mpPaymentId: paymentId,
          amount: transaction_amount,
          status: PaymentStatus.APPROVED,
          type: PaymentType.MANUAL_PAYMENT,
          periodMonths,
          isAdminGenerated: true,
          planName: metadata?.plan,
          description: metadata?.description,
          paidAt: new Date(),
        });
      }
    }
  }
}
```

### 6.2 Subscription Authorized Payment (cobro automático)

```typescript
private async handleSubscriptionPaymentWebhook(paymentId: string) {
  // Buscar membership por mpPreapprovalId
  const payment = await this.findPaymentById(paymentId);
  const membership = await this.findMembershipByPreapproval(payment.preapproval_id);

  if (membership && payment.status === 'approved') {
    // Extender membership
    await this.extendMembership(membership.id, payment.transaction_amount, 1);

    // Registrar pago
    await this.paymentRepository.save({
      membershipId: membership.id,
      mpPaymentId: paymentId,
      mpPreapprovalId: membership.mpPreapprovalId,
      amount: payment.transaction_amount,
      status: PaymentStatus.APPROVED,
      type: PaymentType.SUBSCRIPTION_PAYMENT,
      periodMonths: 1,
      isAdminGenerated: false,
      paidAt: new Date(),
    });
  }
}
```

---

## 7. DTOs Necesarios

### 7.1 GeneratePaymentLinkDto

```typescript
export class GeneratePaymentLinkDto {
  @IsNotEmpty()
  @IsUUID()
  userId: string;

  @IsNotEmpty()
  @IsString()
  plan: string;

  @IsNumber()
  @Min(0)
  amount: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  periodMonths?: number = 1;

  @IsOptional()
  @IsString()
  description?: string;
}
```

### 7.2 EnableAutoBillingDto

```typescript
export class EnableAutoBillingDto {
  @IsNotEmpty()
  @IsUUID()
  userId: string;

  @IsNotEmpty()
  @IsString()
  plan: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;

  @IsNotEmpty()
  @IsString()
  cardTokenId: string;

  @IsOptional()
  @IsString()
  billingCycle?: 'monthly' | 'yearly' = 'monthly';
}
```

### 7.3 ChangeBillingAmountDto

```typescript
export class ChangeBillingAmountDto {
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  newAmount: number;

  @IsOptional()
  @IsString()
  reason?: string;
}
```

### 7.4 BillingDetailsResponseDto

```typescript
export class BillingDetailsResponseDto {
  membershipId: string;
  userId: string;
  billingMode: BillingMode;
  currentPlan: {
    name: string;
    displayName: string;
    basePrice: number;
  };
  effectivePrice: number;
  adminSetPrice: number | null;
  autoBilling: {
    mpPreapprovalId: string | null;
    status: string | null;
    nextBillingDate: Date | null;
    lastPaymentAt: Date | null;
    paymentMethodId: string | null;
  };
  manualBilling: {
    pendingPaymentId: string | null;
    pendingPaymentLink: string | null;
    pendingPaymentExpiresAt: Date | null;
  };
  paymentHistory: SubscriptionPaymentResponseDto[];
}
```

---

## 8. Resumen de Acciones del Admin

| Acción | Endpoint | Efecto en MP | Efecto en DB |
|--------|----------|-------------|--------------|
| Asignar plan | `POST .../assign/:plan` | ❌ Nada | Actualiza plan, features |
| Generar link | `POST .../generate-payment-link` | Crea Payment | pendingPaymentId + link |
| Habilitar auto | `POST .../enable-auto-billing` | Crea Preapproval | mpPreapprovalId + billingMode=AUTO |
| Cambiar precio | `PATCH .../billing-amount` | Update Preapproval | adminSetPrice + amount |
| Pausar | `PATCH .../pause` | Update Preapproval (paused) | subscriptionStatus=paused |
| Reanudar | `PATCH .../resume` | Update Preapproval (authorized) | subscriptionStatus=authorized |
| Cancelar | `DELETE .../subscription` | Cancel Preapproval | billingMode=NONE |
| Migrar a manual | `POST .../migrate-to-manual` | Cancel Preapproval | billingMode=MANUAL |
| Migrar a auto | `POST .../migrate-to-auto-billing` | Crea Preapproval | billingMode=AUTO |

---

## 9. Diagrama de Estados

```
                    ┌──────────────────────────────────────┐
                    │                                      │
                    │         MEMBERSHIP                   │
                    │                                      │
                    └──────────────────────────────────────┘
                                      │
              ┌───────────────────────┼───────────────────────┐
              │                       │                       │
              ▼                       ▼                       ▼
       ┌─────────────┐         ┌─────────────┐         ┌─────────────┐
       │ billingMode│         │ billingMode│         │ billingMode │
       │    = NONE  │         │  = MANUAL  │         │   = AUTO    │
       └─────────────┘         └─────────────┘         └─────────────┘
              │                       │                       │
              │                       │                       │
    ┌─────────┴─────────┐     ┌────────┴────────┐     ┌────────┴────────┐
    │                   │     │                │     │                │
    ▼                   ▼     ▼                ▼     ▼                ▼
┌─────────┐      ┌─────────┐ ┌─────────┐   ┌─────────┐ ┌─────────┐ ┌─────────┐
│ FREE    │      │ PAID    │ │ pending │   │ paid    │ │pending  │ │active  │
│(sin     │      │(granted │ │ payment │   │(expires │ │ preapp. │ │(auto   │
│cobro)   │      │ por     │ │ link    │   │ se      │ │         │ │billing)│
│         │      │ admin)  │ │ activo) │   │ extiende)│         │         │
└─────────┘      └─────────┘ └─────────┘   └─────────┘ └─────────┘ └─────────┘
                         │
                         ▼
                  ┌─────────────┐
                  │ payment     │
                  │ approved    │
                  │ (webhook)   │
                  └─────────────┘
                         │
                         ▼
                  ┌─────────────┐
                  │ paid        │
                  │ (expiresAt  │
                  │ actualizado)│
                  └─────────────┘
```

---

## 10. Checklist de Implementación

- [ ] Agregar `BillingMode` enum
- [ ] Agregar campos a `Membership` entity
- [ ] Agregar campos a `SubscriptionPayment` entity
- [ ] Crear DTOs para nuevos endpoints
- [ ] Crear `BillingAdminService`
- [ ] Agregar endpoints al controller
- [ ] Crear método `createManualPayment()` en `MercadoPagoService`
- [ ] Crear método `extendMembership()` en `MembershipService`
- [ ] Actualizar webhook para manejar `MANUAL_PAYMENT`
- [ ] Agregar logs de auditoría para acciones de billing
- [ ] Tests unitarios
- [ ] Tests E2E

---

## 11. Ejecución de Migración

```bash
# Ubicación del archivo de migración
src/scripts/migrations/003_add_billing_fields.sql

# Para ejecutar en Supabase:
# 1. Ir al dashboard de Supabase
# 2. SQL Editor
# 3. Copiar y ejecutar el contenido del archivo .sql

# O usando la herramienta de migración del proyecto:
npm run migration:execute
```

## 12. Archivos Creados/Modificados

### Backend (Menucom API)

| Archivo | Acción |
|---------|--------|
| `src/membership/entities/membership.entity.ts` | Modificado: Agregados campos billingMode, adminSetPrice, etc. |
| `src/membership/entities/subscription-payment.entity.ts` | Modificado: Agregados campos periodMonths, isAdminGenerated, etc. |
| `src/membership/dto/billing.dto.ts` | **NUEVO**: DTOs para billing |
| `src/membership/services/billing-admin.service.ts` | **NUEVO**: Lógica de facturación |
| `src/membership/controllers/membership-admin.controller.ts` | Modificado: Agregados endpoints de billing |
| `src/membership/payment/mercado-pago.service.ts` | Modificado: Método createCustomPayment |
| `src/membership/controllers/membership-webhook.controller.ts` | Modificado: handlePaymentWebhook mejorado |
| `src/membership/index.ts` | Modificado: Exports de BillingMode y billing.dto |
| `src/membership/membership.module.ts` | Modificado: Agregado BillingAdminService |
| `src/scripts/migrations/003_add_billing_fields.sql` | **NUEVO**: Script de migración |

### Frontend (Menu Dart API - Dashboard)

| Archivo | Acción |
|---------|--------|
| `lib/by_feature/membership/models/payment_link_model.dart` | **NUEVO**: Modelo para links de pago |
| `lib/by_feature/membership/models/billing_details_model.dart` | **NUEVO**: Modelos para detalles de billing |
| `lib/by_feature/membership/data/repository/membership_repository.dart` | Modificado: Agregados métodos de billing |
| `lib/by_feature/membership/data/provider/membership_provider.dart` | Modificado: Implementación de endpoints de billing |
| `lib/by_feature/membership/data/usecase/generate_payment_link_usecase.dart` | **NUEVO**: Usecase para generar link |
| `lib/by_feature/membership/data/usecase/enable_auto_billing_usecase.dart` | **NUEVO**: Usecase para auto-billing |
| `lib/by_feature/membership/data/usecase/get_billing_details_usecase.dart` | **NUEVO**: Usecase para detalles de billing |
| `lib/by_feature/membership/data/usecase/change_billing_amount_usecase.dart` | **NUEVO**: Usecase para cambiar monto |
| `lib/by_feature/membership/data/usecase/migrate_to_auto_billing_usecase.dart` | **NUEVO**: Usecase para migrar a auto |
| `lib/by_feature/membership/data/usecase/migrate_to_manual_billing_usecase.dart` | **NUEVO**: Usecase para migrar a manual |
| `lib/by_feature/membership/data/usecase/manage_user_subscription_usecase.dart` | **NUEVO**: Usecase para pausar/reanudar/extender |

---

## 13. Uso en el Frontend (Flutter)

### 13.1 Generar Link de Pago Manual

```dart
import 'package:menu_dart_api/by_feature/membership/data/provider/membership_provider.dart';
import 'package:menu_dart_api/by_feature/membership/data/usecase/generate_payment_link_usecase.dart';
import 'package:menu_dart_api/by_feature/membership/models/payment_link_model.dart';

final provider = MembershipProvider();
final useCase = GeneratePaymentLinkUseCase(provider);

final result = await useCase.execute(
  userId: 'user-uuid',
  plan: 'premium',
  amount: 12000, // en centavos
  periodMonths: 1,
  description: 'Descuento especial 20%',
);

// Enviar el link al usuario
final paymentLink = result.paymentLink; // "https://www.mercadopago.com/..."
```

### 13.2 Habilitar Auto-Billing

```dart
import 'package:menu_dart_api/by_feature/membership/data/usecase/enable_auto_billing_usecase.dart';

final useCase = EnableAutoBillingUseCase(provider);

final result = await useCase.execute(
  userId: 'user-uuid',
  plan: 'premium',
  cardTokenId: 'tok_xxx', // Token de MP SDK en frontend
  amount: 15000,
);

print('Suscripción creada: ${result.preapprovalId}');
print('Estado: ${result.status}');
```

### 13.3 Obtener Detalles de Facturación

```dart
import 'package:menu_dart_api/by_feature/membership/data/usecase/get_billing_details_usecase.dart';

final useCase = GetBillingDetailsUseCase(provider);

final details = await useCase.execute('membership-uuid');

// Verificar modo de facturación
if (details.billingMode.value == 'auto') {
  print('Facturación automática');
  print('Próximo cobro: ${details.autoBilling?.nextBillingDate}');
  print('Preapproval ID: ${details.autoBilling?.mpPreapprovalId}');
} else if (details.billingMode.value == 'manual') {
  print('Facturación manual');
  if (details.manualBilling?.pendingPaymentLink != null) {
    print('Link pendiente: ${details.manualBilling?.pendingPaymentLink}');
  }
}

// Historial de pagos
for (final payment in details.paymentHistory) {
  print('${payment.date}: \$${payment.amount} - ${payment.status}');
}
```

### 13.4 Cambiar Monto de Facturación

```dart
import 'package:menu_dart_api/by_feature/membership/data/usecase/change_billing_amount_usecase.dart';

final useCase = ChangeBillingAmountUseCase(provider);

final result = await useCase.execute(
  membershipId: 'membership-uuid',
  newAmount: 18000,
  reason: 'Incremento por inflación',
);

print('Monto anterior: \$${result.previousAmount}');
print('Nuevo monto: \$${result.newAmount}');
```

### 13.5 Migrar de Manual a Auto (y viceversa)

```dart
import 'package:menu_dart_api/by_feature/membership/data/usecase/migrate_to_auto_billing_usecase.dart';
import 'package:menu_dart_api/by_feature/membership/data/usecase/migrate_to_manual_billing_usecase.dart';

// Migrar a auto-billing
final migrateToAuto = MigrateToAutoBillingUseCase(provider);
await migrateToAuto.execute(
  membershipId: 'membership-uuid',
  cardTokenId: 'tok_xxx',
);

// Migrar a manual
final migrateToManual = MigrateToManualBillingUseCase(provider);
await migrateToManual.execute('membership-uuid');
```

### 13.6 Pausar/Reanudar/Extender Suscripción

```dart
import 'package:menu_dart_api/by_feature/membership/data/usecase/manage_user_subscription_usecase.dart';

final useCase = ManageUserSubscriptionUseCase(provider);

// Pausar suscripción
await useCase.pause('membership-uuid');

// Reanudar suscripción
await useCase.resume('membership-uuid');

// Extender membresía sin pago
await useCase.extend(
  membershipId: 'membership-uuid',
  periodMonths: 3,
  reason: 'Compensación por error técnico',
);
```

---

## 14. Resumen de Endpoints y Métodos

### API Backend

| Método HTTP | Endpoint | Método Provider | Descripción |
|-------------|----------|------------------|--------------|
| `POST` | `/admin/memberships/generate-payment-link` | `generatePaymentLink()` | Genera link de pago manual |
| `POST` | `/admin/memberships/enable-auto-billing` | `enableAutoBilling()` | Activa suscripción automática |
| `GET` | `/admin/memberships/:id/billing-details` | `getBillingDetails()` | Detalles de facturación |
| `PATCH` | `/admin/memberships/:id/billing-amount` | `changeBillingAmount()` | Cambia monto de suscripción |
| `POST` | `/admin/memberships/:id/migrate-to-auto-billing` | `migrateToAutoBilling()` | Migra a auto-billing |
| `POST` | `/admin/memberships/:id/migrate-to-manual` | `migrateToManualBilling()` | Migra a manual |
| `POST` | `/admin/memberships/:id/pause` | `pauseUserSubscription()` | Pausa suscripción |
| `POST` | `/admin/memberships/:id/resume` | `resumeUserSubscription()` | Reanuda suscripción |
| `POST` | `/admin/memberships/:id/extend` | `extendMembership()` | Extiende sin pago |

### Flutter Usecases

| Usecase | Métodos |
|---------|---------|
| `GeneratePaymentLinkUseCase` | `execute()` |
| `EnableAutoBillingUseCase` | `execute()` |
| `GetBillingDetailsUseCase` | `execute()` |
| `ChangeBillingAmountUseCase` | `execute()` |
| `MigrateToAutoBillingUseCase` | `execute()` |
| `MigrateToManualBillingUseCase` | `execute()` |
| `ManageUserSubscriptionUseCase` | `pause()`, `resume()`, `extend()` |