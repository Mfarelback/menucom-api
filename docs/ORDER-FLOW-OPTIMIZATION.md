# Order Flow Optimization Tracker

## Tabla de Contenido
- [Estado General](#estado-general)
- [Problemas Detectados](#problemas-detectados)
- [Optimizaciones Pendientes](#optimizaciones-pendientes)
- [Optimizaciones Completadas](#optimizaciones-completadas)

---

## Estado General

| Metric | Valor Actual | Meta |
|--------|------------|------|
| Índices en `orders` | 1 (PK) | 6+ |
| Índices en `order_item` | 1 (PK) | 2+ |
| Queries por item en `create()` | 2 | 1 |
| Tipo de paginación | OFFSET | CURSOR |

**Última actualización:** 2026-04-22

---

## Problemas Detectados

### 🔴 CRÍTICO - Seguridad/Rendimiento

#### [P0-001] N+1 Queries en `OrdersService.create()`
**Severidad:** 🔴 CRÍTICO
**Archivo:** `src/orders/services/orders.service.ts`
**Líneas:** 42-135

**Descripción:**
El método `create()` ejecuta **2 queries por cada item**:
1. `determineOwnerIdAndValidate()` → `catalogItemRepository.findOne()` (línea 49)
2. `calculateSecureOrderAmounts()` → `catalogItemRepository.findOne()` (línea 104)

Para una orden con 10 items = **20 queries** cuando debería ser **1 sola**.

**Código actual:**
```typescript
private async determineOwnerIdAndValidate(items: CreateOrderDto['items']) {
  for (const item of items) {
    const catalogItem = await this.catalogItemRepository.findOne({
      where: { id: item.sourceId },
      relations: ['catalog'],
    });
    // ...
  }
}

private async calculateSecureOrderAmounts(items: CreateOrderDto['items']) {
  for (const item of items) {
    const dbItem = await this.catalogItemRepository.findOne({
      where: { id: item.sourceId },
    });
    // ...
  }
}
```

**Impacto estimado:** 20 queries → 1 query (20x mejora)

---

#### [P0-002] Missing Indexes en `orders`
**Severidad:** 🔴 CRÍTICO
**Tabla:** `public.orders`
**Archivo:** Schema/Entity

**Descripción:**
Faltan índices para las queries más frecuentes:

| Query | Sin Index | Con Index |
|-------|----------|----------|
| `findByOwnerId()` | Sequential scan | Index scan |
| `findByCreator()` | Sequential scan | Index scan |
| `findByUserId()` | Sequential scan | Index scan |
| `findByOperationId()` | Sequential scan | Index scan |

**Índices faltantes:**
- [ ] `idx_orders_ownerId` ON orders(owner_id)
- [ ] `idx_orders_createdBy` ON orders(created_by)
- [ ] `idx_orders_customerEmail` ON orders(customer_email)
- [ ] `idx_orders_operationID` ON orders(operation_id)
- [ ] `idx_orders_createdAt` ON orders(created_at DESC)

---

#### [P0-003] Missing Index en `order_item`
**Severidad:** 🔴 CRÍTICO
**Tabla:** `public.order_item`
**Archivo:** Schema/Entity

**Descripción:**
La FK `order_item.orderId` no tiene índice dédié. El `delete` en cascada y las búsquedas serán lentas.

**Índice faltante:**
- [ ] `idx_order_item_orderId` ON order_item(order_id)

---

### 🟡 MEDIO - Performance

#### [P1-001] OFFSET Pagination en lugar de Cursor
**Severidad:** 🟡 MEDIO
**Archivo:** `src/orders/services/orders.service.ts`
**Líneas:** 248-330

**Descripción:**
Usas `skip/take` (OFFSET) que es O(n). Para páginas grandes es lento.

**Código actual:**
```typescript
async findAll(page: number = 1, limit: number = 10) {
  const skip = (page - 1) * limit;
  return this.orderRepository.find({
    skip,
    take: limit,
    // ...
  });
}
```

**Solución:** Usar cursor-based pagination con `id < :cursor`

---

#### [P1-002] Composite Index para Dashboard
**Severidad:** 🟡 MEDIO
**Tabla:** `public.orders`

**Descripción:**
Queries de dashboard filtran por owner + status + orden. Un composite index sería más eficiente que 3 índices separados.

**Índice faltante:**
- [ ] `idx_orders_owner_status_created` ON orders(owner_id, status, created_at DESC)

---

#### [P1-003] Unused Index en `order_item`
**Severidad:** 🟡 MEDIO
**Tabla:** `public.order_item`
**Archivo:** Schema actual

**Descripción:**
Índice `IDX_bbd68439233eee02d8a59cd704` en `sourceType` no parece usado.

**Acción:**
- [ ] Verificar uso en queries
- [ ] Eliminar si no se usa

---

### 🟢 BAJO - Código/Tipos

#### [P2-001] DTO accepta `total` pero no se usa
**Severidad:** 🟢 BAJO
**Archivo:** `src/orders/dtos/create.order.dto.ts`
**Línea:** 55

**Descripción:**
El DTO tiene `total: number` marcado con `@IsPositive()` pero el servicio ignora este valor y calcula el subtotal real desde la DB.

**Observación:** Esto es correcto por seguridad, pero debería documentarse.

---

#### [P2-002] `findOne` no usa relations loading optimization
**Severidad:** 🟢 BAJO
**Archivo:** `src/orders/services/orders.service.ts`
**Línea:** 234

**Descripción:**
`findOne` siempre carga `relations: ['items']` aunque no siempre se necesite.

**Solución:** Hacer el relations param opcional.

---

## Optimizaciones Pendientes

| ID | Prioridad | Título | Status |
|----|----------|--------|-------|
| P0-001 | 🔴 | N+1 Queries en create() | ⏳ |
| P0-002 | 🔴 | Missing Indexes en orders | ⏳ |
| P0-003 | 🔴 | Missing Index en order_item | ⏳ |
| P1-001 | 🟡 | Cursor Pagination | ⏳ |
| P1-002 | 🟡 | Composite Index Dashboard | ⏳ |
| P1-003 | 🟡 | Unused Index order_item | ⏳ |
| P2-001 | 🟢 | Documentar validación de precio | ⏳ |
| P2-002 | 🟢 | Optional relations en findOne | ⏳ |

---

## Optimizaciones Completadas

| ID | Fecha | Título | Notes |
|----|-------|-------|-------|-------|
| - | - | - | - |

---

## Migration SQL Template

```sql
-- ==========================================
-- Order Flow Performance Indexes
-- Creado: 2026-04-22
-- Status: PENDING
-- ==========================================

-- Órdenes: índices para queries frecuentes
CREATE INDEX idx_orders_owner_id ON orders(owner_id);
CREATE INDEX idx_orders_created_by ON orders(created_by);
CREATE INDEX idx_orders_customer_email ON orders(customer_email);
CREATE INDEX idx_orders_operation_id ON orders(operation_id);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);

-- Índices compuestos para dashboard
CREATE INDEX idx_orders_owner_status_created ON orders(owner_id, status, created_at DESC);

-- Order items: index para FK y cascade
CREATE INDEX idx_order_item_order_id ON order_item(order_id);

-- Verificar before/after performance
EXPLAIN ANALYZE SELECT * FROM orders WHERE owner_id = 'xxx' ORDER BY created_at DESC LIMIT 20;
```

---

## Métricas de Éxito

| Métrica | Antes | Después | Meta |
|---------|-------|---------|------|
| Queries por `create()` (10 items) | 20 | 2 | <3 |
| Tiempo búsqueda `findByOwnerId()` | ? | ? | -50% |
| Tiempo búsqueda `findAll()` página 100 | ? | ? | -50% |

---

## Notas

- 2026-04-22:初始文档创建