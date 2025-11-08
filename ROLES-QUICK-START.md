# 🚀 Quick Start - Sistema de Roles y Permisos

## Para Desarrolladores

### 1. Proteger un Endpoint

**Opción Simple (Recomendada):**
```typescript
import { RestaurantOwner } from '@auth/decorators/role-helpers.decorator';

@Controller('menus')
export class MenuController {
  @Post()
  @RestaurantOwner() // ✨ Una línea, todo configurado
  async createMenu(@Body() menuData: CreateMenuDto) {
    return this.menuService.create(menuData);
  }
}
```

**Decoradores Disponibles:**
- `@RestaurantOwner()` - Gestión completa de restaurante
- `@RestaurantManager()` - Edición de menús
- `@WardrobeOwner()` - Gestión de guardarropa
- `@MarketplaceOwner()` - Gestión de marketplace
- `@Authenticated()` - Solo requiere login

### 2. Verificar Permisos en Servicios

```typescript
import { UserRoleService } from '@auth/services/user-role.service';
import { Permission, BusinessContext } from '@auth/models/permissions.model';

@Injectable()
export class MenuService {
  constructor(private userRoleService: UserRoleService) {}

  async deleteItem(userId: string, itemId: string) {
    const canDelete = await this.userRoleService.userHasPermission(
      userId,
      BusinessContext.RESTAURANT,
      Permission.DELETE_ITEM
    );

    if (!canDelete) {
      throw new ForbiddenException('Sin permisos');
    }

    // Proceder...
  }
}
```

---

## Para Administradores

### Ejecutar Migración de Roles

```bash
# 1. Verificar estado
curl -X GET http://localhost:3000/role-migration/status \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# 2. Simular migración (sin cambios)
curl -X POST http://localhost:3000/role-migration/execute?dryRun=true \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# 3. Ejecutar migración real
curl -X POST http://localhost:3000/role-migration/execute?dryRun=false \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### Asignar Rol a Usuario

```bash
curl -X POST http://localhost:3000/user-roles/assign \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-uuid-123",
    "role": "owner",
    "context": "restaurant",
    "resourceId": "restaurant-uuid-456"
  }'
```

### Ver Roles de Usuario

```bash
curl -X GET http://localhost:3000/user-roles/user/USER_ID \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### Ver Permisos de Usuario

```bash
curl -X GET http://localhost:3000/user-roles/user/USER_ID/permissions/restaurant \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

---

## Roles Disponibles

| Rol | Descripción | Contextos |
|-----|-------------|-----------|
| `CUSTOMER` | Cliente final | Todos |
| `OWNER` | Propietario de negocio | RESTAURANT, WARDROBE, MARKETPLACE |
| `MANAGER` | Gerente (subordinado) | RESTAURANT, WARDROBE |
| `OPERATOR` | Operador del sistema | GENERAL |
| `ADMIN` | Administrador total | GENERAL |

## Contextos de Negocio

- `RESTAURANT` - Gestión de restaurantes y menús
- `WARDROBE` - Gestión de guardarropas
- `MARKETPLACE` - Marketplace/tienda
- `GENERAL` - Sistema general

---

## Migración de Código Legacy

### Antes (Legacy):
```typescript
@UseGuards(JwtAuthGuard, RoleGuard)
@Roles(Role.ADMIN)
async deleteUser() { }
```

### Después (Nuevo):
```typescript
@CanManageUsers()
async deleteUser() { }
```

---

## 📖 Documentación Completa

Ver: [ROLES-PERMISSIONS-GUIDE.md](./ROLES-PERMISSIONS-GUIDE.md)

## 🐛 Troubleshooting

**Usuario sin permisos:**
1. Verificar que tiene rol asignado
2. Verificar que el rol está activo
3. Verificar que no ha expirado

**Migración de roles:**
1. Ejecutar `/role-migration/status` primero
2. Hacer dry-run antes de migración real
3. Revisar logs para errores

## ✅ Checklist de Implementación

- [ ] Ejecutar migración de roles
- [ ] Actualizar controladores con nuevos decoradores
- [ ] Asignar roles contextuales a usuarios existentes
- [ ] Probar endpoints con diferentes roles
- [ ] Documentar roles custom en tu módulo
