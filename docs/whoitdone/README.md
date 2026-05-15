# WHOITDONE - Documentación Técnica Complementaria

Esta carpeta contiene la documentación técnica detallada que **expande y complementa** el análisis inicial.

## 📚 Documentos Relacionados

| Documento | Ubicación | Propósito |
|------------|-----------|------------|
| **Análisis Inicial** | [`../EVENTS_TICKETS_ANALYSIS.md`](../EVENTS_TICKETS_ANALYSIS.md) | Visión general, entidades propuestas, consideraciones generales |
| **Documentación Técnica** | [`technical-documentation.md`](technical-documentation.md) | Implementación detallada, webhooks, brechas críticas, código |

> ⚠️ **Importante**: Ambos documentos deben leerse **en conjunto** para una visión completa del sistema de eventos y tickets.

## 🔗 Relación entre Ambos Documentos

### Lo que el Análisis Inicial SÍ cubre:
- ✅ Estructura general de entidades
- ✅ Módulo Events propuesto (Clean Architecture)
- ✅ Enums que deben expandirse (RoleType, BusinessContext)
- ✅ Consideraciones de concurrencia (mencionadas, no resueltas)
- ✅ Necesidad de webhooks (mencionada brevemente)

### Lo que la Documentación Técnica AGREGA:
- ⚠️ Implementación completa de webhooks con validación HMAC SHA256
- ⚠️ Manejo correcto de eventos de Order (`order.processed`, `order.refunded`)
- ⚠️ Discriminador `metadata.type` para evitar colisiones con pagos de catálogo
- ⚠️ Uso de token OAuth del organizador (no el de la plataforma)
- ⚠️ Entidad `Venue` (no mencionada en análisis inicial)
- ⚠️ Auditoría de validación de tickets
- ⚠️ Corrección de evento de reembolso: es `order.refunded` NO `payment.updated`

## 🚀 Acceso Rápido

1. [Análisis Inicial - EVENTS_TICKETS_ANALYSIS.md](../EVENTS_TICKETS_ANALYSIS.md)
2. [Documentación Técnica - technical-documentation.md](technical-documentation.md)

---

**Nota**: Cualquier cambio en uno de los documentos debe reflejarse en el otro para mantener consistencia.
