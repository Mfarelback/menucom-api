# Public Endpoints — Landing Page

Endpoints públicos para la landing page. No requieren autenticación.

---

## Catálogos Públicos (originales)

### `GET /catalogs/public/search`

Busca catálogos públicos activos por tipo y/o tags.

| Query Param | Type | Required | Description |
|-------------|------|----------|-------------|
| `type` | string | No | Filtrar por tipo (`MENU`, `WARDROBE`, `PRODUCT_LIST`, `SERVICE_LIST`, `MARKETPLACE`) |
| `tags` | string | No | Tags separadas por coma (ej: `italian,pizza`) |

Retorna array de catálogos ordenados por `viewCount` DESC. Límite: 20.

---

### `GET /catalogs/public/:slug`

Obtiene un catálogo público activo por su slug con todos sus items disponibles.

| Path Param | Type | Required | Description |
|------------|------|----------|-------------|
| `slug` | string | Sí | Slug único del catálogo |

Incrementa `viewCount`. Solo items con `isAvailable: true` y `status: AVAILABLE`.
- `404` — Catálogo no encontrado

---

### `GET /catalogs/public/owner/:ownerId`

Todos los catálogos públicos activos de un propietario por su UUID.

| Path Param | Type | Required | Description |
|------------|------|----------|-------------|
| `ownerId` | string | Sí | UUID del propietario |

Ordenados por `createdAt` DESC. `404` si no tiene catálogos públicos.

---

## Landing Page (nuevos)

### `GET /public/merchants`

Lista paginada de comerciantes profesionales registrados que tienen al menos un catálogo público activo con productos disponibles.

| Query Param | Type | Required | Default | Description |
|-------------|------|----------|---------|-------------|
| `page` | int | No | 1 | Número de página |
| `limit` | int | No | 20 | Items por página (max 50) |
| `type` | enum | No | — | Filtrar por tipo de catálogo |
| `search` | string | No | — | Buscar por nombre del negocio |
| `sort` | enum | No | `recent` | Criterio: `recent`, `popular`, `name` |

```json
{
  "data": [
    {
      "id": "uuid",
      "slug": "mi-tienda",
      "businessName": "Mi Tienda",
      "description": "Comida italiana artesanal...",
      "photoURL": "https://...",
      "coverImageUrl": "https://...",
      "catalogTypes": ["MENU", "PRODUCT_LIST"],
      "catalogCount": 3,
      "totalItems": 45,
      "tags": ["comida", "italiana"],
      "viewCount": 1234,
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ],
  "meta": {
    "total": 150,
    "page": 1,
    "limit": 20,
    "totalPages": 8
  }
}
```

---

### `GET /public/merchants/featured`

Comerciantes destacados para la sección hero de la landing. Primero usa el flag `isFeatured` en User; si no hay suficientes, completa con los más populares por visitas.

| Query Param | Type | Required | Default | Description |
|-------------|------|----------|---------|-------------|
| `limit` | int | No | 6 | Cantidad (max 12) |

Response: mismo formato que `GET /public/merchants`, solo `data`.

---

### `GET /public/merchants/:slug`

Perfil público completo de un comerciante con todos sus catálogos, items y estadísticas.

| Path Param | Type | Required | Description |
|------------|------|----------|-------------|
| `slug` | string | Sí | Slug único del comerciante |

```json
{
  "id": "uuid",
  "slug": "mi-tienda",
  "businessName": "Mi Tienda",
  "description": "Comida italiana artesanal...",
  "photoURL": "https://...",
  "coverImageUrl": "https://...",
  "contactInfo": {
    "email": "tienda@email.com",
    "phone": "+521234567890"
  },
  "catalogTypes": ["MENU"],
  "catalogs": [
    {
      "id": "uuid",
      "name": "Menú Ejecutivo",
      "slug": "menu-ejecutivo",
      "type": "MENU",
      "description": "...",
      "coverImageUrl": "...",
      "tags": ["comida"],
      "itemCount": 15,
      "viewCount": 500,
      "items": [
        {
          "id": "uuid",
          "name": "Pizza Margherita",
          "description": "...",
          "price": 150.00,
          "discountPrice": 120.00,
          "photoURL": "...",
          "category": "Pizzas",
          "isAvailable": true
        }
      ]
    }
  ],
  "stats": {
    "totalCatalogs": 2,
    "totalItems": 30,
    "totalViews": 5000,
    "memberSince": "2023-06-01T00:00:00Z"
  },
  "membership": {
    "plan": "premium",
    "features": ["custom_branding", "advanced_analytics"]
  }
}
```

- `404` — Comerciante no encontrado

---

### `GET /public/merchants/:slug/catalogs`

Versión liviana que retorna solo los catálogos de un comerciante (sin el perfil completo).

| Path Param | Type | Required | Description |
|------------|------|----------|-------------|
| `slug` | string | Sí | Slug del comerciante |

Response: array de catálogos (mismo formato que los `catalogs` del perfil completo).
- `404` — Comerciante no encontrado

---

### `GET /public/categories`

Categorías/tipos de negocio disponibles con conteo de comerciantes y catálogos en cada una. Para el menú de navegación de la landing.

```json
{
  "data": [
    {
      "type": "menu",
      "label": "Restaurantes",
      "icon": "restaurant",
      "merchantCount": 45,
      "catalogCount": 120
    },
    {
      "type": "wardrobe",
      "label": "Tiendas de Ropa",
      "icon": "clothes",
      "merchantCount": 30,
      "catalogCount": 65
    }
  ]
}
```

Ordenado por `merchantCount` DESC.

---

### `GET /public/stats`

Estadísticas globales de la plataforma para social proof en la landing.

```json
{
  "totalMerchants": 150,
  "totalCatalogs": 350,
  "totalItems": 5000,
  "totalOrders": 1200,
  "merchantGrowth": 15,
  "topCategories": [
    { "type": "menu", "merchants": 45 },
    { "type": "wardrobe", "merchants": 30 }
  ]
}
```

`merchantGrowth` es el porcentaje de comerciantes nuevos en el último mes.

---

### `GET /public/search`

Búsqueda unificada que cruza merchants, catálogos e items.

| Query Param | Type | Required | Default | Description |
|-------------|------|----------|---------|-------------|
| `q` | string | No | — | Término de búsqueda |
| `type` | enum | No | — | Filtrar por tipo de catálogo |
| `page` | int | No | 1 | Número de página |
| `limit` | int | No | 20 | Items por página (max 50) |

```json
{
  "merchants": [
    { "id": "uuid", "slug": "mi-tienda", "businessName": "...", "photoURL": "...", "catalogCount": 3 }
  ],
  "catalogs": [
    { "id": "uuid", "name": "...", "slug": "...", "type": "MENU", "description": "...", "coverImageUrl": "...", "owner": { "id": "uuid", "name": "...", "photoURL": "..." }, "itemCount": 15 }
  ],
  "items": [
    { "id": "uuid", "name": "Pizza", "description": "...", "price": 150, "discountPrice": 120, "photoURL": "...", "catalogId": "uuid", "catalogName": "Menú", "catalogSlug": "menu-ejecutivo", "catalogType": "MENU", "ownerId": "uuid" }
  ],
  "meta": { "total": 300, "page": 1, "limit": 20 }
}
```

---

### `GET /public/trending`

Catálogos y comerciantes trending (más vistos en un período).

| Query Param | Type | Required | Default | Description |
|-------------|------|----------|---------|-------------|
| `period` | enum | No | `24h` | Período: `24h`, `7d`, `30d` |
| `limit` | int | No | 10 | Cantidad máxima |

```json
{
  "merchants": [ ... ],
  "catalogs": [
    {
      "id": "uuid",
      "name": "...",
      "slug": "...",
      "type": "MENU",
      "coverImageUrl": "...",
      "viewCount": 500,
      "owner": { "id": "uuid", "name": "...", "photoURL": "..." }
    }
  ]
}
```
