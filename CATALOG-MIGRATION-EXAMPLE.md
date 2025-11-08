# 🔄 Ejemplo de Migración: CatalogController

## Antes (Actual)

```typescript
import { Controller, Post, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt.auth.gards';

@Controller('catalogs')
export class CatalogController {
  
  @Post()
  @UseGuards(JwtAuthGuard) // ❌ Solo verifica autenticación, no permisos
  async createCatalog(@Request() req, @Body() dto: CreateCatalogDto) {
    // Cualquier usuario autenticado puede crear catálogos
    return this.catalogService.create(req.user.userId, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard) // ❌ No hay control de roles
  async deleteCatalog(@Param('id') id: string) {
    // Cualquier usuario autenticado puede eliminar
    return this.catalogService.delete(id);
  }
}
```

**Problemas:**
- ❌ Cualquier usuario autenticado puede crear/editar/eliminar catálogos
- ❌ No se valida que el usuario sea propietario del negocio
- ❌ No hay diferenciación entre restaurantes y wardrobes
- ❌ Gerentes no pueden gestionar catálogos

---

## Después (Nuevo Sistema)

### Opción 1: Decoradores Helper (Recomendado) ⭐

```typescript
import { Controller, Post, Delete, Get, Patch, Request, Body, Param } from '@nestjs/common';
import { 
  RestaurantOwner, 
  RestaurantManager, 
  RestaurantRead, 
  Authenticated 
} from '../../auth/decorators/role-helpers.decorator';

@Controller('catalogs')
export class CatalogController {
  
  @Post()
  @RestaurantOwner() // ✅ Solo propietarios de restaurante
  async createCatalog(@Request() req, @Body() dto: CreateCatalogDto) {
    // Solo usuarios con rol OWNER en contexto RESTAURANT pueden crear
    return this.catalogService.create(req.user.userId, dto);
  }

  @Patch(':id')
  @RestaurantManager() // ✅ Propietarios Y gerentes
  async updateCatalog(
    @Param('id') id: string, 
    @Body() dto: UpdateCatalogDto
  ) {
    // OWNER y MANAGER pueden editar
    return this.catalogService.update(id, dto);
  }

  @Get()
  @RestaurantRead() // ✅ Cualquier usuario autenticado puede ver
  async getAllCatalogs() {
    // Todos pueden ver catálogos públicos
    return this.catalogService.findAll();
  }

  @Delete(':id')
  @RestaurantOwner() // ✅ Solo propietarios pueden eliminar
  async deleteCatalog(@Param('id') id: string) {
    // Solo OWNER puede eliminar
    return this.catalogService.delete(id);
  }
}
```

### Opción 2: Permisos Granulares

```typescript
import { Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt.auth.gards';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { InBusinessContext, RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { Permission, BusinessContext } from '../../auth/models/permissions.model';

@Controller('catalogs')
@UseGuards(JwtAuthGuard, PermissionsGuard) // ✅ Guards globales para el controlador
export class CatalogController {
  
  @Post()
  @InBusinessContext(BusinessContext.RESTAURANT)
  @RequirePermissions(Permission.CREATE_CATALOG)
  async createCatalog(@Request() req, @Body() dto: CreateCatalogDto) {
    return this.catalogService.create(req.user.userId, dto);
  }

  @Delete(':id')
  @InBusinessContext(BusinessContext.RESTAURANT)
  @RequirePermissions(Permission.DELETE_CATALOG)
  async deleteCatalog(@Param('id') id: string) {
    return this.catalogService.delete(id);
  }
}
```

---

## Migración para Catálogos Multi-Tipo (Menu vs Wardrobe)

Si tu catálogo maneja tanto MENU como WARDROBE:

```typescript
import { Controller, Post, Body, Request } from '@nestjs/common';
import { RestaurantOwner, WardrobeOwner } from '../../auth/decorators/role-helpers.decorator';
import { CatalogType } from '../enums/catalog-type.enum';

@Controller('catalogs')
export class CatalogController {
  
  // Endpoint específico para restaurantes
  @Post('restaurant')
  @RestaurantOwner()
  async createRestaurantCatalog(@Request() req, @Body() dto: CreateCatalogDto) {
    return this.catalogService.create(req.user.userId, {
      ...dto,
      catalogType: CatalogType.MENU
    });
  }

  // Endpoint específico para wardrobes
  @Post('wardrobe')
  @WardrobeOwner()
  async createWardrobeCatalog(@Request() req, @Body() dto: CreateCatalogDto) {
    return this.catalogService.create(req.user.userId, {
      ...dto,
      catalogType: CatalogType.WARDROBE
    });
  }

  // O usar lógica dinámica
  @Post()
  @Authenticated() // Solo verificar que está logueado
  async createCatalog(@Request() req, @Body() dto: CreateCatalogDto) {
    const userId = req.user.userId;
    
    // Verificar permiso según el tipo de catálogo
    const context = dto.catalogType === CatalogType.MENU 
      ? BusinessContext.RESTAURANT 
      : BusinessContext.WARDROBE;
    
    const hasPermission = await this.userRoleService.userHasPermission(
      userId,
      context,
      Permission.CREATE_CATALOG
    );

    if (!hasPermission) {
      throw new ForbiddenException(
        `No tienes permisos para crear catálogos de tipo ${dto.catalogType}`
      );
    }

    return this.catalogService.create(userId, dto);
  }
}
```

---

## Items del Catálogo

```typescript
@Controller('catalogs/:catalogId/items')
export class CatalogItemsController {
  
  @Post()
  @RestaurantManager() // Gerentes pueden crear items
  async createItem(
    @Param('catalogId') catalogId: string,
    @Body() dto: CreateCatalogItemDto
  ) {
    return this.catalogService.addItem(catalogId, dto);
  }

  @Patch(':itemId')
  @RestaurantManager() // Gerentes pueden editar
  async updateItem(
    @Param('catalogId') catalogId: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateCatalogItemDto
  ) {
    return this.catalogService.updateItem(catalogId, itemId, dto);
  }

  @Delete(':itemId')
  @RestaurantOwner() // Solo propietarios pueden eliminar
  async deleteItem(
    @Param('catalogId') catalogId: string,
    @Param('itemId') itemId: string
  ) {
    return this.catalogService.deleteItem(catalogId, itemId);
  }

  @Get()
  @RestaurantRead() // Todos pueden ver
  async getItems(@Param('catalogId') catalogId: string) {
    return this.catalogService.getItems(catalogId);
  }
}
```

---

## Validación en Servicios (Opcional pero Recomendado)

Además de los guards, puedes validar permisos en los servicios:

```typescript
import { Injectable, ForbiddenException } from '@nestjs/common';
import { UserRoleService } from '../../auth/services/user-role.service';
import { Permission, BusinessContext } from '../../auth/models/permissions.model';

@Injectable()
export class CatalogService {
  constructor(
    private userRoleService: UserRoleService,
    private catalogRepository: Repository<Catalog>
  ) {}

  async deleteCatalog(catalogId: string, userId: string) {
    const catalog = await this.catalogRepository.findOne({ 
      where: { id: catalogId } 
    });

    if (!catalog) {
      throw new NotFoundException('Catálogo no encontrado');
    }

    // Verificar que sea el propietario O tenga permisos de DELETE
    const isOwner = catalog.ownerId === userId;
    const hasPermission = await this.userRoleService.userHasPermission(
      userId,
      BusinessContext.RESTAURANT,
      Permission.DELETE_CATALOG
    );

    if (!isOwner && !hasPermission) {
      throw new ForbiddenException(
        'Solo el propietario o usuarios con permisos pueden eliminar este catálogo'
      );
    }

    return this.catalogRepository.remove(catalog);
  }
}
```

---

## Checklist de Migración

- [ ] Identificar endpoints que requieren protección
- [ ] Determinar el contexto de negocio (RESTAURANT, WARDROBE, etc.)
- [ ] Decidir qué roles pueden acceder a cada endpoint
- [ ] Reemplazar `@UseGuards(JwtAuthGuard)` por decoradores helper
- [ ] Probar con diferentes roles (OWNER, MANAGER, CUSTOMER)
- [ ] Actualizar tests para incluir verificación de permisos
- [ ] Documentar los permisos requeridos en Swagger

---

## Beneficios de la Migración

✅ **Seguridad mejorada**: Control granular de acceso
✅ **Código más limpio**: Decoradores expresivos
✅ **Flexibilidad**: Roles contextuales y temporales
✅ **Auditoría**: Seguimiento de quién tiene qué permisos
✅ **Escalabilidad**: Fácil agregar nuevos roles/permisos
✅ **Multi-tenancy**: Gerentes de recursos específicos

---

## Testing

```typescript
describe('CatalogController', () => {
  it('should allow OWNER to create catalog', async () => {
    // Asignar rol OWNER
    await userRoleService.assignRole(
      userId,
      RoleType.OWNER,
      BusinessContext.RESTAURANT
    );

    const response = await request(app.getHttpServer())
      .post('/catalogs')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Mi Menú', catalogType: 'MENU' })
      .expect(201);

    expect(response.body.data).toHaveProperty('id');
  });

  it('should deny CUSTOMER from creating catalog', async () => {
    await request(app.getHttpServer())
      .post('/catalogs')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ name: 'Mi Menú', catalogType: 'MENU' })
      .expect(403);
  });

  it('should allow MANAGER to update but not delete', async () => {
    // MANAGER puede actualizar
    await request(app.getHttpServer())
      .patch(`/catalogs/${catalogId}`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ name: 'Nuevo nombre' })
      .expect(200);

    // MANAGER NO puede eliminar
    await request(app.getHttpServer())
      .delete(`/catalogs/${catalogId}`)
      .set('Authorization', `Bearer ${managerToken}`)
      .expect(403);
  });
});
```

---

**Siguiente paso**: Aplicar estos patrones a todos los controladores de catalog, orders, wardrobes, etc.
