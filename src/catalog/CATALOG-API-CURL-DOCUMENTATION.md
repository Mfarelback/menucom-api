# 📚 Documentación de API - Módulo de Catálogos

> **Base URL**: `http://localhost:3001` (desarrollo) o tu dominio en producción  
> **Swagger Docs**: `http://localhost:3001/docs`

## 📋 Tabla de Contenidos

1. [Autenticación](#autenticación)
2. [Endpoints de Catálogos](#endpoints-de-catálogos)
3. [Endpoints de Items](#endpoints-de-items)
4. [Endpoints Públicos](#endpoints-públicos)
5. [Tipos de Datos](#tipos-de-datos)
6. [Ejemplos para Dart/Flutter](#ejemplos-para-dartflutter)

---

## 🔐 Autenticación

Todos los endpoints (excepto los públicos) requieren autenticación mediante JWT Bearer Token.

```bash
# Obtener token (ejemplo)
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "usuario@example.com",
    "password": "tu_password"
  }'
```

**Respuesta**:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

## 📦 Endpoints de Catálogos

### 1. Crear Catálogo

**Endpoint**: `POST /catalogs`  
**Auth**: Requerida  
**Content-Type**: `multipart/form-data`

```bash
curl -X POST http://localhost:3001/catalogs \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "catalogType=menu" \
  -F "name=Menú Principal" \
  -F "description=Nuestro menú con los mejores platillos" \
  -F "isPublic=true" \
  -F 'metadata={"cuisine":"italian","priceRange":"$$"}' \
  -F 'settings={"allowOrders":true,"showPrices":true}' \
  -F "tags=italiana,pizza,pasta" \
  -F "coverImage=@/path/to/image.jpg"
```

**Campos**:
- `catalogType` (requerido): `menu` | `wardrobe` | `product_list` | `service_list` | `marketplace`
- `name` (opcional): String (max 255 caracteres)
- `description` (opcional): String
- `isPublic` (opcional): Boolean (default: true)
- `metadata` (opcional): JSON string
- `settings` (opcional): JSON string
- `tags` (opcional): String separado por comas o array
- `coverImage` (opcional): Archivo de imagen

**Respuesta Exitosa** (201):
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "catalogType": "menu",
  "name": "Menú Principal",
  "description": "Nuestro menú con los mejores platillos",
  "ownerId": "user-123",
  "status": "active",
  "slug": "menu-principal",
  "isPublic": true,
  "coverImageUrl": "https://res.cloudinary.com/...",
  "itemCount": 0,
  "capacity": 10,
  "metadata": {
    "cuisine": "italian",
    "priceRange": "$$"
  },
  "settings": {
    "allowOrders": true,
    "showPrices": true
  },
  "tags": ["italiana", "pizza", "pasta"],
  "createdAt": "2025-11-08T12:00:00.000Z",
  "updatedAt": "2025-11-08T12:00:00.000Z"
}
```

**Notas**:
- La capacidad se determina por el plan de membresía:
  - FREE: 10 items
  - PREMIUM: 500 items
  - ENTERPRISE: ilimitado

---

### 2. Obtener Mis Catálogos

**Endpoint**: `GET /catalogs/my-catalogs`  
**Auth**: Requerida

```bash
# Todos los catálogos
curl -X GET http://localhost:3001/catalogs/my-catalogs \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Filtrar por tipo
curl -X GET "http://localhost:3001/catalogs/my-catalogs?type=menu" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Query Parameters**:
- `type` (opcional): `menu` | `wardrobe` | `product_list` | `service_list` | `marketplace`

**Respuesta Exitosa** (200):
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "catalogType": "menu",
    "name": "Menú Principal",
    "status": "active",
    "itemCount": 5,
    "capacity": 10,
    "coverImageUrl": "https://...",
    "createdAt": "2025-11-08T12:00:00.000Z"
  }
]
```

---

### 3. Obtener Catálogo por ID

**Endpoint**: `GET /catalogs/:catalogId`  
**Auth**: Requerida

```bash
curl -X GET http://localhost:3001/catalogs/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Respuesta Exitosa** (200):
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "catalogType": "menu",
  "name": "Menú Principal",
  "description": "Nuestro menú con los mejores platillos",
  "ownerId": "user-123",
  "status": "active",
  "slug": "menu-principal",
  "isPublic": true,
  "coverImageUrl": "https://...",
  "itemCount": 5,
  "capacity": 10,
  "metadata": {},
  "settings": {},
  "tags": ["italiana"],
  "items": [
    {
      "id": "item-1",
      "name": "Pizza Margherita",
      "price": 12.99,
      "photoURL": "https://..."
    }
  ],
  "createdAt": "2025-11-08T12:00:00.000Z",
  "updatedAt": "2025-11-08T12:00:00.000Z"
}
```

---

### 4. Actualizar Catálogo

**Endpoint**: `PUT /catalogs/:catalogId`  
**Auth**: Requerida  
**Content-Type**: `multipart/form-data`

```bash
curl -X PUT http://localhost:3001/catalogs/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "name=Menú Actualizado" \
  -F "description=Nueva descripción" \
  -F "status=active" \
  -F "isPublic=false" \
  -F 'metadata={"newKey":"newValue"}' \
  -F "coverImage=@/path/to/new-image.jpg"
```

**Campos Actualizables**:
- `name` (opcional): String
- `description` (opcional): String
- `status` (opcional): `active` | `draft` | `inactive` | `archived`
- `slug` (opcional): String
- `isPublic` (opcional): Boolean
- `metadata` (opcional): JSON string
- `settings` (opcional): JSON string
- `tags` (opcional): String separado por comas
- `coverImage` (opcional): Nueva imagen

**Respuesta Exitosa** (200):
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Menú Actualizado",
  "description": "Nueva descripción",
  "status": "active",
  "updatedAt": "2025-11-08T13:00:00.000Z"
}
```

---

### 5. Eliminar Catálogo

**Endpoint**: `DELETE /catalogs/:catalogId`  
**Auth**: Requerida

```bash
curl -X DELETE http://localhost:3001/catalogs/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Respuesta Exitosa** (200):
```json
{
  "message": "Catálogo eliminado exitosamente",
  "catalogId": "550e8400-e29b-41d4-a716-446655440000"
}
```

---

### 6. Archivar Catálogo

**Endpoint**: `PUT /catalogs/:catalogId/archive`  
**Auth**: Requerida

```bash
curl -X PUT http://localhost:3001/catalogs/550e8400-e29b-41d4-a716-446655440000/archive \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Respuesta Exitosa** (200):
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "archived",
  "archivedAt": "2025-11-08T14:00:00.000Z"
}
```

---

## 🛍️ Endpoints de Items

### 1. Crear Item en Catálogo

**Endpoint**: `POST /catalogs/:catalogId/items`  
**Auth**: Requerida  
**Content-Type**: `multipart/form-data`

```bash
curl -X POST http://localhost:3001/catalogs/550e8400-e29b-41d4-a716-446655440000/items \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "name=Pizza Margherita" \
  -F "description=Pizza clásica con tomate, mozzarella y albahaca" \
  -F "price=12.99" \
  -F "discountPrice=9.99" \
  -F "isAvailable=true" \
  -F "isFeatured=false" \
  -F "quantity=10" \
  -F "sku=PIZZA-MARG-001" \
  -F "category=Pizzas" \
  -F 'attributes={"ingredients":["tomate","mozzarella","albahaca"],"calories":450}' \
  -F "photo=@/path/to/pizza.jpg"
```

**Campos**:
- `name` (requerido): String (max 255 caracteres)
- `description` (opcional): String
- `price` (requerido): Number (mínimo 0)
- `discountPrice` (opcional): Number
- `quantity` (opcional): Integer (default: 0)
- `sku` (opcional): String (max 100 caracteres)
- `isAvailable` (opcional): Boolean (default: true)
- `isFeatured` (opcional): Boolean (default: false)
- `attributes` (opcional): JSON string con datos personalizados
- `category` (opcional): String (max 100 caracteres)
- `tags` (opcional): Array de strings
- `displayOrder` (opcional): Integer
- `photo` (opcional): Archivo de imagen

**Respuesta Exitosa** (201):
```json
{
  "id": "item-550e8400-e29b-41d4-a716-446655440001",
  "catalogId": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Pizza Margherita",
  "description": "Pizza clásica con tomate, mozzarella y albahaca",
  "photoURL": "https://res.cloudinary.com/...",
  "price": 12.99,
  "discountPrice": 9.99,
  "quantity": 10,
  "sku": "PIZZA-MARG-001",
  "status": "available",
  "isAvailable": true,
  "isFeatured": false,
  "category": "Pizzas",
  "attributes": {
    "ingredients": ["tomate", "mozzarella", "albahaca"],
    "calories": 450
  },
  "displayOrder": 0,
  "createdAt": "2025-11-08T15:00:00.000Z",
  "updatedAt": "2025-11-08T15:00:00.000Z"
}
```

---

### 2. Obtener Item por ID

**Endpoint**: `GET /catalogs/:catalogId/items/:itemId`  
**Auth**: Requerida

```bash
curl -X GET http://localhost:3001/catalogs/550e8400-e29b-41d4-a716-446655440000/items/item-550e8400-e29b-41d4-a716-446655440001 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Respuesta Exitosa** (200):
```json
{
  "id": "item-550e8400-e29b-41d4-a716-446655440001",
  "catalogId": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Pizza Margherita",
  "description": "Pizza clásica con tomate, mozzarella y albahaca",
  "photoURL": "https://...",
  "price": 12.99,
  "discountPrice": 9.99,
  "quantity": 10,
  "sku": "PIZZA-MARG-001",
  "status": "available",
  "isAvailable": true,
  "isFeatured": false,
  "category": "Pizzas",
  "attributes": {
    "ingredients": ["tomate", "mozzarella", "albahaca"],
    "calories": 450
  },
  "additionalImages": [],
  "tags": [],
  "displayOrder": 0,
  "createdAt": "2025-11-08T15:00:00.000Z",
  "updatedAt": "2025-11-08T15:00:00.000Z"
}
```

---

### 3. Actualizar Item

**Endpoint**: `PUT /catalogs/:catalogId/items/:itemId`  
**Auth**: Requerida  
**Content-Type**: `multipart/form-data`

```bash
curl -X PUT http://localhost:3001/catalogs/550e8400-e29b-41d4-a716-446655440000/items/item-550e8400-e29b-41d4-a716-446655440001 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "name=Pizza Margherita Premium" \
  -F "price=14.99" \
  -F "discountPrice=12.99" \
  -F "isAvailable=true" \
  -F "status=available" \
  -F 'attributes={"ingredients":["tomate","mozzarella premium","albahaca fresca"],"calories":500}' \
  -F "photo=@/path/to/new-pizza-photo.jpg"
```

**Campos Actualizables**:
- `name` (opcional): String
- `description` (opcional): String
- `photoURL` (opcional): String URL
- `price` (opcional): Number
- `discountPrice` (opcional): Number
- `quantity` (opcional): Integer
- `sku` (opcional): String
- `status` (opcional): `available` | `out_of_stock` | `discontinued` | `coming_soon`
- `isAvailable` (opcional): Boolean
- `isFeatured` (opcional): Boolean
- `attributes` (opcional): JSON string
- `additionalImages` (opcional): Array de URLs
- `category` (opcional): String
- `tags` (opcional): Array de strings
- `displayOrder` (opcional): Integer
- `photo` (opcional): Nueva imagen

**Respuesta Exitosa** (200):
```json
{
  "id": "item-550e8400-e29b-41d4-a716-446655440001",
  "name": "Pizza Margherita Premium",
  "price": 14.99,
  "discountPrice": 12.99,
  "photoURL": "https://res.cloudinary.com/new-image...",
  "updatedAt": "2025-11-08T16:00:00.000Z"
}
```

---

### 4. Eliminar Item

**Endpoint**: `DELETE /catalogs/:catalogId/items/:itemId`  
**Auth**: Requerida

```bash
curl -X DELETE http://localhost:3001/catalogs/550e8400-e29b-41d4-a716-446655440000/items/item-550e8400-e29b-41d4-a716-446655440001 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Respuesta Exitosa** (200):
```json
{
  "message": "Item eliminado exitosamente",
  "itemId": "item-550e8400-e29b-41d4-a716-446655440001"
}
```

---

## 🌐 Endpoints Públicos

### 1. Buscar Catálogos Públicos

**Endpoint**: `GET /catalogs/public/search`  
**Auth**: No requerida

```bash
# Búsqueda básica
curl -X GET http://localhost:3001/catalogs/public/search

# Filtrar por tipo
curl -X GET "http://localhost:3001/catalogs/public/search?type=menu"

# Filtrar por tags
curl -X GET "http://localhost:3001/catalogs/public/search?tags=italiana,pizza"

# Combinación
curl -X GET "http://localhost:3001/catalogs/public/search?type=menu&tags=italiana"
```

**Query Parameters**:
- `type` (opcional): Tipo de catálogo
- `tags` (opcional): Tags separados por coma

**Respuesta Exitosa** (200):
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "catalogType": "menu",
    "name": "Menú Principal",
    "description": "Nuestro menú con los mejores platillos",
    "slug": "menu-principal",
    "coverImageUrl": "https://...",
    "itemCount": 5,
    "tags": ["italiana", "pizza"],
    "metadata": {
      "cuisine": "italian"
    },
    "createdAt": "2025-11-08T12:00:00.000Z"
  }
]
```

---

### 2. Obtener Catálogo Público por Slug

**Endpoint**: `GET /catalogs/public/:slug`  
**Auth**: No requerida

```bash
curl -X GET http://localhost:3001/catalogs/public/menu-principal
```

**Respuesta Exitosa** (200):
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "catalogType": "menu",
  "name": "Menú Principal",
  "description": "Nuestro menú con los mejores platillos",
  "slug": "menu-principal",
  "coverImageUrl": "https://...",
  "isPublic": true,
  "itemCount": 5,
  "tags": ["italiana", "pizza"],
  "metadata": {},
  "settings": {},
  "items": [
    {
      "id": "item-1",
      "name": "Pizza Margherita",
      "description": "Pizza clásica",
      "price": 12.99,
      "discountPrice": 9.99,
      "photoURL": "https://...",
      "isAvailable": true,
      "category": "Pizzas"
    }
  ],
  "createdAt": "2025-11-08T12:00:00.000Z",
  "updatedAt": "2025-11-08T12:00:00.000Z"
}
```

---

## 📊 Tipos de Datos

### CatalogType (Enum)
```typescript
enum CatalogType {
  MENU = 'menu',              // Menús de restaurantes
  WARDROBE = 'wardrobe',      // Guardarropas/tiendas de ropa
  PRODUCT_LIST = 'product_list', // Lista de productos genérica
  SERVICE_LIST = 'service_list', // Lista de servicios
  MARKETPLACE = 'marketplace'    // Marketplace/catálogo de vendedores
}
```

### CatalogStatus (Enum)
```typescript
enum CatalogStatus {
  DRAFT = 'draft',       // Borrador, no visible públicamente
  ACTIVE = 'active',     // Activo y visible
  INACTIVE = 'inactive', // Inactivo temporalmente
  ARCHIVED = 'archived'  // Archivado, no editable
}
```

### CatalogItemStatus (Enum)
```typescript
enum CatalogItemStatus {
  AVAILABLE = 'available',       // Disponible para compra/pedido
  OUT_OF_STOCK = 'out_of_stock', // Sin stock
  DISCONTINUED = 'discontinued',  // Descontinuado
  COMING_SOON = 'coming_soon'    // Próximamente
}
```

### Estructura de Catálogo
```typescript
interface Catalog {
  id: string;
  catalogType: CatalogType;
  name: string;
  description?: string;
  ownerId: string;
  status: CatalogStatus;
  slug: string;
  isPublic: boolean;
  coverImageUrl?: string;
  itemCount: number;
  capacity: number;
  metadata: Record<string, any>;
  settings: Record<string, any>;
  tags: string[];
  items?: CatalogItem[];
  createdAt: Date;
  updatedAt: Date;
  archivedAt?: Date;
}
```

### Estructura de Item
```typescript
interface CatalogItem {
  id: string;
  catalogId: string;
  name: string;
  description?: string;
  photoURL?: string;
  price: number;
  discountPrice?: number;
  quantity: number;
  sku?: string;
  status: CatalogItemStatus;
  isAvailable: boolean;
  isFeatured: boolean;
  attributes: Record<string, any>;
  additionalImages: string[];
  category?: string;
  tags: string[];
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
}
```

---

## 🎯 Ejemplos para Dart/Flutter

### Configuración Base

```dart
// lib/config/api_config.dart
class ApiConfig {
  static const String baseUrl = 'http://localhost:3001';
  static const String catalogsEndpoint = '/catalogs';
  
  static Map<String, String> headers(String? token) => {
    'Content-Type': 'application/json',
    if (token != null) 'Authorization': 'Bearer $token',
  };
  
  static Map<String, String> multipartHeaders(String? token) => {
    if (token != null) 'Authorization': 'Bearer $token',
  };
}
```

### Modelos de Datos

```dart
// lib/models/catalog_type.dart
enum CatalogType {
  menu,
  wardrobe,
  productList,
  serviceList,
  marketplace;
  
  String toJson() {
    switch (this) {
      case CatalogType.menu:
        return 'menu';
      case CatalogType.wardrobe:
        return 'wardrobe';
      case CatalogType.productList:
        return 'product_list';
      case CatalogType.serviceList:
        return 'service_list';
      case CatalogType.marketplace:
        return 'marketplace';
    }
  }
  
  static CatalogType fromJson(String value) {
    switch (value) {
      case 'menu':
        return CatalogType.menu;
      case 'wardrobe':
        return CatalogType.wardrobe;
      case 'product_list':
        return CatalogType.productList;
      case 'service_list':
        return CatalogType.serviceList;
      case 'marketplace':
        return CatalogType.marketplace;
      default:
        throw ArgumentError('Invalid CatalogType: $value');
    }
  }
}

// lib/models/catalog_status.dart
enum CatalogStatus {
  draft,
  active,
  inactive,
  archived;
  
  String toJson() => name;
  
  static CatalogStatus fromJson(String value) {
    return CatalogStatus.values.firstWhere(
      (e) => e.name == value,
      orElse: () => throw ArgumentError('Invalid CatalogStatus: $value'),
    );
  }
}

// lib/models/catalog.dart
import 'package:freezed_annotation/freezed_annotation.dart';
import 'catalog_type.dart';
import 'catalog_status.dart';
import 'catalog_item.dart';

part 'catalog.freezed.dart';
part 'catalog.g.dart';

@freezed
class Catalog with _$Catalog {
  const factory Catalog({
    required String id,
    required CatalogType catalogType,
    required String name,
    String? description,
    required String ownerId,
    required CatalogStatus status,
    required String slug,
    required bool isPublic,
    String? coverImageUrl,
    required int itemCount,
    required int capacity,
    @Default({}) Map<String, dynamic> metadata,
    @Default({}) Map<String, dynamic> settings,
    @Default([]) List<String> tags,
    List<CatalogItem>? items,
    required DateTime createdAt,
    required DateTime updatedAt,
    DateTime? archivedAt,
  }) = _Catalog;
  
  factory Catalog.fromJson(Map<String, dynamic> json) => _$CatalogFromJson(json);
}

// lib/models/catalog_item.dart
import 'package:freezed_annotation/freezed_annotation.dart';
import 'catalog_item_status.dart';

part 'catalog_item.freezed.dart';
part 'catalog_item.g.dart';

@freezed
class CatalogItem with _$CatalogItem {
  const factory CatalogItem({
    required String id,
    required String catalogId,
    required String name,
    String? description,
    String? photoURL,
    required double price,
    double? discountPrice,
    @Default(0) int quantity,
    String? sku,
    required CatalogItemStatus status,
    @Default(true) bool isAvailable,
    @Default(false) bool isFeatured,
    @Default({}) Map<String, dynamic> attributes,
    @Default([]) List<String> additionalImages,
    String? category,
    @Default([]) List<String> tags,
    @Default(0) int displayOrder,
    required DateTime createdAt,
    required DateTime updatedAt,
  }) = _CatalogItem;
  
  factory CatalogItem.fromJson(Map<String, dynamic> json) => _$CatalogItemFromJson(json);
}
```

### Servicio de API (Repository Pattern)

```dart
// lib/services/catalog_service.dart
import 'dart:io';
import 'package:dio/dio.dart';
import 'package:http_parser/http_parser.dart';
import '../models/catalog.dart';
import '../models/catalog_item.dart';
import '../models/catalog_type.dart';
import '../config/api_config.dart';

class CatalogService {
  final Dio _dio;
  final String? _token;
  
  CatalogService(this._dio, this._token);
  
  // ==================== CATÁLOGOS ====================
  
  /// Crear un nuevo catálogo
  Future<Catalog> createCatalog({
    required CatalogType catalogType,
    String? name,
    String? description,
    bool? isPublic,
    Map<String, dynamic>? metadata,
    Map<String, dynamic>? settings,
    List<String>? tags,
    File? coverImage,
  }) async {
    final formData = FormData.fromMap({
      'catalogType': catalogType.toJson(),
      if (name != null) 'name': name,
      if (description != null) 'description': description,
      if (isPublic != null) 'isPublic': isPublic.toString(),
      if (metadata != null) 'metadata': jsonEncode(metadata),
      if (settings != null) 'settings': jsonEncode(settings),
      if (tags != null && tags.isNotEmpty) 'tags': tags.join(','),
      if (coverImage != null)
        'coverImage': await MultipartFile.fromFile(
          coverImage.path,
          filename: coverImage.path.split('/').last,
          contentType: MediaType('image', 'jpeg'),
        ),
    });
    
    final response = await _dio.post(
      '${ApiConfig.baseUrl}${ApiConfig.catalogsEndpoint}',
      data: formData,
      options: Options(
        headers: ApiConfig.multipartHeaders(_token),
      ),
    );
    
    return Catalog.fromJson(response.data);
  }
  
  /// Obtener mis catálogos
  Future<List<Catalog>> getMyCatalogs({CatalogType? type}) async {
    final response = await _dio.get(
      '${ApiConfig.baseUrl}${ApiConfig.catalogsEndpoint}/my-catalogs',
      queryParameters: {
        if (type != null) 'type': type.toJson(),
      },
      options: Options(
        headers: ApiConfig.headers(_token),
      ),
    );
    
    return (response.data as List)
        .map((json) => Catalog.fromJson(json))
        .toList();
  }
  
  /// Obtener catálogo por ID
  Future<Catalog> getCatalogById(String catalogId) async {
    final response = await _dio.get(
      '${ApiConfig.baseUrl}${ApiConfig.catalogsEndpoint}/$catalogId',
      options: Options(
        headers: ApiConfig.headers(_token),
      ),
    );
    
    return Catalog.fromJson(response.data);
  }
  
  /// Actualizar catálogo
  Future<Catalog> updateCatalog({
    required String catalogId,
    String? name,
    String? description,
    CatalogStatus? status,
    String? slug,
    bool? isPublic,
    Map<String, dynamic>? metadata,
    Map<String, dynamic>? settings,
    List<String>? tags,
    File? coverImage,
  }) async {
    final formData = FormData.fromMap({
      if (name != null) 'name': name,
      if (description != null) 'description': description,
      if (status != null) 'status': status.toJson(),
      if (slug != null) 'slug': slug,
      if (isPublic != null) 'isPublic': isPublic.toString(),
      if (metadata != null) 'metadata': jsonEncode(metadata),
      if (settings != null) 'settings': jsonEncode(settings),
      if (tags != null) 'tags': tags.join(','),
      if (coverImage != null)
        'coverImage': await MultipartFile.fromFile(
          coverImage.path,
          filename: coverImage.path.split('/').last,
          contentType: MediaType('image', 'jpeg'),
        ),
    });
    
    final response = await _dio.put(
      '${ApiConfig.baseUrl}${ApiConfig.catalogsEndpoint}/$catalogId',
      data: formData,
      options: Options(
        headers: ApiConfig.multipartHeaders(_token),
      ),
    );
    
    return Catalog.fromJson(response.data);
  }
  
  /// Eliminar catálogo
  Future<void> deleteCatalog(String catalogId) async {
    await _dio.delete(
      '${ApiConfig.baseUrl}${ApiConfig.catalogsEndpoint}/$catalogId',
      options: Options(
        headers: ApiConfig.headers(_token),
      ),
    );
  }
  
  /// Archivar catálogo
  Future<Catalog> archiveCatalog(String catalogId) async {
    final response = await _dio.put(
      '${ApiConfig.baseUrl}${ApiConfig.catalogsEndpoint}/$catalogId/archive',
      options: Options(
        headers: ApiConfig.headers(_token),
      ),
    );
    
    return Catalog.fromJson(response.data);
  }
  
  // ==================== ITEMS ====================
  
  /// Agregar item al catálogo
  Future<CatalogItem> addItem({
    required String catalogId,
    required String name,
    String? description,
    required double price,
    double? discountPrice,
    int? quantity,
    String? sku,
    bool? isAvailable,
    bool? isFeatured,
    Map<String, dynamic>? attributes,
    String? category,
    List<String>? tags,
    int? displayOrder,
    File? photo,
  }) async {
    final formData = FormData.fromMap({
      'name': name,
      if (description != null) 'description': description,
      'price': price.toString(),
      if (discountPrice != null) 'discountPrice': discountPrice.toString(),
      if (quantity != null) 'quantity': quantity.toString(),
      if (sku != null) 'sku': sku,
      if (isAvailable != null) 'isAvailable': isAvailable.toString(),
      if (isFeatured != null) 'isFeatured': isFeatured.toString(),
      if (attributes != null) 'attributes': jsonEncode(attributes),
      if (category != null) 'category': category,
      if (tags != null && tags.isNotEmpty) 'tags': tags.join(','),
      if (displayOrder != null) 'displayOrder': displayOrder.toString(),
      if (photo != null)
        'photo': await MultipartFile.fromFile(
          photo.path,
          filename: photo.path.split('/').last,
          contentType: MediaType('image', 'jpeg'),
        ),
    });
    
    final response = await _dio.post(
      '${ApiConfig.baseUrl}${ApiConfig.catalogsEndpoint}/$catalogId/items',
      data: formData,
      options: Options(
        headers: ApiConfig.multipartHeaders(_token),
      ),
    );
    
    return CatalogItem.fromJson(response.data);
  }
  
  /// Obtener item por ID
  Future<CatalogItem> getItemById(String catalogId, String itemId) async {
    final response = await _dio.get(
      '${ApiConfig.baseUrl}${ApiConfig.catalogsEndpoint}/$catalogId/items/$itemId',
      options: Options(
        headers: ApiConfig.headers(_token),
      ),
    );
    
    return CatalogItem.fromJson(response.data);
  }
  
  /// Actualizar item
  Future<CatalogItem> updateItem({
    required String catalogId,
    required String itemId,
    String? name,
    String? description,
    double? price,
    double? discountPrice,
    int? quantity,
    String? sku,
    CatalogItemStatus? status,
    bool? isAvailable,
    bool? isFeatured,
    Map<String, dynamic>? attributes,
    String? category,
    List<String>? tags,
    int? displayOrder,
    File? photo,
  }) async {
    final formData = FormData.fromMap({
      if (name != null) 'name': name,
      if (description != null) 'description': description,
      if (price != null) 'price': price.toString(),
      if (discountPrice != null) 'discountPrice': discountPrice.toString(),
      if (quantity != null) 'quantity': quantity.toString(),
      if (sku != null) 'sku': sku,
      if (status != null) 'status': status.toJson(),
      if (isAvailable != null) 'isAvailable': isAvailable.toString(),
      if (isFeatured != null) 'isFeatured': isFeatured.toString(),
      if (attributes != null) 'attributes': jsonEncode(attributes),
      if (category != null) 'category': category,
      if (tags != null && tags.isNotEmpty) 'tags': tags.join(','),
      if (displayOrder != null) 'displayOrder': displayOrder.toString(),
      if (photo != null)
        'photo': await MultipartFile.fromFile(
          photo.path,
          filename: photo.path.split('/').last,
          contentType: MediaType('image', 'jpeg'),
        ),
    });
    
    final response = await _dio.put(
      '${ApiConfig.baseUrl}${ApiConfig.catalogsEndpoint}/$catalogId/items/$itemId',
      data: formData,
      options: Options(
        headers: ApiConfig.multipartHeaders(_token),
      ),
    );
    
    return CatalogItem.fromJson(response.data);
  }
  
  /// Eliminar item
  Future<void> deleteItem(String catalogId, String itemId) async {
    await _dio.delete(
      '${ApiConfig.baseUrl}${ApiConfig.catalogsEndpoint}/$catalogId/items/$itemId',
      options: Options(
        headers: ApiConfig.headers(_token),
      ),
    );
  }
  
  // ==================== ENDPOINTS PÚBLICOS ====================
  
  /// Buscar catálogos públicos
  Future<List<Catalog>> searchPublicCatalogs({
    CatalogType? type,
    List<String>? tags,
  }) async {
    final response = await _dio.get(
      '${ApiConfig.baseUrl}${ApiConfig.catalogsEndpoint}/public/search',
      queryParameters: {
        if (type != null) 'type': type.toJson(),
        if (tags != null && tags.isNotEmpty) 'tags': tags.join(','),
      },
    );
    
    return (response.data as List)
        .map((json) => Catalog.fromJson(json))
        .toList();
  }
  
  /// Obtener catálogo público por slug
  Future<Catalog> getPublicCatalog(String slug) async {
    final response = await _dio.get(
      '${ApiConfig.baseUrl}${ApiConfig.catalogsEndpoint}/public/$slug',
    );
    
    return Catalog.fromJson(response.data);
  }
}
```

### Provider/Repository Setup (Riverpod)

```dart
// lib/providers/catalog_provider.dart
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:dio/dio.dart';
import '../services/catalog_service.dart';

final dioProvider = Provider<Dio>((ref) {
  return Dio(BaseOptions(
    connectTimeout: const Duration(seconds: 30),
    receiveTimeout: const Duration(seconds: 30),
  ));
});

final authTokenProvider = StateProvider<String?>((ref) => null);

final catalogServiceProvider = Provider<CatalogService>((ref) {
  final dio = ref.watch(dioProvider);
  final token = ref.watch(authTokenProvider);
  return CatalogService(dio, token);
});

final myCatalogsProvider = FutureProvider<List<Catalog>>((ref) async {
  final service = ref.watch(catalogServiceProvider);
  return service.getMyCatalogs();
});

final catalogByIdProvider = FutureProvider.family<Catalog, String>(
  (ref, catalogId) async {
    final service = ref.watch(catalogServiceProvider);
    return service.getCatalogById(catalogId);
  },
);
```

### Ejemplo de Uso en Widget

```dart
// lib/screens/catalog_list_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class CatalogListScreen extends ConsumerWidget {
  const CatalogListScreen({Key? key}) : super(key: key);
  
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final catalogsAsync = ref.watch(myCatalogsProvider);
    
    return Scaffold(
      appBar: AppBar(
        title: const Text('Mis Catálogos'),
      ),
      body: catalogsAsync.when(
        data: (catalogs) => ListView.builder(
          itemCount: catalogs.length,
          itemBuilder: (context, index) {
            final catalog = catalogs[index];
            return CatalogCard(catalog: catalog);
          },
        ),
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, stack) => Center(
          child: Text('Error: $error'),
        ),
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () {
          // Navegar a pantalla de creación
        },
        child: const Icon(Icons.add),
      ),
    );
  }
}
```

---

## 🔥 Notas Importantes

1. **Autenticación**: Todos los endpoints (excepto públicos) requieren token JWT en el header `Authorization: Bearer {token}`

2. **Multipart/Form-Data**: Los endpoints que aceptan imágenes usan `multipart/form-data`. Los campos JSON (`metadata`, `settings`, `attributes`) deben enviarse como strings JSON.

3. **Capacidad de Catálogos**: La capacidad se determina automáticamente según el plan:
   - FREE: 10 items
   - PREMIUM: 500 items
   - ENTERPRISE: ilimitado

4. **Imágenes**: Las imágenes se suben a Cloudinary automáticamente y retornan URLs.

5. **Slugs**: Se generan automáticamente desde el nombre, pero pueden personalizarse.

6. **Tags**: Pueden enviarse como array o como string separado por comas.

7. **Transformaciones**: Los DTOs manejan automáticamente conversiones de tipos (strings a números, JSON parsing, etc.).

8. **Validación**: Todos los endpoints validan datos usando class-validator.

---

## 📝 Errores Comunes

### 401 Unauthorized
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```
**Solución**: Verificar que el token JWT sea válido y esté presente en el header.

### 400 Bad Request
```json
{
  "statusCode": 400,
  "message": ["price must be a positive number"],
  "error": "Bad Request"
}
```
**Solución**: Revisar que los datos enviados cumplan con las validaciones requeridas.

### 404 Not Found
```json
{
  "statusCode": 404,
  "message": "Catálogo no encontrado"
}
```
**Solución**: Verificar que el ID del catálogo exista y pertenezca al usuario autenticado.

### 403 Forbidden
```json
{
  "statusCode": 403,
  "message": "No tienes permisos para acceder a este catálogo"
}
```
**Solución**: El usuario no es el propietario del catálogo.

---

¿Necesitas más ejemplos o tienes preguntas específicas? 🚀
