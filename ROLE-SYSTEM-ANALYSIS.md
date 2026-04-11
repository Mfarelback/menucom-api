# Análisis del Sistema de Roles y Propuesta de Mejora

## 📊 Análisis del Sistema Actual

### 🔍 Hallazgos Clave

#### 1. **Sistema de Roles Actual**

**Ubicación:** `src/auth/models/roles.model.ts`

```typescript
export enum Role {
  CUSTOMER = 'customer',
  ADMIN = 'admin',
  PRO = 'pro',
  OPERADOR = 'operador',
}
```

**Problemas identificados:**

❌ **Roles limitados y rígidos**: Solo 4 roles que no permiten flexibilidad
❌ **Sin jerarquía clara**: No hay relación entre roles ni herencia de permisos
❌ **Nombres inconsistentes**: Mezcla inglés/español (CUSTOMER vs OPERADOR)
❌ **Almacenamiento débil**: En User.entity el `role` es un simple `string`, no hay validación
❌ **Sin contexto de dominio**: Los roles no reflejan el contexto de negocio (restaurantes, wardrobes, etc.)

#### 2. **Duplicación de Lógica: Menu vs Wardrobes**

**Comparación lado a lado:**

| Aspecto | Menu | Wardrobes | Similitud |
|---------|------|-----------|-----------|
| **Entidad principal** | `Menu` | `Wardrobes` | 100% - Misma estructura |
| **Items** | `MenuItem` | `ClothingItem` | 95% - Solo difieren campos específicos |
| **Operaciones CRUD** | create/edit/delete | create/edit/delete | 100% - Lógica idéntica |
| **Relación con usuario** | `idOwner` | `idOwner` | 100% - Mismo patrón |
| **Capacidad** | `capacity: 15` | `capacity: 15` | 100% - Hardcoded igual |
| **Controladores** | 8 endpoints | 8 endpoints | 100% - Mismos endpoints |
| **Servicios** | CRUD + find | CRUD + find | 95% - Misma lógica |

**Código duplicado detectado:**

```typescript
// AMBOS módulos tienen exactamente esta estructura:
- id: string (PK)
- idOwner: string
- description: string
- capacity: number
- items: OneToMany relationship

// AMBOS servicios tienen los mismos métodos:
- create{Entity}()
- edit{Entity}ByUser()
- delete{Entity}ByUser()
- add{Entity}ItemBy{Entity}ID()
- editItemsFrom{Entity}()
- deleteItemFrom{Entity}()
- findAll{Entity}sByUser()
- find{Entity}ItemsBy{Entity}Id()
```

**Estimación:** ~85% del código es duplicado entre ambos módulos.

#### 3. **Control de Acceso Actual**

**Uso de Guards:**
- ✅ `JwtAuthGuard` - Usado en todos los endpoints autenticados
- ❌ `RoleGuard` - **NO se usa en Menu ni Wardrobes**
- ⚠️ Solo validación de autenticación, **sin control por roles**

**Problema:** Cualquier usuario autenticado puede acceder a todos los endpoints de Menu y Wardrobes, sin importar su rol.

---

## 🎯 Propuesta de Mejora

### 1. **Sistema de Roles Mejorado**

#### Opción A: Roles Basados en Permisos (RBAC - Role-Based Access Control)

```typescript
// src/auth/models/roles.model.ts
export enum Role {
  // Roles de clientes
  CUSTOMER = 'customer',           // Cliente final
  
  // Roles de negocio
  RESTAURANT_OWNER = 'restaurant_owner',  // Dueño de restaurante
  WARDROBE_OWNER = 'wardrobe_owner',      // Dueño de guardarropa
  BUSINESS_OWNER = 'business_owner',      // Dueño de negocio genérico
  
  // Roles administrativos
  OPERATOR = 'operator',           // Operador del sistema
  ADMIN = 'admin',                 // Administrador total

}

// src/auth/models/permissions.model.ts
export enum Permission {
  // Permisos de catálogo/productos
  CREATE_CATALOG = 'create_catalog',
  READ_CATALOG = 'read_catalog',
  UPDATE_CATALOG = 'update_catalog',
  DELETE_CATALOG = 'delete_catalog',
  
  // Permisos de items/productos
  CREATE_ITEM = 'create_item',
  READ_ITEM = 'read_item',
  UPDATE_ITEM = 'update_item',
  DELETE_ITEM = 'delete_item',
  
  // Permisos de órdenes
  CREATE_ORDER = 'create_order',
  READ_ORDER = 'read_order',
  UPDATE_ORDER = 'update_order',
  CANCEL_ORDER = 'cancel_order',
  
  // Permisos administrativos
  MANAGE_USERS = 'manage_users',
  MANAGE_PAYMENTS = 'manage_payments',
  VIEW_ANALYTICS = 'view_analytics',
}

// Mapeo de roles a permisos
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [Role.CUSTOMER]: [
    Permission.READ_CATALOG,
    Permission.READ_ITEM,
    Permission.CREATE_ORDER,
    Permission.READ_ORDER,
    Permission.CANCEL_ORDER,
  ],
  
  [Role.RESTAURANT_OWNER]: [
    Permission.CREATE_CATALOG,
    Permission.READ_CATALOG,
    Permission.UPDATE_CATALOG,
    Permission.DELETE_CATALOG,
    Permission.CREATE_ITEM,
    Permission.READ_ITEM,
    Permission.UPDATE_ITEM,
    Permission.DELETE_ITEM,
    Permission.READ_ORDER,
    Permission.UPDATE_ORDER,
    Permission.VIEW_ANALYTICS,
  ],
  
  [Role.WARDROBE_OWNER]: [
    Permission.CREATE_CATALOG,
    Permission.READ_CATALOG,
    Permission.UPDATE_CATALOG,
    Permission.DELETE_CATALOG,
    Permission.CREATE_ITEM,
    Permission.READ_ITEM,
    Permission.UPDATE_ITEM,
    Permission.DELETE_ITEM,
  ],
  
  [Role.PRO]: [
    // Todos los permisos de negocio
    ...ROLE_PERMISSIONS[Role.RESTAURANT_OWNER],
    ...ROLE_PERMISSIONS[Role.WARDROBE_OWNER],
  ],
  
  [Role.OPERATOR]: [
    Permission.MANAGE_USERS,
    Permission.VIEW_ANALYTICS,
  ],
  
  [Role.ADMIN]: Object.values(Permission), // Todos los permisos
};
```

#### Opción B: Sistema de Roles + Contexto (Más Flexible)

```typescript
// src/auth/models/user-role.entity.ts
import { Entity, Column, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../../user/entities/user.entity';

export enum RoleType {
  CUSTOMER = 'customer',
  OWNER = 'owner',
  ADMIN = 'admin',
  OPERATOR = 'operator',
}

export enum BusinessContext {
  RESTAURANT = 'restaurant',
  WARDROBE = 'wardrobe',
  MARKETPLACE = 'marketplace',
  GENERAL = 'general',
}

@Entity()
export class UserRole {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, user => user.roles)
  user: User;

  @Column({ type: 'enum', enum: RoleType })
  role: RoleType;

  @Column({ type: 'enum', enum: BusinessContext })
  context: BusinessContext;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  grantedAt: Date;
}

// Ejemplo de uso:
// Usuario puede ser CUSTOMER en GENERAL
// Usuario puede ser OWNER en RESTAURANT
// Usuario puede ser OWNER en WARDROBE
// Usuario puede ser ADMIN en GENERAL
```

---

### 2. **Módulo de Catálogos Genérico**

#### Arquitectura Propuesta

```
src/catalog/
├── catalog.module.ts
├── README.md
├── entities/
│   ├── catalog.entity.ts          # Entidad genérica (antes Menu/Wardrobes)
│   ├── catalog-item.entity.ts     # Item genérico
│   └── catalog-type.enum.ts       # Tipos de catálogo
├── dto/
│   ├── create-catalog.dto.ts
│   ├── update-catalog.dto.ts
│   ├── create-catalog-item.dto.ts
│   └── catalog-filter.dto.ts
├── services/
│   ├── catalog.service.ts         # Servicio genérico
│   └── catalog-factory.service.ts # Factory para tipos específicos
├── controllers/
│   ├── catalog.controller.ts      # CRUD genérico
│   ├── menu.controller.ts         # Alias/adapter para menus
│   └── wardrobe.controller.ts     # Alias/adapter para wardrobes
├── guards/
│   └── catalog-owner.guard.ts     # Verificar ownership
└── decorators/
    └── catalog-type.decorator.ts
```

#### Implementación Base

```typescript
// src/catalog/entities/catalog-type.enum.ts
export enum CatalogType {
  MENU = 'menu',               // Menús de restaurantes
  WARDROBE = 'wardrobe',       // Guardarropas
  PRODUCT_LIST = 'product_list', // Lista de productos genérica
  SERVICE_LIST = 'service_list', // Lista de servicios
}

// src/catalog/entities/catalog.entity.ts
import { Entity, Column, OneToMany, PrimaryColumn, ManyToOne, Index } from 'typeorm';
import { CatalogItem } from './catalog-item.entity';
import { User } from '../../user/entities/user.entity';

@Entity()
@Index(['ownerId', 'catalogType'])
export class Catalog {
  @PrimaryColumn({ type: 'varchar' })
  id: string;

  @Column({ type: 'varchar' })
  ownerId: string;

  @ManyToOne(() => User)
  owner: User;

  @Column({ type: 'enum', enum: CatalogType })
  catalogType: CatalogType;

  @Column({ type: 'varchar', nullable: true })
  name: string;

  @Column({ type: 'varchar', nullable: true })
  description: string;

  @Column({ type: 'int', default: 50 })
  capacity: number;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>; // Datos específicos por tipo

  @OneToMany(() => CatalogItem, item => item.catalog, { cascade: true })
  items: CatalogItem[];

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt: Date;
}

// src/catalog/entities/catalog-item.entity.ts
import { Entity, Column, ManyToOne, PrimaryColumn } from 'typeorm';
import { Catalog } from './catalog.entity';

@Entity()
export class CatalogItem {
  @PrimaryColumn({ type: 'varchar' })
  id: string;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'varchar', nullable: true })
  description: string;

  @Column({ type: 'varchar', nullable: true })
  photoURL: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @Column({ type: 'int', default: 0 })
  quantity: number;

  @Column({ type: 'boolean', default: true })
  isAvailable: boolean;

  @Column({ type: 'jsonb', nullable: true })
  attributes: Record<string, any>; // Campos específicos (ingredients, sizes, etc.)

  @ManyToOne(() => Catalog, catalog => catalog.items, { onDelete: 'CASCADE' })
  catalog: Catalog;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt: Date;
}
```

#### Servicio Genérico

```typescript
// src/catalog/services/catalog.service.ts
import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Catalog } from '../entities/catalog.entity';
import { CatalogItem } from '../entities/catalog-item.entity';
import { CatalogType } from '../entities/catalog-type.enum';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class CatalogService {
  constructor(
    @InjectRepository(Catalog)
    private readonly catalogRepository: Repository<Catalog>,
    @InjectRepository(CatalogItem)
    private readonly catalogItemRepository: Repository<CatalogItem>,
  ) {}

  /**
   * Crea un nuevo catálogo
   */
  async createCatalog(
    ownerId: string,
    catalogType: CatalogType,
    data: {
      name?: string;
      description?: string;
      capacity?: number;
      metadata?: Record<string, any>;
    }
  ): Promise<Catalog> {
    const catalog = this.catalogRepository.create({
      id: uuidv4(),
      ownerId,
      catalogType,
      name: data.name,
      description: data.description,
      capacity: data.capacity || 50,
      metadata: data.metadata || {},
    });

    return await this.catalogRepository.save(catalog);
  }

  /**
   * Obtiene todos los catálogos de un usuario por tipo
   */
  async getCatalogsByOwner(
    ownerId: string,
    catalogType?: CatalogType
  ): Promise<Catalog[]> {
    const where: any = { ownerId, isActive: true };
    if (catalogType) {
      where.catalogType = catalogType;
    }

    return await this.catalogRepository.find({
      where,
      relations: ['items'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Obtiene un catálogo específico con validación de ownership
   */
  async getCatalogById(
    catalogId: string,
    ownerId?: string,
    includeItems: boolean = true
  ): Promise<Catalog> {
    const relations = includeItems ? ['items'] : [];
    const catalog = await this.catalogRepository.findOne({
      where: { id: catalogId },
      relations,
    });

    if (!catalog) {
      throw new NotFoundException(`Catálogo ${catalogId} no encontrado`);
    }

    // Validar ownership si se proporciona
    if (ownerId && catalog.ownerId !== ownerId) {
      throw new ForbiddenException('No tienes permisos para acceder a este catálogo');
    }

    return catalog;
  }

  /**
   * Actualiza un catálogo
   */
  async updateCatalog(
    catalogId: string,
    ownerId: string,
    data: Partial<Catalog>
  ): Promise<Catalog> {
    const catalog = await this.getCatalogById(catalogId, ownerId, false);
    
    Object.assign(catalog, {
      ...data,
      updatedAt: new Date(),
    });

    return await this.catalogRepository.save(catalog);
  }

  /**
   * Elimina un catálogo y todos sus items
   */
  async deleteCatalog(catalogId: string, ownerId: string): Promise<void> {
    const catalog = await this.getCatalogById(catalogId, ownerId, false);
    await this.catalogRepository.remove(catalog);
  }

  /**
   * Añade un item a un catálogo
   */
  async addItem(
    catalogId: string,
    ownerId: string,
    itemData: {
      name: string;
      description?: string;
      photoURL?: string;
      price: number;
      quantity?: number;
      attributes?: Record<string, any>;
    }
  ): Promise<CatalogItem> {
    const catalog = await this.getCatalogById(catalogId, ownerId, false);

    const item = this.catalogItemRepository.create({
      id: uuidv4(),
      ...itemData,
      catalog,
      quantity: itemData.quantity || 0,
      attributes: itemData.attributes || {},
    });

    return await this.catalogItemRepository.save(item);
  }

  /**
   * Actualiza un item
   */
  async updateItem(
    itemId: string,
    catalogOwnerId: string,
    data: Partial<CatalogItem>
  ): Promise<CatalogItem> {
    const item = await this.catalogItemRepository.findOne({
      where: { id: itemId },
      relations: ['catalog'],
    });

    if (!item) {
      throw new NotFoundException(`Item ${itemId} no encontrado`);
    }

    // Validar ownership
    if (item.catalog.ownerId !== catalogOwnerId) {
      throw new ForbiddenException('No tienes permisos para modificar este item');
    }

    Object.assign(item, {
      ...data,
      updatedAt: new Date(),
    });

    return await this.catalogItemRepository.save(item);
  }

  /**
   * Elimina un item
   */
  async deleteItem(itemId: string, catalogOwnerId: string): Promise<void> {
    const item = await this.catalogItemRepository.findOne({
      where: { id: itemId },
      relations: ['catalog'],
    });

    if (!item) {
      throw new NotFoundException(`Item ${itemId} no encontrado`);
    }

    if (item.catalog.ownerId !== catalogOwnerId) {
      throw new ForbiddenException('No tienes permisos para eliminar este item');
    }

    await this.catalogItemRepository.remove(item);
  }

  /**
   * Obtiene catálogo público (sin validación de ownership)
   */
  async getPublicCatalog(catalogId: string): Promise<any> {
    const catalog = await this.catalogRepository.findOne({
      where: { id: catalogId, isActive: true },
      relations: ['items', 'owner'],
    });

    if (!catalog) {
      throw new NotFoundException(`Catálogo ${catalogId} no encontrado`);
    }

    // Filtrar solo items disponibles
    catalog.items = catalog.items.filter(item => item.isAvailable);

    return {
      id: catalog.id,
      type: catalog.catalogType,
      name: catalog.name,
      description: catalog.description,
      owner: {
        id: catalog.owner.id,
        name: catalog.owner.name,
        photoURL: catalog.owner.photoURL,
      },
      items: catalog.items,
    };
  }
}
```

---

### 3. **Guards y Decorators Mejorados**

```typescript
// src/auth/guards/permission.guard.ts
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Permission, ROLE_PERMISSIONS } from '../models/permissions.model';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.role) {
      throw new ForbiddenException('Usuario no autenticado o sin rol');
    }

    const userPermissions = ROLE_PERMISSIONS[user.role] || [];
    const hasPermission = requiredPermissions.some(permission =>
      userPermissions.includes(permission)
    );

    if (!hasPermission) {
      throw new ForbiddenException(
        `No tienes los permisos necesarios. Se requiere: ${requiredPermissions.join(', ')}`
      );
    }

    return true;
  }
}

// src/auth/decorators/permissions.decorator.ts
import { SetMetadata } from '@nestjs/common';
import { Permission } from '../models/permissions.model';

export const PERMISSIONS_KEY = 'permissions';
export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

// src/catalog/guards/catalog-owner.guard.ts
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { CatalogService } from '../services/catalog.service';

@Injectable()
export class CatalogOwnerGuard implements CanActivate {
  constructor(private catalogService: CatalogService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const catalogId = request.params.id || request.body.catalogId;

    if (!catalogId) {
      return true; // No hay catalogId para validar
    }

    const catalog = await this.catalogService.getCatalogById(catalogId, undefined, false);

    if (catalog.ownerId !== user.userId && user.role !== 'admin') {
      throw new ForbiddenException('No eres el propietario de este catálogo');
    }

    // Adjuntar catalog al request para evitar re-fetch
    request.catalog = catalog;
    return true;
  }
}
```

---

### 4. **Controlador Genérico con Backward Compatibility**

```typescript
// src/catalog/controllers/catalog.controller.ts
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt.auth.gards';
import { PermissionsGuard } from '../../auth/guards/permission.guard';
import { CatalogOwnerGuard } from '../guards/catalog-owner.guard';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { Permission } from '../../auth/models/permissions.model';
import { CatalogService } from '../services/catalog.service';
import { CatalogType } from '../entities/catalog-type.enum';
import { CreateCatalogDto, CreateCatalogItemDto } from '../dto';

@ApiTags('Catalog')
@Controller('catalog')
@ApiBearerAuth()
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Post()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.CREATE_CATALOG)
  async createCatalog(@Req() req: Request, @Body() dto: CreateCatalogDto) {
    const userId = req['user']['userId'];
    return this.catalogService.createCatalog(userId, dto.catalogType, dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMyCatalogs(
    @Req() req: Request,
    @Query('type') type?: CatalogType
  ) {
    const userId = req['user']['userId'];
    return this.catalogService.getCatalogsByOwner(userId, type);
  }

  @Get(':id')
  async getPublicCatalog(@Param('id') id: string) {
    return this.catalogService.getPublicCatalog(id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard, CatalogOwnerGuard)
  @RequirePermissions(Permission.UPDATE_CATALOG)
  async updateCatalog(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() data: any
  ) {
    const userId = req['user']['userId'];
    return this.catalogService.updateCatalog(id, userId, data);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard, CatalogOwnerGuard)
  @RequirePermissions(Permission.DELETE_CATALOG)
  async deleteCatalog(@Req() req: Request, @Param('id') id: string) {
    const userId = req['user']['userId'];
    await this.catalogService.deleteCatalog(id, userId);
    return { message: 'Catálogo eliminado exitosamente' };
  }

  // Items endpoints
  @Post(':catalogId/items')
  @UseGuards(JwtAuthGuard, PermissionsGuard, CatalogOwnerGuard)
  @RequirePermissions(Permission.CREATE_ITEM)
  async addItem(
    @Req() req: Request,
    @Param('catalogId') catalogId: string,
    @Body() dto: CreateCatalogItemDto
  ) {
    const userId = req['user']['userId'];
    return this.catalogService.addItem(catalogId, userId, dto);
  }

  @Put('items/:itemId')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.UPDATE_ITEM)
  async updateItem(
    @Req() req: Request,
    @Param('itemId') itemId: string,
    @Body() data: any
  ) {
    const userId = req['user']['userId'];
    return this.catalogService.updateItem(itemId, userId, data);
  }

  @Delete('items/:itemId')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.DELETE_ITEM)
  async deleteItem(@Req() req: Request, @Param('itemId') itemId: string) {
    const userId = req['user']['userId'];
    await this.catalogService.deleteItem(itemId, userId);
    return { message: 'Item eliminado exitosamente' };
  }
}

// src/catalog/controllers/menu.controller.ts (Adapter para backward compatibility)
import { Controller, All, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Menu (Legacy)')
@Controller('menu')
export class MenuLegacyController {
  // Este controlador redirige las llamadas antiguas al nuevo sistema
  // Implementar adapters según sea necesario para no romper APIs existentes
  
  @All('*')
  async legacyHandler(@Req() req: Request, @Res() res: Response) {
    // Transformar request antiguo -> nuevo formato -> catalogService
    // Ejemplo: GET /menu/me -> GET /catalog/me?type=menu
  }
}
```

---

## 📋 Plan de Migración

### Fase 1: Mejorar Sistema de Roles (Sin Breaking Changes)

1. ✅ **Extender enum de roles** con nuevos valores
2. ✅ **Crear modelo de permisos** (`permissions.model.ts`)
3. ✅ **Implementar PermissionsGuard** como alternativa a RoleGuard
4. ✅ **Actualizar User.entity** para soportar múltiples roles (opcional)
5. ✅ **Documentar nuevos roles y permisos**

### Fase 2: Crear Módulo de Catálogos Genérico

1. ✅ **Crear estructura base** del módulo catalog
2. ✅ **Implementar entidades** (Catalog, CatalogItem)
3. ✅ **Implementar servicio genérico** (CatalogService)
4. ✅ **Crear controlador genérico** con guards mejorados
5. ✅ **Añadir tests unitarios** y e2e

### Fase 3: Migración Gradual

1. ✅ **Crear adapters/alias** para menu y wardrobes
2. ✅ **Migrar datos existentes** a nuevo esquema
3. ✅ **Deprecar endpoints antiguos** (mantener por 3-6 meses)
4. ✅ **Actualizar frontend** para usar nuevos endpoints
5. ✅ **Remover código legacy** tras período de deprecación

### Fase 4: Optimizaciones

1. ✅ **Implementar caché** para catálogos públicos
2. ✅ **Añadir búsqueda full-text** en items
3. ✅ **Implementar versionado** de catálogos
4. ✅ **Añadir analytics** de uso

---

## 🎁 Beneficios de la Propuesta

### 1. **Reducción de Código**

- ❌ **Antes**: ~2000 líneas duplicadas entre menu y wardrobes
- ✅ **Después**: ~800 líneas compartidas + ~200 líneas específicas por tipo
- 📉 **Reducción**: ~60% menos código

### 2. **Flexibilidad**

- ✅ Añadir nuevos tipos de catálogos sin duplicar código
- ✅ Sistema de permisos granular
- ✅ Fácil extensión de campos mediante `metadata` y `attributes`

### 3. **Seguridad Mejorada**

- ✅ Control de acceso por permisos (no solo autenticación)
- ✅ Validación de ownership en guards
- ✅ Roles claros y consistentes

### 4. **Mantenibilidad**

- ✅ Single Source of Truth para lógica de catálogos
- ✅ Bugs se arreglan una sola vez
- ✅ Features nuevas se añaden una sola vez

### 5. **Escalabilidad**

- ✅ Fácil añadir nuevos tipos de negocio (servicios, eventos, etc.)
- ✅ Sistema de roles listo para multi-tenancy
- ✅ Preparado para roles contextuales (roles por organización)

---

## ⚠️ Consideraciones

### Riesgos

1. **Breaking Changes**: Requiere migración de datos y actualización de frontend
2. **Complejidad Inicial**: Sistema más complejo que el actual
3. **Testing**: Requiere re-testing de toda la funcionalidad

### Mitigaciones

1. **Backward Compatibility**: Mantener endpoints legacy con adapters
2. **Migración Gradual**: Por fases, no Big Bang
3. **Feature Flags**: Activar nuevo sistema gradualmente
4. **Documentación**: Guías completas de migración

---

## 🚀 Recomendación

**Opción Recomendada**: Implementar **Opción A (RBAC)** + **Módulo de Catálogos Genérico**

**Justificación**:
- ✅ Balance entre flexibilidad y simplicidad
- ✅ Fácil de entender y mantener
- ✅ Preparado para crecimiento futuro
- ✅ No requiere cambios drásticos en la DB

**Siguiente Paso**: ¿Deseas que implemente alguna de las fases? Puedo empezar por:

1. **Mejorar sistema de roles** (Fase 1)
2. **Crear módulo de catálogos** (Fase 2)
3. **Ambas** en paralelo
