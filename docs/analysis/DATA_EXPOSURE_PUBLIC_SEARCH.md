# Data Exposure — `GET /catalogs/public/search`

**Fecha**: 2026-06-26
**Severidad**: ALTA
**Estado**: Corregido — fix manual aplicado

---

## Resumen

El endpoint `GET /catalogs/public/search` retornaba entidades TypeORM crudas sin sanitización, exponiendo datos sensibles del usuario dueño del catálogo sin requerir autenticación.

## Datos expuestos (antes del fix)

### User entity completa (vía `catalog.owner` join)
| Campo | Riesgo |
|-------|--------|
| `email` | PII |
| `phone` | PII |
| `password` (hash) | Crítico |
| `socialToken` (Firebase UID) | Token de auth |
| `fcmToken` | Token de notificaciones push |
| `firebaseProvider` | Info de proveedor auth |
| `isEmailVerified` | Estado de cuenta |
| `needToChangepassword` | Flag de seguridad |
| `lastLoginAt` | Actividad de login |
| `role` (legacy) | Rol del usuario |

### Catalog entity completa
| Campo | Riesgo |
|-------|--------|
| `ownerId` | UUID de usuario |
| `commerceId` | UUID de comercio |
| `settings` | Config interna del catálogo |
| `capacity` | Config interna |
| `viewCount`, `lastViewedAt` | Métricas internas |
| `archivedAt` | Timestamps internos |

## Causa raíz

- `searchPublicCatalogs()` (`src/catalog/services/catalog.service.ts`) usaba `.leftJoinAndSelect('catalog.owner', 'owner')` + `.getMany()` retornando entidades crudas
- El decorador `@Exclude()` en `User.password` no funcionaba porque **no hay `ClassSerializerInterceptor`** configurado globalmente
- Los otros 4 métodos públicos (`getPublicCatalog`, `getPublicCatalogById`, `getPublicCatalogsByOwnerId`, `getPublicCatalogsByCommerce`) sí sanitizan manualmente — este método fue la excepción

## Fix aplicado

Mapeo manual de la respuesta (consistente con el resto de métodos públicos):

```typescript
return catalogs.map((catalog) => ({
  id: catalog.id,
  type: catalog.catalogType,
  name: catalog.name,
  description: catalog.description,
  coverImageUrl: catalog.coverImageUrl,
  tags: catalog.tags,
  slug: catalog.slug,
  metadata: catalog.metadata,
  owner: {
    id: catalog.owner.id,
    name: catalog.owner.name,
    photoURL: catalog.owner.photoURL,
  },
  viewCount: catalog.viewCount,
  createdAt: catalog.createdAt,
}));
```

## Recomendación pendiente

Configurar `ClassSerializerInterceptor` como defensa en profundidad global, con response DTOs explícitos por endpoint para evitar que futuros endpoints cometan el mismo error. Ver `docs/analysis/` para plan de implementación futuro.
