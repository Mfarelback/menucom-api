# Soporte de Archivos Multimedia - Catálogo

## 📷 Funcionalidades Agregadas

### **Upload de Imágenes Integrado**

Se agregó soporte completo para manejo de archivos multimedia en el módulo de catálogo:

#### ✅ **createCatalog** - Imagen de Portada
```http
POST /catalogs
Content-Type: multipart/form-data
Authorization: Bearer {token}

FormData:
- catalogType: "MENU"
- name: "Mi Restaurante"
- description: "Descripción del catálogo"
- coverImage: [FILE] # Imagen de portada
- metadata: '{"cuisine": "italian"}'
- tags: "pasta,pizza,italian"
```

#### ✅ **updateCatalog** - Actualizar Imagen de Portada
```http
PUT /catalogs/{catalogId}
Content-Type: multipart/form-data
Authorization: Bearer {token}

FormData:
- name: "Nombre actualizado"
- coverImage: [FILE] # Nueva imagen de portada
- metadata: '{"cuisine": "mexican"}'
```

#### ✅ **addItem** - Imagen de Item
```http
POST /catalogs/{catalogId}/items
Content-Type: multipart/form-data
Authorization: Bearer {token}

FormData:
- name: "Pizza Margherita"
- description: "Deliciosa pizza italiana"
- price: 12.99
- photo: [FILE] # Imagen del item
- attributes: '{"size": "medium", "ingredients": ["tomate", "mozzarella"]}'
```

#### ✅ **updateItem** - Actualizar Imagen de Item
```http
PUT /catalogs/{catalogId}/items/{itemId}
Content-Type: multipart/form-data
Authorization: Bearer {token}

FormData:
- name: "Pizza Margherita Premium"
- price: 15.99
- photo: [FILE] # Nueva imagen del item
```

## 🔧 Implementación Técnica

### **Interceptores de Archivos**
```typescript
@UseInterceptors(FileInterceptor('coverImage'))  // Para catálogos
@UseInterceptors(FileInterceptor('photo'))       // Para items
```

### **Swagger Documentation**
```typescript
@ApiConsumes('multipart/form-data')
@ApiBody({
  schema: {
    type: 'object',
    properties: {
      coverImage: {
        type: 'string',
        format: 'binary',
        description: 'Imagen de portada',
      },
      // ... otros campos
    }
  }
})
```

### **Integración con Cloudinary**
- ✅ Upload automático a Cloudinary
- ✅ URLs seguras generadas automáticamente
- ✅ Manejo de errores en upload
- ✅ Validación de tipos de archivo

### **Parsing Inteligente de Campos**

#### JSON Fields (metadata, settings, attributes)
```javascript
// Cliente envía como string
FormData: metadata = '{"cuisine": "italian", "priceRange": "$$"}'

// Servidor parsea automáticamente
metadata: { cuisine: "italian", priceRange: "$$" }
```

#### Tags como CSV
```javascript
// Cliente envía como string
FormData: tags = "pasta,pizza,italian,restaurant"

// Servidor convierte a array
tags: ["pasta", "pizza", "italian", "restaurant"]
```

## 🎯 Endpoints Actualizados

| Endpoint | Método | Archivo Soportado | Campo FormData |
|----------|--------|------------------|----------------|
| `/catalogs` | POST | ✅ Portada | `coverImage` |
| `/catalogs/{id}` | PUT | ✅ Portada | `coverImage` |
| `/catalogs/{id}/items` | POST | ✅ Foto | `photo` |
| `/catalogs/{id}/items/{itemId}` | PUT | ✅ Foto | `photo` |

## 📋 Validaciones

### **Archivos**
- ✅ Validación automática por Cloudinary
- ✅ Manejo de errores de upload
- ✅ Campos opcionales (no requeridos)

### **Campos JSON**
- ✅ Parsing seguro con try/catch
- ✅ Fallback a objeto vacío `{}` en caso de error
- ✅ Eliminación de campos con errores en updates

### **Tags**
- ✅ Split por comas automático
- ✅ Trim de espacios en blanco
- ✅ Filtrado de tags vacíos

## 🚀 Ejemplos de Uso Frontend

### **JavaScript/Fetch**
```javascript
const formData = new FormData();
formData.append('catalogType', 'MENU');
formData.append('name', 'Mi Restaurante');
formData.append('coverImage', fileInput.files[0]);
formData.append('metadata', JSON.stringify({
  cuisine: 'italian',
  priceRange: '$$'
}));
formData.append('tags', 'pasta,pizza,italian');

fetch('/catalogs', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  body: formData
});
```

### **React con Axios**
```jsx
const uploadCatalog = async (catalogData, imageFile) => {
  const formData = new FormData();
  
  // Agregar campos regulares
  Object.keys(catalogData).forEach(key => {
    if (key === 'metadata' || key === 'settings') {
      formData.append(key, JSON.stringify(catalogData[key]));
    } else if (key === 'tags' && Array.isArray(catalogData[key])) {
      formData.append(key, catalogData[key].join(','));
    } else {
      formData.append(key, catalogData[key]);
    }
  });
  
  // Agregar imagen
  if (imageFile) {
    formData.append('coverImage', imageFile);
  }
  
  return await axios.post('/catalogs', formData, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'multipart/form-data'
    }
  });
};
```

### **Flutter/Dart**
```dart
import 'package:dio/dio.dart';

Future<void> createCatalog(Map<String, dynamic> data, File? image) async {
  final formData = FormData();
  
  // Agregar campos
  data.forEach((key, value) {
    if (value is Map || value is List) {
      formData.fields.add(MapEntry(key, jsonEncode(value)));
    } else {
      formData.fields.add(MapEntry(key, value.toString()));
    }
  });
  
  // Agregar imagen
  if (image != null) {
    formData.files.add(MapEntry(
      'coverImage',
      await MultipartFile.fromFile(image.path),
    ));
  }
  
  final response = await dio.post('/catalogs', 
    data: formData,
    options: Options(
      headers: {'Authorization': 'Bearer $token'},
    ),
  );
}
```

## ⚙️ Configuración del Módulo

### **Dependencias Agregadas**
```typescript
// catalog.module.ts
imports: [
  TypeOrmModule.forFeature([Catalog, CatalogItem]),
  CloudinaryModule,  // ← Nuevo
]
```

### **Servicios Inyectados**
```typescript
// catalog.controller.ts
constructor(
  private readonly catalogService: CatalogService,
  private readonly cloudinaryService: CloudinaryService,  // ← Nuevo
) {}
```

---

**✅ Estado**: Implementado y funcionando  
**🎯 Compatible**: Frontend Web, Mobile, Postman  
**📁 Almacenamiento**: Cloudinary  
**🔒 Seguridad**: JWT Authentication requerida