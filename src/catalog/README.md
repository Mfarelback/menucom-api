# Módulo de Catálogo Genérico

## 📋 Descripción

El módulo de Catálogo es un sistema unificado que reemplaza las funcionalidades duplicadas de `Menu` y `Wardrobes`, reduciendo ~2000 líneas de código duplicado a ~1000 líneas de código genérico reutilizable.

## 🎯 Características Principales

### ✅ Catálogos Soportados
- **MENU**: Catálogos de comida/bebidas para restaurantes
- **WARDROBE**: Catálogos de ropa/accesorios para tiendas
- **Extensible**: Fácil agregar nuevos tipos de catálogo

### ✅ Funcionalidades
- ✅ CRUD completo de catálogos
- ✅ CRUD completo de items
- ✅ Catálogos públicos y privados
- ✅ Búsqueda y filtrado
- ✅ Slugs para URLs amigables
- ✅ Metadatos flexibles (JSONB)
- ✅ Sistema de etiquetas (tags)
- ✅ Analytics básicos (vistas, contadores)
- ✅ Archivar catálogos (soft delete)
- ✅ Límites de capacidad por membresía

## 🏗️ Arquitectura

### Entidades

#### Catalog
```typescript
{
  id: string;
  ownerId: string;
  catalogType: CatalogType; // MENU | WARDROBE
  name: string;
  description: string;
  capacity: number; // Límite de items
  status: CatalogStatus; // ACTIVE | ARCHIVED | DRAFT
  coverImageUrl: string;
  slug: string; // URL amigable
  isPublic: boolean;
  metadata: Record<string, any>; // Campos específicos por tipo
  settings: Record<string, any>; // Configuración
  tags: string[];
  items: CatalogItem[];
  viewCount: number;
  createdAt: Date;
  updatedAt: Date;
}
```

#### CatalogItem
```typescript
{
  id: string;
  catalogId: string;
  name: string;
  description: string;
  photoURL: string;
  price: number;
  discountPrice: number;
  status: CatalogItemStatus; // ACTIVE | INACTIVE | OUT_OF_STOCK
  isAvailable: boolean;
  attributes: Record<string, any>; // Campos específicos (tallas, ingredientes, etc.)
  viewCount: number;
  orderCount: number;
  createdAt: Date;
  updatedAt: Date;
}
```

### Enums

```typescript
enum CatalogType {
  MENU = 'MENU',
  WARDROBE = 'WARDROBE',
}

enum CatalogStatus {
  ACTIVE = 'ACTIVE',
  ARCHIVED = 'ARCHIVED',
  DRAFT = 'DRAFT',
}

enum CatalogItemStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  OUT_OF_STOCK = 'OUT_OF_STOCK',
}
```

## 🔌 API Endpoints

### Catálogos

#### Crear Catálogo
```http
POST /catalogs
Authorization: Bearer {token}

Body:
{
  "catalogType": "MENU",
  "name": "Menú Principal",
  "description": "Nuestro menú de especialidades",
  "capacity": 50,
  "isPublic": true,
  "metadata": {
    "cuisine": "italian",
    "priceRange": "$$"
  },
  "tags": ["pasta", "pizza", "italian"]
}
```

#### Obtener Mis Catálogos
```http
GET /catalogs/my-catalogs?type=MENU
Authorization: Bearer {token}
```

#### Obtener Catálogo por ID
```http
GET /catalogs/:catalogId
Authorization: Bearer {token}
```

#### Actualizar Catálogo
```http
PUT /catalogs/:catalogId
Authorization: Bearer {token}

Body:
{
  "name": "Menú Actualizado",
  "status": "ACTIVE"
}
```

#### Eliminar Catálogo
```http
DELETE /catalogs/:catalogId
Authorization: Bearer {token}
```

#### Archivar Catálogo
```http
PUT /catalogs/:catalogId/archive
Authorization: Bearer {token}
```

### Items

#### Agregar Item
```http
POST /catalogs/:catalogId/items
Authorization: Bearer {token}

Body:
{
  "name": "Pizza Margherita",
  "description": "Tomate, mozzarella, albahaca",
  "price": 12.99,
  "photoURL": "https://...",
  "attributes": {
    "size": "medium",
    "ingredients": ["tomate", "mozzarella", "albahaca"]
  }
}
```

#### Obtener Item
```http
GET /catalogs/:catalogId/items/:itemId
Authorization: Bearer {token}
```

#### Actualizar Item
```http
PUT /catalogs/:catalogId/items/:itemId
Authorization: Bearer {token}

Body:
{
  "price": 13.99,
  "status": "ACTIVE"
}
```

#### Eliminar Item
```http
DELETE /catalogs/:catalogId/items/:itemId
Authorization: Bearer {token}
```

### Catálogos Públicos

#### Buscar Catálogos Públicos
```http
GET /catalogs/public/search?type=MENU&tags=italian,pasta
```

#### Obtener Catálogo Público por Slug
```http
GET /catalogs/public/:slug
```

## 💡 Uso de Metadatos Flexibles

### Ejemplo para MENU
```typescript
{
  catalogType: 'MENU',
  metadata: {
    cuisine: 'italian',
    priceRange: '$$',
    deliveryTime: 30,
    dietary: ['vegetarian', 'vegan']
  },
  settings: {
    allowOrders: true,
    requireApproval: false,
    showPrices: true
  }
}
```

### Ejemplo para WARDROBE
```typescript
{
  catalogType: 'WARDROBE',
  metadata: {
    brand: 'Nike',
    season: 'summer',
    targetGender: 'unisex',
    category: 'sportswear'
  },
  settings: {
    showAvailability: true,
    allowReservations: true
  }
}
```

### Items con Atributos Específicos

#### Item de MENU
```typescript
{
  name: 'Pizza Margherita',
  attributes: {
    size: 'medium',
    ingredients: ['tomate', 'mozzarella', 'albahaca'],
    allergens: ['gluten', 'dairy'],
    spicyLevel: 0,
    calories: 800
  }
}
```

#### Item de WARDROBE
```typescript
{
  name: 'Camiseta Deportiva',
  attributes: {
    sizes: ['S', 'M', 'L', 'XL'],
    colors: ['red', 'blue', 'black'],
    material: 'polyester',
    brand: 'Nike',
    season: 'summer'
  }
}
```

## 🔄 Migración desde Menu/Wardrobes

Ver el script de migración en `src/catalog/scripts/migrate-to-catalog.ts` para convertir datos existentes.

```bash
# Ejecutar migración
npm run migrate:catalog
```

## 🛡️ Seguridad y Permisos

- ✅ Todos los endpoints protegidos con `JwtAuthGuard`
- ✅ Validación de propiedad (solo el owner puede editar/eliminar)
- ✅ Límites de capacidad según plan de membresía
- ✅ Endpoints públicos solo para catálogos con `isPublic: true`

## 📊 Analytics

El módulo registra automáticamente:
- **viewCount**: Número de veces que se ha visto el catálogo/item
- **orderCount**: Número de pedidos de un item (para MENU)
- **lastViewedAt**: Última visualización del catálogo

## 🚀 Estado de Implementación

1. ✅ Crear adapters de retrocompatibilidad (MenuController, WardrobeController)
2. ✅ Migrar datos existentes de Menu/Wardrobes
3. ✅ Deprecar módulos Menu y Wardrobes
4. ✅ Eliminar completamente módulos antiguos
5. ⬜ Agregar tests unitarios e integración
6. ⬜ Documentación Swagger completa

**Estado Actual:** Migración completada. El sistema ahora usa exclusivamente el módulo `catalog` para gestionar productos de todos los roles.

## 🤝 Integración con Otros Módulos

- **Auth**: Autenticación JWT y validación de usuario
- **Membership**: Límites de capacidad según plan
- **Cloudinary**: Upload de imágenes para catálogos/items
- **Orders**: Integración para pedidos desde catálogos MENU
- **Payments**: Procesamiento de pagos para items

## 📝 Notas Técnicas

- **Database**: PostgreSQL con columnas JSONB para flexibilidad
- **ORM**: TypeORM con relaciones optimizadas
- **Validación**: class-validator en todos los DTOs
- **Formato**: Prettier + ESLint
- **Testing**: Jest para unit tests

---

**Creado**: 2025-10-04  
**Versión**: 1.0.0  
**Status**: ✅ Implementado
