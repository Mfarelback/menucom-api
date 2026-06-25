# Admin Notification Templates — FCM Push desde el Dashboard

> Sistema de templates de notificaciones push para el panel de administración.
> Permite enviar notificaciones FCM personalizadas a uno o múltiples usuarios usando plantillas con placeholders y deeplinks.

---

## 1. Entidad `NotificationTemplate`

```typescript
// src/notifications/entities/notification-template.entity.ts
import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';

@Entity('notification_templates')
@Index(['name'], { unique: true })
export class NotificationTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  @Index()
  name: string;
  // identificador interno único: "welcome", "payment_success", "promocion_producto"
  // validación: solo letras minúsculas, números y guiones bajos (/^[a-z0-9_]{3,100}$/)

  @Column({ type: 'varchar', length: 200 })
  title: string;
  // con placeholders: "¡Bienvenido {{userName}}!"
  // máximo 200 chars después de resolver placeholders (FCM notification.title)

  @Column({ type: 'text' })
  body: string;
  // con placeholders: "Hola {{userName}}, tu pago de ${{amount}} fue exitoso"
  // máximo 4000 chars después de resolver placeholders (FCM notification.body)

  @Column({ type: 'jsonb', nullable: true })
  data: Record<string, any> | null;
  // datos fijos del payload FCM. Se mergean con deep_link y click_action resueltos.
  // Máximo 4KB serializado (FCM data payload limit).
  // NO incluir keys sensibles: password, token, secret, key, auth, credential.

  @Column({ type: 'varchar', length: 500, nullable: true })
  deepLink: string | null;
  // "menucom://producto/{{productSlug}}" — soporta placeholders
  // Se inyecta en FCM data como key "deep_link"

  @Column({ type: 'varchar', length: 2048, nullable: true })
  imageUrl: string | null;
  // URL de imagen para la notificación (debe ser HTTPS)

  @Column({ type: 'boolean', default: true })
  isActive: boolean;
  // Soft-disable: templates inactivos no aparecen en envíos pero se preservan

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

---

## 2. Endpoints Admin

Todos protegidos con `@CanManageUsers()` — requiere rol `ADMIN` en contexto `GENERAL`.

### 2.1 Templates CRUD

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/notifications/admin/templates` | Crear template |
| `GET` | `/notifications/admin/templates` | Listar (paginado, con filtros) |
| `GET` | `/notifications/admin/templates/:id` | Obtener uno |
| `PATCH` | `/notifications/admin/templates/:id` | Actualizar |
| `DELETE` | `/notifications/admin/templates/:id` | Soft-delete (set isActive=false) |

### 2.2 Envío de Notificaciones

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/notifications/admin/users-with-tokens` | Lista usuarios con FCM token (paginado, búsqueda) |
| `POST` | `/notifications/admin/send` | Notificación personalizada directa |
| `POST` | `/notifications/admin/send-from-template/:templateId` | Notificación desde template con parámetros |

---

## 3. DTOs con Validación Robusta

### 3.1 CreateNotificationTemplateDto

```typescript
import {
  IsString, IsNotEmpty, IsOptional, IsObject,
  IsUrl, Matches, MaxLength, MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateNotificationTemplateDto {
  @ApiProperty({ example: 'promocion_producto' })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(100)
  @Matches(/^[a-z0-9_]+$/, {
    message: 'name solo permite minúsculas, números y guiones bajos',
  })
  name: string;

  @ApiProperty({ example: '¡{{productName}} en oferta!' })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @ApiProperty({ example: 'Hola {{userName}}, el {{productName}} está con {{discount}}% de descuento.' })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(4000)
  body: string;

  @ApiPropertyOptional({ example: { type: 'promotion', click_action: 'FLUTTER_NOTIFICATION_CLICK' } })
  @IsOptional()
  @IsObject()
  data?: Record<string, any>;

  @ApiPropertyOptional({ example: 'menucom://producto/{{productSlug}}' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  deepLink?: string;

  @ApiPropertyOptional({ example: 'https://res.cloudinary.com/.../producto.jpg' })
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(2048)
  imageUrl?: string;
}
```

### 3.2 UpdateNotificationTemplateDto

```typescript
export class UpdateNotificationTemplateDto {
  @ApiPropertyOptional({ example: 'promocion_producto_v2' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  @Matches(/^[a-z0-9_]+$/, {
    message: 'name solo permite minúsculas, números y guiones bajos',
  })
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  body?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  data?: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  deepLink?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(2048)
  imageUrl?: string;

  @ApiPropertyOptional({ description: 'Desactivar/reactivar template' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
```

### 3.3 SendAdminNotificationDto

```typescript
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsOptional, IsString,
  IsUUID, MaxLength, MinLength, IsUrl, IsObject } from 'class-validator';

export class SendAdminNotificationDto {
  @ApiProperty({ example: ['uuid-1', 'uuid-2'] })
  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMinSize(1, { message: 'Debe incluir al menos un userId' })
  @ArrayMaxSize(5000, { message: 'Máximo 5000 usuarios por envío (procesado en batches)' })
  userIds: string[];

  @ApiProperty({ example: 'Aviso importante' })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @ApiProperty({ example: 'El sistema estará en mantenimiento esta noche.' })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(4000)
  body: string;

  @ApiPropertyOptional({
    example: { type: 'system_alert', click_action: 'FLUTTER_NOTIFICATION_CLICK' },
  })
  @IsOptional()
  @IsObject()
  data?: Record<string, string>;

  @ApiPropertyOptional({ example: 'https://res.cloudinary.com/.../alert.jpg' })
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(2048)
  imageUrl?: string;
}
```

### 3.4 SendFromTemplateDto

```typescript
export class SendFromTemplateDto {
  @ApiProperty({ example: ['uuid-1', 'uuid-2'] })
  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMinSize(1, { message: 'Debe incluir al menos un userId' })
  @ArrayMaxSize(5000, { message: 'Máximo 5000 usuarios por envío' })
  userIds: string[];

  @ApiProperty({
    example: { userName: 'Juan', amount: '2500' },
    description: 'Placeholders. Valores siempre string. El servicio reemplaza {{key}} por value.',
  })
  @IsObject()
  params: Record<string, string>;
}
```

---

## 4. Ejemplos de Uso

### 4.1 Crear template

```http
POST /notifications/admin/templates
Content-Type: application/json
Authorization: Bearer <token-admin>
```

```json
{
  "name": "promocion_producto",
  "title": "¡{{productName}} en oferta!",
  "body": "Hola {{userName}}, el {{productName}} está con {{discount}}% de descuento. ¡Corré que vuelan!",
  "deepLink": "menucom://producto/{{productSlug}}",
  "data": {
    "type": "promotion",
    "click_action": "FLUTTER_NOTIFICATION_CLICK"
  },
  "imageUrl": "https://res.cloudinary.com/.../producto.jpg"
}
```

**Errores posibles:**

| Status | Condición | Mensaje |
|--------|-----------|---------|
| `409` | `name` ya existe | `Ya existe un template con el nombre 'promocion_producto'` |
| `400` | `name` no cumple regex | `name solo permite minúsculas, números y guiones bajos` |
| `400` | `imageUrl` no es HTTPS | `imageUrl must be a URL with HTTPS protocol` |
| `400` | `title` > 200 chars | `title must be shorter than or equal to 200 characters` |
| `400` | `body` > 4000 chars | `body must be shorter than or equal to 4000 characters` |

**Response 201:**
```json
{
  "id": "a1b2c3d4-...",
  "name": "promocion_producto",
  "title": "¡{{productName}} en oferta!",
  "body": "Hola {{userName}}, el {{productName}} está con {{discount}}% de descuento. ¡Corré que vuelan!",
  "deepLink": "menucom://producto/{{productSlug}}",
  "data": {
    "type": "promotion",
    "click_action": "FLUTTER_NOTIFICATION_CLICK"
  },
  "imageUrl": "https://res.cloudinary.com/.../producto.jpg",
  "isActive": true,
  "createdAt": "2026-06-24T12:00:00.000Z",
  "updatedAt": "2026-06-24T12:00:00.000Z"
}
```

### 4.2 Listar templates (paginado y con filtros)

```http
GET /notifications/admin/templates?page=1&limit=10&search=promo&isActive=true
Authorization: Bearer <token-admin>
```

**Query params:**

| Param | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `page` | int | `1` | Página (mín 1) |
| `limit` | int | `20` | Items por página (mín 1, máx 100) |
| `search` | string | — | Búsqueda parcial en `name`, `title`, `body` |
| `isActive` | boolean | — | Filtrar por estado activo/inactivo |
| `sortBy` | string | `updatedAt` | Campo de orden: `name`, `createdAt`, `updatedAt` |
| `sortOrder` | `ASC`\|`DESC` | `DESC` | Dirección del orden |

**Response:**
```json
{
  "data": [
    {
      "id": "a1b2c3d4-...",
      "name": "promocion_producto",
      "title": "¡{{productName}} en oferta!",
      "body": "Hola {{userName}}, el {{productName}} está con {{discount}}% de descuento...",
      "deepLink": "menucom://producto/{{productSlug}}",
      "data": { "type": "promotion" },
      "imageUrl": "https://res.cloudinary.com/.../producto.jpg",
      "isActive": true,
      "placeholderCount": 4,
      "updatedAt": "2026-06-24T12:00:00.000Z"
    }
  ],
  "meta": {
    "total": 1,
    "page": 1,
    "limit": 10,
    "totalPages": 1
  }
}
```

### 4.3 Enviar desde template

```http
POST /notifications/admin/send-from-template/a1b2c3d4-...
Content-Type: application/json
Authorization: Bearer <token-admin>
```

```json
{
  "userIds": ["uuid-juan", "uuid-maria"],
  "params": {
    "userName": "Juan",
    "productName": "Hamburguesa Clásica",
    "discount": "30",
    "productSlug": "hamburguesa-clasica"
  }
}
```

**Response exitosa (completa):**
```json
{
  "success": true,
  "templateUsed": "promocion_producto",
  "resolvedTitle": "¡Hamburguesa Clásica en oferta!",
  "resolvedBody": "Hola Juan, la Hamburguesa Clásica está con 30% de descuento. ¡Corré que vuelan!",
  "resolvedDeepLink": "menucom://producto/hamburguesa-clasica",
  "resolvedData": {
    "type": "promotion",
    "click_action": "FLUTTER_NOTIFICATION_CLICK",
    "deep_link": "menucom://producto/hamburguesa-clasica"
  },
  "results": {
    "successCount": 2,
    "failureCount": 0
  }
}
```

**Response con placeholders faltantes (warning):**
```json
{
  "success": true,
  "templateUsed": "promocion_producto",
  "resolvedTitle": "¡Hamburguesa Clásica en oferta!",
  "resolvedBody": "Hola Juan, la Hamburguesa Clásica está con {{discount}}% de descuento. ¡Corré que vuelan!",
  "resolvedDeepLink": "menucom://producto/hamburguesa-clasica",
  "unresolvedPlaceholders": ["discount"],
  "warning": "1 placeholder(s) sin resolver: discount",
  "results": {
    "successCount": 2,
    "failureCount": 0
  }
}
```

### 4.4 Enviar notificación directa (sin template)

```http
POST /notifications/admin/send
Content-Type: application/json
Authorization: Bearer <token-admin>
```

```json
{
  "userIds": ["uuid-juan", "uuid-maria"],
  "title": "Aviso importante",
  "body": "El sistema estará en mantenimiento esta noche.",
  "data": {
    "type": "system_alert",
    "click_action": "FLUTTER_NOTIFICATION_CLICK"
  }
}
```

**Response:**
```json
{
  "success": true,
  "results": {
    "successCount": 2,
    "failureCount": 0
  }
}
```

### 4.5 Usuarios con FCM token (paginado, con búsqueda)

```http
GET /notifications/admin/users-with-tokens?page=1&limit=20&search=juan
Authorization: Bearer <token-admin>
```

**Query params:**

| Param | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `page` | int | `1` | Página |
| `limit` | int | `20` | Items por página (máx 100) |
| `search` | string | — | Búsqueda por `name`, `email` |

**Response:**
```json
{
  "data": [
    {
      "id": "uuid-juan",
      "name": "Juan Pérez",
      "email": "juan@example.com",
      "hasFcmToken": true
    }
  ],
  "meta": {
    "total": 45,
    "page": 1,
    "limit": 20,
    "totalPages": 3
  }
}
```

---

## 5. Placeholders — Lógica Robusta

### 5.1 Extracción de placeholders del template

Al crear/actualizar un template, el servicio extrae automáticamente todos los placeholders `{{...}}` de `title`, `body` y `deepLink` para validación y documentación:

```typescript
// Servicio: extractPlaceholders(template)
title:  "¡{{productName}} en oferta!"  → ["productName"]
body:   "...{{discount}}%..."          → ["userName", "productName", "discount"]
deepLink: "menucom://producto/{{productSlug}}" → ["productSlug"]

// Unión única: ["discount", "productName", "productSlug", "userName"]
```

### 5.2 Resolución segura

```typescript
// Servicio: resolvePlaceholders(text, params)
function resolvePlaceholders(text: string, params: Record<string, string>): {
  resolved: string;
  unresolved: string[];
} {
  const unresolved: string[] = [];
  const resolved = text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    if (params[key] !== undefined) {
      return escapeFcmValue(params[key]); // sanitizar valor
    }
    unresolved.push(key);
    return match; // mantener placeholder original
  });
  return { resolved, unresolved };
}
```

### 5.3 Validación en send-from-template

Antes de enviar, el servicio:

1. Carga el template de la BD (lanza `NotFoundException` si no existe o `isActive=false`)
2. Extrae placeholders requeridos del template
3. Compara con `params` recibidos
4. Resuelve todos los campos
5. **Si hay placeholders sin resolver, incluye `warning` y `unresolvedPlaceholders` en la respuesta pero igual envía** (no bloquea)
6. Valida que `resolvedTitle` ≤ 200 chars y `resolvedBody` ≤ 4000 chars
7. Valida que `data` serializado ≤ 4KB

### 5.4 Sanitización de valores resueltos

Los valores de `params` se sanitizan antes de insertarse:
- Se escapan caracteres especiales que podrían romper el JSON del payload FCM
- Se truncan a 1000 chars si exceden (con log warning)

---

## 6. Deeplinks

El campo `deepLink` del template soporta placeholders igual que `title` y `body`.

### 6.1 Inyección en el payload FCM

El valor resuelto se inyecta en `data` del mensaje FCM como key `deep_link`:

```typescript
// En sendFromTemplate()
const resolvedData = {
  ...template.data,                              // data fijo del template
  click_action: 'FLUTTER_NOTIFICATION_CLICK',     // requerido por FCM para Android
  ...(resolvedDeepLink ? { deep_link: resolvedDeepLink } : {}),
};
```

### 6.2 Recepción en el cliente

```dart
// Flutter
if (data['deep_link'] != null) {
  handleDeepLink(data['deep_link']); // menucom://producto/hamburguesa-clasica
}
```

Si no hay `deepLink` configurado en el template, el mensaje FCM no incluye la key `deep_link`.

---

## 7. Manejo de Errores — Matriz Completa

### 7.1 Errores de validación (400 Bad Request)

| Escenario | Código | Respuesta |
|-----------|--------|-----------|
| `userIds` vacío | `400` | `{ message: "Debe incluir al menos un userId", error: "VALIDATION" }` |
| `userIds` > 5000 | `400` | `{ message: "Máximo 5000 usuarios por envío", error: "VALIDATION" }` |
| UUID inválido en `userIds` | `400` | `{ message: "userId must be a UUID v4", error: "VALIDATION" }` |
| `params` vacío en send-from-template | `400` | `{ message: "params no puede estar vacío", error: "VALIDATION" }` |
| `name` duplicado al crear template | `409` | `{ message: "Ya existe un template 'X'", error: "CONFLICT" }` |
| `name` no cumple formato | `400` | `{ message: "name solo permite minúsculas, números y guiones bajos", error: "VALIDATION" }` |
| `imageUrl` sin HTTPS | `400` | `{ message: "imageUrl must be an HTTPS URL", error: "VALIDATION" }` |
| `title`/`body` excede límite post-resolución | `400` | `{ message: "title exceeds 200 chars after resolving placeholders", error: "VALIDATION" }` |
| `data` excede 4KB | `400` | `{ message: "data payload exceeds 4KB limit", error: "VALIDATION" }` |

### 7.2 Errores de recurso (404 Not Found)

| Escenario | Respuesta |
|-----------|-----------|
| Template no encontrado | `{ message: "Template 'a1b2c3d4-...' no encontrado", error: "NOT_FOUND" }` |
| Template inactivo (send-from-template) | `{ message: "Template 'X' está inactivo", error: "INACTIVE" }` |

### 7.3 Errores de infraestructura

| Escenario | Respuesta |
|-----------|-----------|
| Firebase no inicializado | `{ message: "Servicio de notificaciones no disponible", error: "SERVICE_UNAVAILABLE" }` (503) |
| Ningún usuario tiene FCM token | Respuesta 200 con `successCount: 0, failureCount: 0` + warning |
| Token FCM inválido (individual) | Se limpia automáticamente, no interrumpe el batch |
| Error de BD al guardar template | `{ message: "Error interno al crear template", error: "INTERNAL_ERROR" }` (500) |

---

## 8. Consideraciones de Performance y Escala

### 8.1 Procesamiento por batches (FCM Multicast)

El servicio existente (`NotificationsService.sendNotificationToMultipleUsers`) ya procesa en batches de 500 tokens (límite de FCM). El nuevo método `sendFromTemplate` reutiliza esta infraestructura:

```
5000 userIds → 10 batches de 500 → FCM multicast paralelo (secuencial por batch)
```

### 8.2 Límites y throttling

| Recurso | Límite | Acción |
|---------|--------|--------|
| FCM tokens por multicast | 500 | Ya implementado en `NotificationsService` |
| FCM data payload | 4KB | Validado antes del envío |
| FCM notification title | 200 chars | Validado post-resolución |
| FCM notification body | 4000 chars | Validado post-resolución |
| `userIds` por request | 5000 | Validación en DTO |
| FCM rate limit | ~600/min por proyecto | ThrottleGuard pendiente (fase 2) |

### 8.3 Índices de BD recomendados

```sql
-- Búsqueda rápida de usuarios con FCM token
CREATE INDEX idx_user_fcm_token ON "user"(fcmToken) WHERE fcmToken IS NOT NULL;

-- Búsqueda textual de templates
CREATE INDEX idx_template_name ON notification_templates(name);
CREATE INDEX idx_template_active ON notification_templates(isActive) WHERE isActive = true;
```

---

## 9. Patrones de Servicio — Pseudocódigo

### 9.1 `sendFromTemplate(templateId, dto)`

```typescript
async sendFromTemplate(templateId: string, dto: SendFromTemplateDto) {
  // 1. Cargar template
  const template = await this.templateRepo.findOne({ where: { id: templateId } });
  if (!template) throw new NotFoundException(`Template '${templateId}' no encontrado`);
  if (!template.isActive) throw new BadRequestException(`Template '${template.name}' está inactivo`);

  // 2. Extraer placeholders requeridos del template
  const requiredPlaceholders = this.extractPlaceholders(
    template.title, template.body, template.deepLink ?? '',
  );

  // 3. Validar que hay params
  if (!dto.params || Object.keys(dto.params).length === 0) {
    throw new BadRequestException('params no puede estar vacío');
  }

  // 4. Resolver placeholders
  const titleResult = this.resolvePlaceholders(template.title, dto.params);
  const bodyResult = this.resolvePlaceholders(template.body, dto.params);
  const deepLinkResult = template.deepLink
    ? this.resolvePlaceholders(template.deepLink, dto.params)
    : { resolved: null, unresolved: [] };

  const allUnresolved = [
    ...titleResult.unresolved,
    ...bodyResult.unresolved,
    ...deepLinkResult.unresolved,
  ];

  // 5. Validar límites post-resolución
  if (titleResult.resolved.length > 200) {
    throw new BadRequestException('title exceeds 200 chars after resolving placeholders');
  }
  if (bodyResult.resolved.length > 4000) {
    throw new BadRequestException('body exceeds 4000 chars after resolving placeholders');
  }

  // 6. Construir data payload
  const resolvedData = {
    ...(template.data ?? {}),
    click_action: 'FLUTTER_NOTIFICATION_CLICK',
    ...(deepLinkResult.resolved ? { deep_link: deepLinkResult.resolved } : {}),
  };

  const serialized = JSON.stringify(resolvedData);
  if (Buffer.byteLength(serialized, 'utf8') > 4096) {
    throw new BadRequestException('data payload exceeds 4KB limit');
  }

  // 7. Enviar usando servicio existente (batches, retry, token cleanup)
  const results = await this.notificationsService.sendNotificationToMultipleUsers(
    dto.userIds,
    titleResult.resolved,
    bodyResult.resolved,
    resolvedData,
    template.imageUrl ?? undefined,
  );

  // 8. Responder con diagnóstico
  return {
    success: true,
    templateUsed: template.name,
    resolvedTitle: titleResult.resolved,
    resolvedBody: bodyResult.resolved,
    resolvedDeepLink: deepLinkResult.resolved,
    resolvedData,
    ...(allUnresolved.length > 0
      ? {
          unresolvedPlaceholders: [...new Set(allUnresolved)],
          warning: `${allUnresolved.length} placeholder(s) sin resolver: ${allUnresolved.join(', ')}`,
        }
      : {}),
    results,
  };
}
```

### 9.2 `getUsersWithTokens(query)`

```typescript
async getUsersWithTokens(page: number, limit: number, search?: string) {
  const qb = this.userRepo
    .createQueryBuilder('user')
    .where('user.fcmToken IS NOT NULL')
    .select(['user.id', 'user.name', 'user.email']);

  if (search) {
    qb.andWhere('(user.name ILIKE :search OR user.email ILIKE :search)', {
      search: `%${search}%`,
    });
  }

  const [data, total] = await qb
    .skip((page - 1) * limit)
    .take(limit)
    .orderBy('user.name', 'ASC')
    .getManyAndCount();

  return {
    data: data.map((u) => ({ id: u.id, name: u.name, email: u.email, hasFcmToken: true })),
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  };
}
```

### 9.3 CRUD Templates

```typescript
async createTemplate(dto: CreateNotificationTemplateDto) {
  // Verificar unicidad del name
  const existing = await this.templateRepo.findOne({ where: { name: dto.name } });
  if (existing) throw new ConflictException(`Ya existe un template con el nombre '${dto.name}'`);

  const template = this.templateRepo.create(dto);
  return this.templateRepo.save(template);
}

async listTemplates(query: { page, limit, search?, isActive?, sortBy?, sortOrder? }) {
  const qb = this.templateRepo.createQueryBuilder('t');

  if (query.isActive !== undefined) {
    qb.andWhere('t.isActive = :isActive', { isActive: query.isActive });
  }
  if (query.search) {
    qb.andWhere('(t.name ILIKE :s OR t.title ILIKE :s)', { s: `%${query.search}%` });
  }

  const sortBy = ['name', 'createdAt', 'updatedAt'].includes(query.sortBy ?? '')
    ? query.sortBy
    : 'updatedAt';
  const sortOrder = query.sortOrder === 'ASC' ? 'ASC' : 'DESC';

  qb.orderBy(`t.${sortBy}`, sortOrder);
  qb.skip((query.page - 1) * query.limit).take(query.limit);

  const [data, total] = await qb.getManyAndCount();

  return {
    data: data.map((t) => ({
      ...t,
      placeholderCount: this.extractPlaceholders(t.title, t.body, t.deepLink ?? '').length,
    })),
    meta: { total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / limit) },
  };
}

async deleteTemplate(id: string) {
  // Soft-delete: NO borrar físicamente, set isActive = false
  const result = await this.templateRepo.update(id, { isActive: false });
  if (result.affected === 0) {
    throw new NotFoundException(`Template '${id}' no encontrado`);
  }
  return { success: true, message: 'Template desactivado' };
}
```

---

## 10. Seguridad

### 10.1 Sanitización del data payload

El método `sanitizeData()` existente en `NotificationsService` elimina keys sensibles. El nuevo código debe:

1. Llamar `sanitizeData()` sobre `resolvedData` antes de enviar
2. No permitir que `template.data` sobrescriba `deep_link` ni `click_action`
3. Validar que `data` no contenga keys con nombres sensibles al crear/actualizar template

### 10.2 Validación de imageUrl

- Solo HTTPS (forzado por `@IsUrl({ protocols: ['https'] })`)
- Máximo 2048 caracteres
- El servicio NO descarga/verifica la imagen (Cloudinary ya lo garantiza)

### 10.3 Prevención de inyección en placeholders

Los valores de `params` son siempre strings y se escapan antes de insertarlos. No se permite HTML ni markdown en las notificaciones push (FCM no los renderiza).

---

## 11. Dependencias Existentes (sin cambios)

| Componente | Ubicación |
|-----------|-----------|
| `FirebaseAdminService` | `src/auth/firebase-admin.service.ts` |
| `NotificationsService` (sendToUser, sendToMultiple, sanitizeData) | `src/notifications/notifications.service.ts` |
| `NotificationsModule` | `src/notifications/notifications.module.ts` |
| `User.fcmToken` | `src/user/entities/user.entity.ts:64` |
| `@CanManageUsers()` | `src/auth/decorators/role-helpers.decorator.ts:182` |
| `MAX_FCM_TOKENS = 500` (batch size) | `src/notifications/notifications.service.ts` |

---

## 12. Archivos a Implementar

### Crear
- `src/notifications/entities/notification-template.entity.ts`
- `src/notifications/dto/create-notification-template.dto.ts`
- `src/notifications/dto/update-notification-template.dto.ts`
- `src/notifications/dto/send-admin-notification.dto.ts`
- `src/notifications/dto/send-from-template.dto.ts`
- `src/notifications/dto/query-templates.dto.ts` (paginación/filtros)
- `src/notifications/dto/query-users-with-tokens.dto.ts` (paginación/búsqueda)

### Modificar
- `src/notifications/notifications.module.ts` — registrar `NotificationTemplate` en TypeOrm
- `src/notifications/notifications.service.ts` — agregar métodos admin
- `src/notifications/notifications.controller.ts` — agregar endpoints admin

---

## 13. Convenciones de Código

```typescript
// ❌ INCORRECTO: Asumir que todos los userIds tienen FCM token
const users = await this.userRepo.findByIds(dto.userIds);
await fcm.sendMulticast({ tokens: users.map(u => u.fcmToken!) }); // fcmToken puede ser null

// ✅ CORRECTO: Filtrar y manejar null
const tokens = users.filter(u => u.fcmToken).map(u => u.fcmToken);
if (tokens.length === 0) {
  return { successCount: 0, failureCount: 0 };
}
await fcm.sendMulticast({ tokens });

// ❌ INCORRECTO: Usar delete en vez de soft-delete
await this.templateRepo.delete(id);

// ✅ CORRECTO: Soft-delete con isActive
await this.templateRepo.update(id, { isActive: false });

// ❌ INCORRECTO: Ignorar placeholders sin resolver
const body = body.replace(/\{\{(\w+)\}\}/g, (_, k) => params[k] ?? ''); // valores vacíos

// ✅ CORRECTO: Reportar placeholders sin resolver, mantener texto original
const { resolved, unresolved } = this.resolvePlaceholders(body, params);
```

---

## 14. Plan de Testing Unitario

> Framework: **Jest + @nestjs/testing** | Patrón: **Arrange-Act-Assert** | Mocking: **jest.fn() + useValue**

### 14.1 Archivos de test a crear

| Archivo | Qué prueba |
|---------|------------|
| `src/notifications/notifications.service.spec.ts` | Lógica de placeholders, CRUD templates, envío |
| `src/notifications/notifications.controller.spec.ts` | Endpoints admin, respuestas, errores |
| `src/notifications/dto/create-notification-template.dto.spec.ts` | Validación de DTOs con class-validator |

### 14.2 Setup de testing module

```typescript
// src/notifications/notifications.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationsService } from './notifications.service';
import { FirebaseAdminService } from '../auth/firebase-admin.service';
import { NotificationTemplate } from './entities/notification-template.entity';
import { User } from '../user/entities/user.entity';
import {
  NotFoundException, BadRequestException, ConflictException,
} from '@nestjs/common';

describe('NotificationsService — Admin Templates', () => {
  let service: NotificationsService;
  let templateRepo: jest.Mocked<Repository<NotificationTemplate>>;
  let userRepo: jest.Mocked<Repository<User>>;
  let firebaseAdmin: jest.Mocked<FirebaseAdminService>;

  const mockTemplateRepo = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockUserRepo = {
    findOne: jest.fn(),
    find: jest.fn(),
    update: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockFirebaseAdmin = {
    isInitialized: jest.fn(),
    messaging: {
      send: jest.fn(),
      sendEachForMulticast: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: getRepositoryToken(NotificationTemplate), useValue: mockTemplateRepo },
        { provide: FirebaseAdminService, useValue: mockFirebaseAdmin },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    templateRepo = module.get(getRepositoryToken(NotificationTemplate));
    userRepo = module.get(getRepositoryToken(User));
    firebaseAdmin = module.get(FirebaseAdminService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });
  // ... test suites aquí
});
```

### 14.3 Tests del Servicio — Suite Completa

#### 14.3.1 `extractPlaceholders()`

```
describe('extractPlaceholders', () => {
```

| # | Test | Input | Esperado |
|---|------|-------|----------|
| 1 | Extrae placeholders de los 3 campos | `title: "Hola {{name}}", body: "{{amount}} pagado", deepLink: "/{{slug}}"` | `["name", "amount", "slug"]` |
| 2 | Retorna array vacío sin placeholders | `title: "Sin variables", body: "Nada", deepLink: ""` | `[]` |
| 3 | Deduplica placeholders repetidos | `title: "{{x}}", body: "{{x}} {{y}} {{x}}"` | `["x", "y"]` (sin duplicados) |
| 4 | Ignora llaves no balanceadas | `"sin {{placeholders {{rotos"` | `["rotos"]` (solo `{{rotos` capturado) |
| 5 | Placeholder con guion bajo y números | `"{{user_id}} {{order_2}}"` | `["user_id", "order_2"]` |
| 6 | deepLink es null | `deepLink: null` | Solo placeholders de title/body |
| 7 | deepLink es string vacía | `deepLink: ""` | Solo placeholders de title/body |

```
})
```

#### 14.3.2 `resolvePlaceholders()`

```
describe('resolvePlaceholders', () => {
```

| # | Test | Template | params | resolved | unresolved |
|---|------|----------|--------|----------|------------|
| 1 | Resuelve todos los placeholders | `"{{a}} y {{b}}"` | `{a:"1", b:"2"}` | `"1 y 2"` | `[]` |
| 2 | Deja placeholder si falta param | `"Hola {{name}}"` | `{}` | `"Hola {{name}}"` | `["name"]` |
| 3 | Resuelve parcialmente | `"{{a}} {{b}} {{c}}"` | `{a:"1", c:"3"}` | `"1 {{b}} 3"` | `["b"]` |
| 4 | Texto sin placeholders queda igual | `"Sin cambios"` | `{x:"1"}` | `"Sin cambios"` | `[]` |
| 5 | Sanitiza valores con caracteres especiales | `"{{msg}}"` | `{msg:'Hola "mundo"'}` | `'Hola \\"mundo\\"'` | `[]` |
| 6 | Placeholder repetido se reemplaza en todas partes | `"{{x}} y {{x}}"` | `{x:"OK"}` | `"OK y OK"` | `[]` |
| 7 | Trunca valor > 1000 chars | `"{{long}}"` | `{long: 'a'.repeat(5000)}` | 1000 chars + log warning | `[]` |
| 8 | Valor undefined se trata como faltante | `"{{x}}"` | `{x: undefined}` | `"{{x}}"` | `["x"]` |
| 9 | Valor null se trata como faltante | `"{{x}}"` | `{x: null}` | `"{{x}}"` | `["x"]` |

```
})
```

#### 14.3.3 `createTemplate()`

```
describe('createTemplate', () => {
```

| # | Test | Descripción |
|---|------|-------------|
| 1 | Crea template exitosamente | name no existe → `templateRepo.save()` llamado con los datos del DTO |
| 2 | Lanza ConflictException si name ya existe | `templateRepo.findOne` resuelve un template existente → `ConflictException` |
| 3 | Crea template con solo campos requeridos | Sin `data`, `deepLink`, `imageUrl` → la entidad guardada tiene esos campos como null |
| 4 | Crea template con `isActive: true` por defecto | Verifica que el template guardado tenga `isActive: true` |
| 5 | Propaga errores de BD | `templateRepo.save()` rechaza con error → el error se propaga |

```
})
```

#### 14.3.4 `listTemplates()`

```
describe('listTemplates', () => {
```

| # | Test | Descripción |
|---|------|-------------|
| 1 | Retorna templates paginados | `page:1, limit:10` → llama query builder con skip 0, take 10 |
| 2 | Filtra por `isActive: true` | Query incluye `WHERE isActive = true` |
| 3 | Filtra por `search` | Query incluye ILIKE sobre name y title |
| 4 | Ordena por `sortBy` y `sortOrder` | `sortBy:"name", sortOrder:"ASC"` → ORDER BY name ASC |
| 5 | Usa defaults cuando sortBy inválido | `sortBy:"campo_inventado"` → fallback a `updatedAt` |
| 6 | Retorna lista vacía si no hay templates | `getManyAndCount` → `[[], 0]` |
| 7 | Calcula placeholderCount en cada template | Verifica que cada item en `data` tenga la key `placeholderCount` |
| 8 | Calcula `totalPages` correctamente | `total: 25, limit: 10` → `totalPages: 3` |

```
})
```

#### 14.3.5 `getTemplate()`

```
describe('getTemplate', () => {
```

| # | Test | Descripción |
|---|------|-------------|
| 1 | Retorna template por ID | `findOne` resuelve template → retorna el objeto |
| 2 | Lanza NotFoundException si no existe | `findOne` resuelve null → `NotFoundException` |

```
})
```

#### 14.3.6 `updateTemplate()`

```
describe('updateTemplate', () => {
```

| # | Test | Descripción |
|---|------|-------------|
| 1 | Actualiza campos parcialmente | DTO con solo `title` → solo se actualiza title, el resto intacto |
| 2 | Lanza ConflictException si cambia name a uno existente | Nuevo name ya usado por otro template → 409 |
| 3 | Permite mismo name si es el propio template | Actualizar template sin cambiar name → OK |
| 4 | Lanza NotFoundException si template no existe | `findOne` resuelve null → 404 |
| 5 | Actualiza `isActive` correctamente | Pasar `isActive: false` → template guardado con `isActive: false` |

```
})
```

#### 14.3.7 `deleteTemplate()`

```
describe('deleteTemplate', () => {
```

| # | Test | Descripción |
|---|------|-------------|
| 1 | Soft-delete: setea isActive=false | No llama `templateRepo.delete()`, llama `templateRepo.update(id, {isActive:false})` |
| 2 | Lanza NotFoundException si template no existe | `update().affected === 0` → 404 |
| 3 | Retorna success al desactivar | `{ success: true, message: 'Template desactivado' }` |

```
})
```

#### 14.3.8 `sendFromTemplate()`

```
describe('sendFromTemplate', () => {
```

| # | Test | Descripción |
|---|------|-------------|
| 1 | Resuelve y envía correctamente | Template existe + params completos → llama `sendNotificationToMultipleUsers` con datos resueltos |
| 2 | Lanza NotFoundException si template no existe | `findOne` → null |
| 3 | Lanza BadRequestException si template inactivo | `isActive: false` |
| 4 | Lanza BadRequestException si params vacío | `params: {}` |
| 5 | Incluye warning en respuesta si placeholders sin resolver | `params` incompleto → `warning` y `unresolvedPlaceholders` en response |
| 6 | Inyecta deep_link en resolvedData | deepLink con placeholder resuelto → `resolvedData.deep_link` presente |
| 7 | No incluye deep_link si template no tiene deepLink | `template.deepLink: null` → `resolvedData` sin key `deep_link` |
| 8 | Mergea template.data con click_action y deep_link | `template.data: {type:"promo"}` → `resolvedData = {type:"promo", click_action:"...", deep_link:"..."}` |
| 9 | Lanza BadRequestException si title resuelto > 200 chars | Placeholder expande title más allá del límite |
| 10 | Lanza BadRequestException si body resuelto > 4000 chars | Placeholder expande body más allá del límite |
| 11 | Lanza BadRequestException si data serializado > 4KB | `template.data` muy grande |
| 12 | Retorna successCount/failureCount del multicast | FCM retorna 3 success, 1 failure → se refleja en results |
| 13 | Firebase no inicializado → 503 ServiceUnavailableException | `isInitialized()` → false |
| 14 | Respeta el orden: template.data no sobrescribe deep_link | `template.data: {deep_link:"otro"}` → `resolvedData.deep_link` es el del template, no el del data |

```
})
```

#### 14.3.9 `getUsersWithTokens()`

```
describe('getUsersWithTokens', () => {
```

| # | Test | Descripción |
|---|------|-------------|
| 1 | Retorna usuarios paginados con FCM token | Query builder con `WHERE fcmToken IS NOT NULL` |
| 2 | Filtra por search en name y email | `search: "juan"` → ILIKE en ambas columnas |
| 3 | Retorna lista vacía si no hay usuarios con token | `getManyAndCount` → `[[], 0]` |
| 4 | Respeta paginación en primera página | `page:1, limit:5` → `skip:0, take:5` |
| 5 | Respeta paginación en página N | `page:3, limit:5` → `skip:10, take:5` |
| 6 | Mapea respuesta con `hasFcmToken: true` | Cada usuario en `data` incluye `hasFcmToken: true` |

```
})
```

#### 14.3.10 `sendDirectNotification()` (POST /send)

```
describe('sendDirectNotification', () => {
```

| # | Test | Descripción |
|---|------|-------------|
| 1 | Envía notificación directa a múltiples usuarios | Delega en `sendNotificationToMultipleUsers` con los datos del DTO |
| 2 | Pasa imageUrl al servicio de envío | `dto.imageUrl` → se incluye en la llamada |
| 3 | No pasa imageUrl si es undefined | DTO sin imageUrl → no se incluye |
| 4 | Retorna results del multicast | `{successCount, failureCount}` del servicio subyacente |

```
})
```

### 14.4 Tests del Controlador — Suite

```typescript
// src/notifications/notifications.controller.spec.ts
describe('NotificationsController — Admin Endpoints', () => {
  let controller: NotificationsController;

  const mockNotificationsService = {
    createTemplate: jest.fn(),
    listTemplates: jest.fn(),
    getTemplate: jest.fn(),
    updateTemplate: jest.fn(),
    deleteTemplate: jest.fn(),
    sendFromTemplate: jest.fn(),
    sendDirectNotification: jest.fn(),
    getUsersWithTokens: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [{ provide: NotificationsService, useValue: mockNotificationsService }],
    }).compile();
    controller = module.get<NotificationsController>(NotificationsController);
  });

  afterEach(() => { jest.clearAllMocks(); });
```

#### 14.4.1 CRUD Templates

| Método | # | Test | Esperado |
|--------|---|------|----------|
| `POST /admin/templates` | 1 | Crea template y retorna 201 | `createTemplate` llamado con DTO |
| | 2 | Retorna 409 si name duplicado | Servicio lanza `ConflictException` |
| `GET /admin/templates` | 3 | Lista templates con query params | `listTemplates` llamado con page/limit/search |
| | 4 | Usa defaults si no hay query params | `page:1, limit:20` por defecto |
| `GET /admin/templates/:id` | 5 | Retorna template por ID | `getTemplate` llamado con el ID del path |
| | 6 | Retorna 404 si no existe | Servicio lanza `NotFoundException` |
| `PATCH /admin/templates/:id` | 7 | Actualiza template | `updateTemplate` llamado con ID + DTO |
| | 8 | Retorna 404 si no existe | Servicio lanza `NotFoundException` |
| `DELETE /admin/templates/:id` | 9 | Desactiva template | `deleteTemplate` llamado, response `{success:true}` |

#### 14.4.2 Envío de notificaciones

| Método | # | Test | Esperado |
|--------|---|------|----------|
| `POST /admin/send` | 10 | Envía notificación directa | `sendDirectNotification` llamado con DTO |
| | 11 | Retorna 400 con DTO inválido | `userIds: []` → validation pipe rechaza |
| `POST /admin/send-from-template/:id` | 12 | Envía desde template | `sendFromTemplate` llamado con ID + DTO |
| | 13 | Retorna 404 si template no existe | Servicio lanza `NotFoundException` |
| | 14 | Retorna response con warning si placeholders faltan | Verifica que response incluya `warning` |
| `GET /admin/users-with-tokens` | 15 | Lista usuarios paginados | `getUsersWithTokens` llamado con query params |
| | 16 | Retorna lista vacía | `data: [], meta: {total:0}` |

#### 14.4.3 Guard y permisos

| # | Test | Esperado |
|---|------|----------|
| 17 | Endpoints admin usan `@CanManageUsers()` | Verificar que el decorador esté aplicado (test de reflexión o integración) |
| 18 | Sin token → 401 Unauthorized | JWT guard rechaza request sin Authorization header |

### 14.5 Tests de DTOs

```typescript
// src/notifications/dto/create-notification-template.dto.spec.ts
import { validate } from 'class-validator';

describe('CreateNotificationTemplateDto', () => {
  // ... instanciar DTOs con plainToInstance y validar
```

| DTO | # | Test | Esperado |
|-----|---|------|----------|
| Create | 1 | DTO válido con todos los campos | 0 errores de validación |
| | 2 | `name` con mayúsculas | Error: `matches` |
| | 3 | `name` con espacios | Error: `matches` |
| | 4 | `name` menor a 3 chars | Error: `minLength` |
| | 5 | `name` mayor a 100 chars | Error: `maxLength` |
| | 6 | `title` vacío | Error: `isNotEmpty` |
| | 7 | `title` mayor a 200 chars | Error: `maxLength` |
| | 8 | `imageUrl` con HTTP (no HTTPS) | Error: `isUrl` |
| | 9 | `imageUrl` con formato inválido | Error: `isUrl` |
| Update | 10 | DTO vacío (todos opcionales) | 0 errores |
| | 11 | Solo `isActive: false` | 0 errores, actualización parcial válida |
| SendAdmin | 12 | `userIds: []` | Error: `arrayMinSize` |
| | 13 | `userIds` con string no UUID | Error: `isUuid` |
| | 14 | `userIds` con más de 5000 elementos | Error: `arrayMaxSize` |
| | 15 | `title` > 200 chars | Error: `maxLength` |
| SendFromTemplate | 16 | `params: {}` | Error: envía pero el servicio lo rechaza con 400 |
| | 17 | `userIds: []` | Error: `arrayMinSize` |

### 14.6 Tests de Integración (E2E) — Opcionales fase 1

| # | Endpoint | Test |
|---|----------|------|
| 1 | `POST /notifications/admin/templates` | Crear, ver persistencia en BD de prueba |
| 2 | `GET /notifications/admin/templates` | Crear 3, listar, verificar paginación |
| 3 | `PATCH /notifications/admin/templates/:id` | Actualizar name, verificar unicidad |
| 4 | `DELETE /notifications/admin/templates/:id` | Soft-delete, verificar isActive=false |
| 5 | `POST /notifications/admin/send-from-template/:id` | Enviar a usuario con FCM token mockeado |
| 6 | Flujo completo | Crear template → enviar → verificar respuesta |

### 14.7 Ejecución

```bash
# Unitarios
npm run test -- --testPathPattern="notifications"

# Solo servicio
npm run test -- --testPathPattern="notifications.service"

# Solo controlador
npm run test -- --testPathPattern="notifications.controller"

# Solo DTOs
npm run test -- --testPathPattern="create-notification-template.dto"

# Con coverage
npm run test -- --testPathPattern="notifications" --coverage
```

### 14.8 Cobertura esperada

| Componente | Cobertura objetivo | Prioridad |
|-----------|-------------------|-----------|
| `extractPlaceholders()` | 100% branches | Crítica — lógica core de parseo |
| `resolvePlaceholders()` | 100% branches | Crítica — sanitización y resolución |
| `sendFromTemplate()` | ≥90% branches | Alta — flujo principal de negocio |
| CRUD templates | ≥85% branches | Alta — opera datos de BD |
| `getUsersWithTokens()` | ≥80% branches | Media — query builder |
| Controller endpoints | ≥90% lines | Alta — entry points HTTP |
| DTOs validation | 100% rules cubiertas | Crítica — evita datos inválidos en BD |

### 14.9 Mock de Firebase para tests

Para que los tests de `sendFromTemplate` y `sendDirectNotification` no dependan de Firebase real:

```typescript
const mockFirebaseAdmin = {
  isInitialized: jest.fn().mockReturnValue(true),
  messaging: {
    send: jest.fn().mockResolvedValue('message-id-123'),
    sendEachForMulticast: jest.fn().mockResolvedValue({
      successCount: 2,
      failureCount: 0,
      responses: [],
    }),
  },
};
```

Para simular fallos de FCM:

```typescript
// Simular token inválido en batch
mockFirebaseAdmin.messaging.sendEachForMulticast.mockResolvedValueOnce({
  successCount: 1,
  failureCount: 1,
  responses: [
    { success: true, messageId: 'msg-1' },
    {
      success: false,
      error: { code: 'messaging/invalid-registration-token' },
    },
  ],
});
```

---

## 15. Próximos Pasos

1. Crear entidad `NotificationTemplate` con TypeORM
2. Crear DTOs con validación completa (`class-validator`)
3. Implementar `resolvePlaceholders()` y `extractPlaceholders()` en el servicio
4. Implementar CRUD de templates con soft-delete
5. Implementar `sendFromTemplate()` usando `sendNotificationToMultipleUsers` existente
6. Implementar `getUsersWithTokens()` con paginación y búsqueda ILIKE
7. Agregar endpoints en el controlador con `@CanManageUsers()`
8. Escribir tests unitarios según sección 14
9. Ejecutar `npm run test -- --testPathPattern="notifications" --coverage` y verificar ≥85%
10. Ejecutar migración de BD para crear tabla `notification_templates` + índices
11. Testear flujo completo con `npm run test:e2e`
