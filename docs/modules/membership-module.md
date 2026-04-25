# Membership Module

Módulo de membresías para control de acceso y límites de recursos.

## Quick Start

### Obtener membresía del usuario

```typescript
const membership = await membershipService.getUserMembership(userId);
// Si no tiene, se le asigna FREE automáticamente
```

### Validar acceso a feature

```typescript
const hasAccess = await membershipService.hasFeature(userId, feature);
```

### Validar límite de recursos

```typescript
await resourceLimitService.validateResourceCreation(userId, 'catalog');
// Lanza BadRequestException si excede el límite
```

## Servicios

| Servicio | Descripción |
|----------|-------------|
| `MembershipService` | Gestión de membresías |
| `ResourceLimitService` | Validación de límites |
| `MercadoPagoSubscriptionService` | Suscripciones MP |
| `SubscriptionPlanService` | Planes personalizados |

## Entidades

- `Membership` - Membresía del usuario
- `MembershipAudit` - Historial de cambios
- `SubscriptionPlan` - Planes personalizados
- `SubscriptionPayment` - Pagos registrados