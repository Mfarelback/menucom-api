# Análisis de Validación de Límites de Membership

## Límites配置dos (FREE Plan)

```json
"limits": {
  "maxCatalogs": 1,
  "maxCatalogItems": 10,
  "maxLocations": 1,
  "analyticsRetention": 7,
  "maxUsers": 1,
  "maxApiCalls": 100,
  "storageLimit": 100
}
```

---

## Estado de Implementación por Límite

### ✅ LÍMITES VALIDADOS CORRECTAMENTE

| Límite | Estado | Ubicación |
|--------|--------|-----------|
| **maxCatalogs** | ✅ Implementado | `src/membership/services/resource-limit.service.ts:24-38` |
| **maxCatalogItems** | ✅ Implementado | `src/membership/services/resource-limit.service.ts:40-57` |

### ❌ LÍMITES NO IMPLEMENTADOS

| Límite | Estado | Notas |
|--------|--------|-------|
| **maxLocations** | ❌ No validado | Definido en enum pero sin servicio de validación |
| **maxUsers** | ❌ No validado | Definido en DTOs/entities pero sin validación activa |
| **maxApiCalls** | ❌ No validado | No hay throttle guard implementado |
| **storageLimit** | ❌ No validado | No hay validación de almacenamiento |
| **analyticsRetention** | ❌ No validado | No hay limpieza automática de analytics |

---

## Análisis Detallado

### 1. maxCatalogs ✅

**Ubicación:** `src/membership/services/resource-limit.service.ts:24-38`

**Cómo funciona:**
- `canCreateCatalog()` cuenta catálogos actuales del usuario
- Compara con el límite del plan (1 para FREE)
- Lanza `BadRequestException` si límite alcanzado
- Se llama desde `CatalogService.createCatalog()` línea 45

```typescript
async canCreateCatalog(userId: string): Promise<boolean> {
  const membership = await this.membershipService.getUserMembership(userId);
  const currentCount = await this.getCurrentCatalogCount(userId);
  return limit === -1 || currentCount < limit;
}
```

**Validación:** ✅ CORRECTO

---

### 2. maxCatalogItems ✅

**Ubicación:** `src/membership/services/resource-limit.service.ts:40-57`

**Cómo funciona:**
- `canCreateCatalogItem()` cuenta items en TODOS los catálogos del usuario
- Soporta cantidad adicional para operaciones batch
- Se valida antes de crear items

```typescript
async canCreateCatalogItem(userId: string, additionalItems: number = 1): Promise<boolean> {
  const currentCount = await this.getCurrentCatalogItemCount(userId);
  return limit === -1 || currentCount + additionalItems < limit;
}
```

**Validación:** ✅ CORRECTO

---

### 3. maxLocations ❌

**Estado:** NO IMPLEMENTADO

**Encontrado en:**
- `membership-plan.enum.ts:46` - Definido
- `subscription-plan.entity.ts:70` - En entity
- `create-subscription-plan.dto.ts:33` - En DTO

**Problema:** No existe `LocationService` ni validación en ningún lugar. El límite está declarado pero nunca se verifica.

---

### 4. maxUsers ❌

**Estado:** NO IMPLEMENTADO

**Encontrado en:**
- `membership-plan.enum.ts:48` - Definido (1 para FREE)
- `subscription-plan.entity.ts:72` - En entity

**Problema:** No hay validación de cantidad de usuarios asociados a una membresía. El sistema de roles (`user-role.controller.ts`) no valida contra este límite.

---

### 5. maxApiCalls ❌

**Estado:** NO IMPLEMENTADO

**Encontrado en:**
- `membership-plan.enum.ts:49` - Definido (100 para FREE)
- `subscription-plan.entity.ts:73` - En entity

**Problema:** No hay throttle/rate-limit guard implementado. El sistema de Rate Limiting está ausente. Se requiere implementar un `ThrottlerGuard` o similar basado en `@nestjs/throttler`.

---

### 6. storageLimit ❌

**Estado:** NO IMPLEMENTADO

**Encontrado en:**
- `membership-plan.enum.ts:50` - Definido (100MB para FREE)
- `subscription-plan.entity.ts:74` - En entity

**Problema:** No hay validación de tamaño de archivos subidos. El módulo de storage/images no verifica contra este límite.

---

### 7. analyticsRetention ❌

**Estado:** NO IMPLEMENTADO

**Definido en:**
- `membership-plan.enum.ts:47` - 7 días para FREE
- `subscription-plan.entity.ts:71` - En entity

**Problema:** No hay job de limpieza automática para datos analytics antiguos. Se requeriría un `CronJob` o similar.

---

## Conclusiones

1. **Solo 2 de 7 límites están validados** (maxCatalogs, maxCatalogItems)
2. **5 límites están declarados pero sin validación activa**
3. La validación ocurre en el momento de creación de recursos (no hay validación en tiempo real)
4. No hay endpoint público para consultar uso actual de límites

## Recomendaciones

1. Implementar `LocationService` para validar maxLocations
2. Agregar validación en `UserRoleService` para maxUsers
3. Implementar `ThrottlerGuard` para maxApiCalls
4. Agregar middleware de validación de tamaño para storageLimit
5. Crear cron job para limpiar analytics según analyticsRetention

---

*Generado: 2026-04-25*