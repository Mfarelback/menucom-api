---
tags:
  - index
  - repo/api
aliases:
  - API Documentation
  - Backend Docs
---
# ⚙️ API — Backend NestJS

Documentación del backend. Organizada en subdirectorios por tema.

## Subdirectorios

| Directorio | Descripción |
|------------|-------------|
| `repo-api/analysis/` | Análisis de features (events, tickets) |
| `repo-api/api/` | Endpoints, cURL, especificaciones API |
| `repo-api/deploy/` | Despliegue en Render + Supabase |
| `repo-api/implementation/` | Implementaciones (roles, membership, commerce types) |
| `repo-api/integration/` | Integraciones (Firebase, OAuth, MP, FCM, billing) |
| `repo-api/migration/` | Guías y resúmenes de migración |
| `repo-api/modules/` | Documentación de módulos (auth, membership, notifications, payments) |
| `repo-api/project/` | Documentación de proyecto (roles deep-dive, copilot, gemini) |
| `repo-api/technical/` | Temas técnicos (multi-tenant, security, deuda técnica) |
| `repo-api/testing/` | Guías y casos de testing |
| `repo-api/whoitdone/` | Registro de autoría técnica |

## Conexiones clave

- [[maps/Auth & Roles]] → `project/ROLES-*`, `impl/ROLES-*`, `integration/*FIREBASE*`
- [[maps/Orders & Payments]] → `api/ORDER-*`, `api/PAYMENTS-*`
- [[maps/Multi-tenant Migration]] → `technical/MULTITENANT-ARCHITECTURE`, `technical/REGRESSION-PLAN`
- [[maps/Monetization & Membership]] → `api/membership-api`, `impl/MEMBERSHIP*`, `integration/MEMBERSHIP-MP`
- [[maps/Catalog Domain]] → `api/CATALOG-*`, `api/PUBLIC-CATALOG`
- [[maps/Events & Tickets]] → `analysis/EVENTS_TICKETS`, `impl/EVENT-FLOW`
