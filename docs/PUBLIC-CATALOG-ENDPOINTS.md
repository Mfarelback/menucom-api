# Public Catalog Endpoints

## GET /catalogs/public/search

Busca catálogos públicos activos por tipo y/o tags.

### Query Parameters

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | No | Filtrar por tipo de catálogo (`MENU`, `WARDROBE`) |
| `tags` | string | No | Filtrar por tags separadas por coma (ej: `italian,pizza`) |

### Response

```json
[
  {
    "id": "uuid",
    "catalogType": "MENU",
    "name": "string",
    "description": "string",
    "coverImageUrl": "string",
    "tags": ["string"],
    "metadata": {},
    "owner": {
      "id": "uuid",
      "name": "string",
      "photoURL": "string"
    },
    "viewCount": 0,
    "createdAt": "ISO date"
  }
]
```

Ordenados por `viewCount` DESC. Límite: 20 resultados.

---

## GET /catalogs/public/:slug

Obtiene un catálogo público activo por su slug.

### Path Parameters

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `slug` | string | Sí | Slug único del catálogo |

### Response

```json
{
  "id": "uuid",
  "type": "MENU",
  "name": "string",
  "description": "string",
  "coverImageUrl": "string",
  "tags": ["string"],
  "metadata": {},
  "owner": {
    "id": "uuid",
    "name": "string",
    "photoURL": "string"
  },
  "items": [
    {
      "id": "uuid",
      "name": "string",
      "description": "string",
      "price": 0,
      "discountPrice": 0,
      "photoURL": "string",
      "isAvailable": true,
      "status": "AVAILABLE",
      "attributes": {}
    }
  ],
  "viewCount": 0,
  "createdAt": "ISO date"
}
```

Incrementa `viewCount` en cada visita. Solo retorna items con `isAvailable: true` y `status: AVAILABLE`.

### Errors

- `404` — Catálogo no encontrado o no es público

---

## GET /catalogs/public/owner/:ownerId

Obtiene todos los catálogos públicos activos de un propietario.

### Path Parameters

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `ownerId` | string | Sí | UUID del propietario |

### Response

```json
[
  {
    "id": "uuid",
    "type": "MENU",
    "name": "string",
    "description": "string",
    "coverImageUrl": "string",
    "tags": ["string"],
    "slug": "string",
    "metadata": {},
    "owner": {
      "id": "uuid",
      "name": "string",
      "photoURL": "string"
    },
    "items": [...],
    "itemCount": 0,
    "viewCount": 0,
    "createdAt": "ISO date"
  }
]
```

Ordenados por `createdAt` DESC.

### Errors

- `404` — No se encontraron catálogos públicos para este owner
