# MP OAuth Multi-Tenant Fix — Plan de Migración

> Fecha: 2026-06-24
> Propósito: Migrar el flujo OAuth de MercadoPago de `userId`-centric a `commerceId`-centric para alinearlo con la arquitectura multi-tenant.

---

## Problema

Todo el flujo OAuth de MercadoPago está **llaveado por `userId`** en lugar de `commerceId`:

| Componente | Cómo obtiene el ID | Problema |
|-----------|-------------------|----------|
| `POST /payments/oauth/initiate` | `req.user.userId` | No usa `commerceId` del tenant |
| `POST /payments/oauth/callback` | `body.vinculation_id` | Sin autenticación, userId puede no coincidir |
| `GET /payments/oauth/status` | `req.user.userId` | MANAGER ve su propio estado, no el del commerce |
| `POST /payments/oauth/unlink` | `req.user.userId` | Igual |
| `POST /payments/oauth/refresh-token` | `req.user.userId` | Igual |
| `getAccountDataForPreference()` | `ownerId` (userId) | `createPayment()` recibe userId, no commerceId |

**Entidad `mercado_pago_accounts`**: No tiene columna `commerceId`. El unique index es sobre `userId`.

**Consecuencias**:
- Un usuario con múltiples commerces no puede tener cuentas MP separadas
- MANAGER no puede ver ni usar la cuenta MP del commerce que gestiona
- `GET /payments/oauth/status` devuelve `isLinked: false` si el `userId` del JWT no coincide con el que vinculó

---

## Plan de Trabajo

### Fase 1: Base de Datos — Agregar `commerceId` a `mercado_pago_accounts`

#### 1.1 Entity: `src/payments/entities/mercado-pago-account.entity.ts`

- Agregar columna `commerceId` (UUID, nullable, FK -> Commerce)
- Crear relación `@ManyToOne(() => Commerce)`
- Cambiar `@Index(['userId'], { unique: true })` → `@Index(['userId'])` (no unique — un usuario puede tener cuentas en múltiples commerces)
- Agregar `@Index(['commerceId'], { unique: true, where: '"commerceId" IS NOT NULL' })`
- Dejar `userId` como está (backward compatibility, se puebla igual)

```typescript
@Column({ type: 'uuid', nullable: true })
commerceId: string | null;

@ManyToOne(() => Commerce, { onDelete: 'SET NULL' })
@JoinColumn({ name: 'commerceId' })
commerce: Commerce;
```

#### 1.2 Migration SQL

```sql
-- Agregar columna commerceId con FK
ALTER TABLE mercado_pago_accounts 
  ADD COLUMN "commerceId" uuid REFERENCES commerce(id) ON DELETE SET NULL;

-- Dropear unique constraint sobre userId (permitir multi-account por usuario)
DROP INDEX IF EXISTS "IDX_9a7e4c2b3e5f1d8a6c0b3e5f1d";

-- Crear índice único parcial sobre commerceId
CREATE UNIQUE INDEX "IDX_mercado_pago_accounts_commerceId" 
  ON mercado_pago_accounts("commerceId") 
  WHERE "commerceId" IS NOT NULL;

-- Crear índice no-único sobre userId para búsquedas
CREATE INDEX "IDX_mercado_pago_accounts_userId"
  ON mercado_pago_accounts("userId");
```

#### 1.3 Backfill de datos existentes

Después de la migración, las cuentas existentes tendrán `commerceId = NULL`. Hay que poblarlo:

```sql
-- Asignar commerceId desde la tabla commerce por ownerId (relación 1:1 actual)
UPDATE mercado_pago_accounts mpa
SET "commerceId" = c.id
FROM commerce c
WHERE c."ownerId" = mpa."userId"
  AND mpa."commerceId" IS NULL;
```

---

### Fase 2: Servicio OAuth — Resolver por `commerceId`

#### 2.1 `src/payments/services/mercado-pago-oauth.service.ts`

Agregar métodos nuevos que trabajen con `commerceId`, manteniendo los old por compatibilidad.
Inyectar `CommerceRepository` para resolver `commerceId → ownerId` como fallback.

```typescript
// NUEVOS — commerce-centric

async getAccountByCommerce(commerceId: string): Promise<MercadoPagoAccount | null> {
  let account = await this.mpAccountRepository.findOne({
    where: { commerceId, isActive: true },
  });
  // Fallback: si no hay commerceId, buscar por ownerId del commerce (período de migración)
  if (!account) {
    const commerce = await this.commerceRepository.findOne({ where: { id: commerceId } });
    if (commerce?.ownerId) {
      account = await this.mpAccountRepository.findOne({
        where: { userId: commerce.ownerId, isActive: true },
      });
    }
  }
  return account;
}

async getAccountDataForPreferenceByCommerce(commerceId: string): Promise<{
  collectorId: number; accessToken: string;
} | null> {
  const account = await this.getAccountByCommerce(commerceId);
  if (!account) return null;
  return {
    collectorId: parseInt(account.collectorId, 10),
    accessToken: account.accessToken,
  };
}

async getCollectorIdByCommerce(commerceId: string): Promise<number | null> {
  const account = await this.getAccountByCommerce(commerceId);
  if (!account) return null;
  return parseInt(account.collectorId, 10);
}
```

#### 2.2 `linkAccount` — Aceptar `commerceId` opcional

Modificar `linkAccount` para que acepte y persista `commerceId`:

```typescript
async linkAccount(
  userId: string,
  authorizationCode: string,
  redirectUri: string,
  commerceId?: string,
): Promise<MercadoPagoAccount>
```

Si `commerceId` está presente, el `where` de búsqueda de cuenta existente debe usar `commerceId` en vez de `userId`.

---

### Fase 3: Controller — Endpoints Commerce-Centric

#### 3.1 `src/payments/controller/mercado-pago-oauth.controller.ts`

| Endpoint | Cambio |
|----------|--------|
| `POST /payments/oauth/initiate` | Leer `req.tenantId` (del TenantInterceptor). State incluye `commerceId`. Agregar `PermissionsGuard` |
| `POST /payments/oauth/callback` | Aceptar `commerceId` opcional. Si viene, linkear contra commerce. Validar que `vinculation_id` o `commerceId` esté presente |
| `GET /payments/oauth/status` | Buscar por `req.tenantId`/`commerceId`, con fallback a `userId`. Agregar `PermissionsGuard` |
| `POST /payments/oauth/unlink` | Igual. Agregar `PermissionsGuard` |
| `POST /payments/oauth/refresh-token` | Igual. Agregar `PermissionsGuard` |
| `GET /payments/oauth/callback` (público) | Backward-compatible: intentar nuevo formato de state, fallback al legacy |

**State format**: `user_{userId}_commerce_{commerceId}_{timestamp}`

```typescript
const state = `user_${userId}_commerce_${commerceId}_${Date.now()}`;
```

**Extract en GET callback (backward-compatible)**:
```typescript
let userId: string;
let commerceId: string | undefined;

// Intentar nuevo formato primero
const newMatch = state.match(/^user_([^_]+)_commerce_([^_]+)_/);
if (newMatch) {
  userId = newMatch[1];
  commerceId = newMatch[2];
} else {
  // Fallback a formato legacy: user_{userId}_{timestamp}
  const legacyMatch = state.match(/^user_([^_]+)_/);
  if (legacyMatch) {
    userId = legacyMatch[1];
  } else {
    throw new BadRequestException(`Invalid state format: ${state}`);
  }
}
```

#### 3.2 Agregar `PermissionsGuard`

Todos los endpoints autenticados deben requerir `@RequirePermissions(Permission.MANAGE_PAYMENTS)`:

```typescript
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions(Permission.MANAGE_PAYMENTS)
```

---

### Fase 4: Cadena de Pagos — Pasar `commerceId`

#### 4.1 `src/payments/services/payment-intent.service.ts`

`createPayment()` debe aceptar `commerceId`. Prioriza `commerceId` sobre `ownerId` para resolver la cuenta MP:

```typescript
async createPayment(
  phone: string,
  amount: number,
  description?: string,
  ownerId?: string,
  commerceId?: string,      // NUEVO
  anonymousId?: string,
  orderId?: string,
  marketplaceFeeAmount?: number,
  customerName?: string,
  customerLastName?: string,
): Promise<PaymentIntent>
```

Lógica interna de resolución de cuenta:
```typescript
if (commerceId) {
  accountData = await this.mercadoPagoOAuthService.getAccountDataForPreferenceByCommerce(commerceId);
}
// Fallback a ownerId solo si no se encontró por commerceId
if (!accountData && ownerId) {
  accountData = await this.mercadoPagoOAuthService.getAccountDataForPreference(ownerId);
}
```

#### 4.2 `src/payments/services/payments.service.ts`

La fachada `PaymentsService.createPayment()` también necesita `commerceId`:

```typescript
async createPayment(
  phone: string, amount: number, description?: string,
  ownerId?: string, commerceId?: string,
  anonymousId?: string, orderId?: string,
  marketplaceFeeAmount?: number,
  customerName?: string, customerLastName?: string,
): Promise<PaymentIntent> {
  return this.paymentIntentService.createPayment(
    phone, amount, description, ownerId, commerceId,
    anonymousId, orderId, marketplaceFeeAmount,
    customerName, customerLastName,
  );
}
```

#### 4.3 `src/orders/services/orders.service.ts`

En la llamada a `createPayment()` (línea 253), pasar `commerceId` (ya está en scope, línea 181):

```typescript
const paymentIntent = await this.paymentService.createPayment(
  customerEmail,
  secureAmounts.total,
  `Orden #${savedOrder.id.substring(0, 8)}`,
  ownerId,
  commerceId,  // NUEVO — ya existe en este scope
  createdBy,
  savedOrder.id,
  secureAmounts.marketplaceFeeAmount,
  customerName,
  customerLastName,
);
```

---

### Fase 5: Matriz de Permisos

#### 5.1 `src/auth/models/permissions.model.ts`

`MANAGE_PAYMENTS` ya existe en el enum `Permission`. Agregarlo a MANAGER donde falte:

| Contexto | Rol | Estado |
|----------|-----|--------|
| RESTAURANT | OWNER | Ya tiene `MANAGE_PAYMENTS` |
| RESTAURANT | MANAGER | **Agregar** `MANAGE_PAYMENTS` |
| WARDROBE | OWNER | **Agregar** `MANAGE_PAYMENTS` |
| WARDROBE | MANAGER | **Agregar** `MANAGE_PAYMENTS` |
| MARKETPLACE | OWNER | Ya tiene `MANAGE_PAYMENTS` |
| MARKETPLACE | MANAGER | **Agregar** `MANAGE_PAYMENTS` |
| RETAIL | OWNER | Ya tiene `MANAGE_PAYMENTS` |
| RETAIL | MANAGER | **Agregar** `MANAGE_PAYMENTS` |
| EVENTS | OWNER | Ya tiene `MANAGE_PAYMENTS` |
| EVENTS | MANAGER | **Agregar** `MANAGE_PAYMENTS` |

#### 5.2 `src/payments/dto/oauth.dto.ts`

Agregar `commerceId` opcional a `TokenExchangeDto`:

```typescript
@ApiProperty({ description: 'ID del comercio (para multi-tenant)', required: false })
@IsOptional()
@IsString()
commerceId?: string;
```

---

## Resumen de Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/payments/entities/mercado-pago-account.entity.ts` | Agregar `commerceId`, relación con Commerce, cambiar index (userId no-único) |
| `src/payments/services/mercado-pago-oauth.service.ts` | Métodos commerce-centric con fallback a userId. `linkAccount` acepta commerceId |
| `src/payments/controller/mercado-pago-oauth.controller.ts` | Usar `req.tenantId`, state con commerceId, PermissionsGuard en todos los endpoints |
| `src/payments/dto/oauth.dto.ts` | Agregar `commerceId` opcional a `TokenExchangeDto` |
| `src/payments/services/payment-intent.service.ts` | Aceptar `commerceId`, priorizar commerceId sobre ownerId |
| `src/payments/services/payments.service.ts` | Pasar `commerceId` a PaymentIntentService |
| `src/orders/services/orders.service.ts` | Pasar `commerceId` a `createPayment()` |
| `src/auth/models/permissions.model.ts` | Agregar `MANAGE_PAYMENTS` a MANAGER de todos los contextos |
| SQL migration | ALTER TABLE + index + backfill |

## Orden de Implementación

```
Fase 1 (DB) → Fase 2 (Servicio) → Fase 5 (Permisos) → Fase 3 (Controller) → Fase 4 (Cadena pagos)
```

## Testing

- Crear tests e2e para cada endpoint OAuth con contexto multi-tenant
- Probar:
  - OWNER vincula MP, MANAGER consulta status → debe ver linked
  - Usuario con 2 commerces vincula MP distinto a cada uno
  - `GET /payments/oauth/status` sin `X-Tenant-Id` → usar `commerceId` del JWT
  - `GET /payments/oauth/status` con `X-Tenant-Id` → resolver por ese commerce
  - Callback con state en formato legacy → debe funcionar (backward-compatible)

```bash
npm run test:e2e -- --grep "Mercado Pago OAuth"
```
