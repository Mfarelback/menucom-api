# Registro de Tipos de Comercio - Seguimiento

## Fecha: 2026-04-12

## Objetivo
Agregar soporte en UI y Backend para múltiples tipos de comercio (ropa, comida, distribuidores, servicios, etc.)

---

## Avances

### ✅ Completado

| Fecha | Cambio | Archivo |
|-------|--------|---------|
| 2026-04-12 | Corregido bug UI: campo teléfono duplicado | `register_commerce.dart` |
| 2026-04-12 | Backend mapeo roles clothes/dinning → OWNER | `auth.service.ts` |
| 2026-04-12 | Frontend: nuevo modelo con 12 tipos de comercio | `type_comerce_model.dart` |
| 2026-04-12 | Frontend: actualizar lista de comercios disponibles | `login_controller.dart` |
| 2026-04-12 | Backend: switch extendido para todos los tipos | `auth.service.ts` |

---

## Pendientes

- [ ] Ninguno - Implementación completa ✅

---

## Mapeo Final

| Code | Descripción | Context | Rol |
|------|-------------|---------|-----|
| `retail` | Venta de productos general | MARKETPLACE | OWNER |
| `water_distributor` | Distribuidora de agua | MARKETPLACE | OWNER |
| `grocery` | Distribuidora de alimentos | MARKETPLACE | OWNER |
| `food` | Restaurant/Comida | RESTAURANT | OWNER |
| `clothes` | Venta de ropa | WARDROBE | OWNER |
| `accessories` | Accesorios | MARKETPLACE | OWNER |
| `electronics` | Electrónica | MARKETPLACE | OWNER |
| `pharmacy` | Farmacia | GENERAL | OWNER |
| `beauty` | Belleza | GENERAL | OWNER |
| `construction` | Materiales de construcción | MARKETPLACE | OWNER |
| `automotive` | Automotriz | GENERAL | OWNER |
| `pets` | Petshop | MARKETPLACE | OWNER |

---

## Referencia

- Proposal: `docs/commerce_types_proposal.md` (raíz del proyecto)
- Doc related: `menucom-api/docs/modules/auth-module.md`