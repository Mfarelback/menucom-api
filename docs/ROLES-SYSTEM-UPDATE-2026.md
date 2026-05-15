# 🆕 Actualización del Sistema de Roles - Mayo 2026

## Resumen de Cambios Importantes

**Fecha:** 14 de Mayo de 2026  
**Versión:** 2.0 del Sistema de Roles  
**Cambio Principal:** Corrección del flujo de registro para asignar roles correctos según el tipo de negocio

---

## ⚠️ Problema Corregido

### Antes (Incorrecto)

Todos los usuarios se registraban con:
```typescript
{
  role: RoleType.CUSTOMER,
  context: BusinessContext.GENERAL
}
```

**Problema:** Los organizadores de eventos no podían crear eventos porque `CUSTOMER` en `GENERAL` no tiene el permiso `CREATE_EVENT`.

### Después (Correcto)

Los usuarios se registran según su tipo de negocio:
```typescript
// Organizador de eventos
{
  role: RoleType.OWNER,
  context: BusinessContext.EVENTS
}
// + 
{
  role: RoleType.CUSTOMER,
  context: BusinessContext.GENERAL  // Para comprar en otros negocios
}
```

---

## 🎯 Cambios en el Registro

### 1. Nuevo Campo: `businessType`

**Archivo:** `CreateUserDto`

```typescript
// ✅ NUEVO - Forma correcta
POST /auth/register
{
  "email": "organizador@eventos.com",
  "password": "123456",
  "businessType": "events"  // ← Nuevo campo
}

// ⚠️ ANTERIOR - Todavía funciona (backward compatible)
POST /auth/register
{
  "email": "organizador@eventos.com",
  "password": "123456",
  "role": "event_organizer"  // ← Campo legacy
}
```

### 2. Mapeo de Business Types

| businessType | Rol Asignado | Contexto | Doble Rol |
|--------------|--------------|----------|-----------|
| `customer` | CUSTOMER | GENERAL | No |
| `events` | OWNER | EVENTS | Sí (CUSTOMER en GENERAL) |
| `food`, `dinning` | OWNER | RESTAURANT | Sí (CUSTOMER en GENERAL) |
| `clothes` | OWNER | WARDROBE | Sí (CUSTOMER en GENERAL) |
| `retail`, `grocery`, `electronics` | OWNER | MARKETPLACE | Sí (CUSTOMER en GENERAL) |
| `admin` | ADMIN | GENERAL | No |
| `operador` | OPERATOR | GENERAL | No |

### 3. Doble Rol para Comerciantes

Los usuarios comerciantes (OWNER en cualquier contexto) también reciben `CUSTOMER` en `GENERAL`:

```typescript
// Ejemplo: Organizador de eventos
UserRoles: [
  {
    role: "owner",
    context: "events",      // ← Puede crear eventos
    isActive: true
  },
  {
    role: "customer",
    context: "general",     // ← También puede comprar tickets
    isActive: true
  }
]
```

**Ventaja:** Un organizador puede crear sus propios eventos Y comprar tickets de otros eventos con la misma cuenta.

---

## 🎪 Identificación de Organizadores

### Cómo identificar un organizador de eventos:

```typescript
// ✅ CORRECTO - Buscar OWNER en EVENTS
const isOrganizer = await userRoleService.hasRole(
  userId,
  RoleType.OWNER,
  BusinessContext.EVENTS
);

// ✅ Usando helper
const isOrganizer = await userRoleService.isEventOrganizer(userId);

// ❌ INCORRECTO - No buscar CUSTOMER en GENERAL
const isOrganizer = await userRoleService.hasRole(
  userId,
  RoleType.CUSTOMER,  // Wrong!
  BusinessContext.GENERAL
);
```

### Query SQL:

```sql
-- ✅ Correcto
SELECT u.email, u.name
FROM public.user u
INNER JOIN user_roles ur ON u.id = ur.user_id
WHERE ur.role = 'owner' 
  AND ur.context = 'events'
  AND ur.is_active = true;

-- ❌ Incorrecto (no buscar CUSTOMER en GENERAL)
-- WHERE ur.role = 'customer' AND ur.context = 'general'
```

---

## 🔧 Permisos Actualizados

### Permisos para Eventos (en `permissions.model.ts`)

```typescript
[BusinessContext.EVENTS]: {
  [RoleType.OWNER]: [  // ← NUEVO
    Permission.CREATE_EVENT,
    Permission.READ_EVENT,
    Permission.UPDATE_EVENT,
    Permission.DELETE_EVENT,
    Permission.MANAGE_TICKETS,
    Permission.VALIDATE_TICKETS,
    Permission.VIEW_ANALYTICS,
    Permission.MANAGE_PAYMENTS,
  ],
  [RoleType.EVENT_ORGANIZER]: [  // ← Mantenido por backward compat
    // Mismos permisos
  ],
  [RoleType.ADMIN]: [...],
  [RoleType.CUSTOMER]: [
    Permission.READ_EVENT,
    Permission.CREATE_ORDER,  // ← Comprar tickets
    Permission.READ_ORDER,
  ],
}
```

**Nota:** `EVENT_ORGANIZER` está marcado como *deprecated*. Los nuevos usuarios deben usar `OWNER` en `EVENTS`.

---

## 📊 Migración de Usuarios Existentes

### Script de Migración

```bash
# Ejecutar migración de datos
npm run migrate:roles
```

El script detecta automáticamente:
- **Usuarios con eventos** → Asigna `OWNER` en `EVENTS`
- **Usuarios con catálogos de restaurante** → Asigna `OWNER` en `RESTAURANT`
- **Usuarios con catálogos de ropa** → Asigna `OWNER` en `WARDROBE`
- **Usuarios con catálogos de marketplace** → Asigna `OWNER` en `MARKETPLACE`
- **Usuarios admin** → Asigna `ADMIN` en `GENERAL`

### Verificar Migración

```sql
-- Organizadores de eventos migrados
SELECT COUNT(*) as total_organizers
FROM user_roles
WHERE role = 'owner' 
  AND context = 'events'
  AND granted_by = 'migration-script-2026';

-- Usuarios con doble rol (comerciantes)
SELECT u.email, COUNT(ur.id) as role_count
FROM public.user u
INNER JOIN user_roles ur ON u.id = ur.user_id
GROUP BY u.id, u.email
HAVING COUNT(ur.id) > 1;
```

---

## 🧪 Testing

### Test: Organizador puede crear eventos

```bash
# 1. Registrar organizador
POST /auth/register
{
  "email": "test-organizer@example.com",
  "password": "password123",
  "businessType": "events"
}

# Response: access_token

# 2. Crear evento
POST /events
Header: Authorization: Bearer <token>
{
  "name": "Test Event",
  "description": "Test",
  "startDate": "2026-06-01T20:00:00Z",
  "endDate": "2026-06-02T02:00:00Z"
}

# Response: 201 Created ✅
```

### Test: Cliente NO puede crear eventos

```bash
# 1. Registrar cliente
POST /auth/register
{
  "email": "test-customer@example.com",
  "password": "password123",
  "businessType": "customer"
}

# 2. Intentar crear evento
POST /events
Header: Authorization: Bearer <token>
{...}

# Response: 403 Forbidden ✅
```

---

## 🔄 Backward Compatibility

### ✅ 100% Compatible

- El campo `role` legacy sigue funcionando
- Los tokens JWT existentes siguen válidos
- Los guards protegen igual
- Los endpoints funcionan igual
- Los usuarios existentes no se ven afectados (hasta ejecutar migración)

### Mapeo Legacy → Nuevo

```typescript
// Si el frontend envía:
{ role: 'event_organizer' }

// El backend interpreta como:
{ businessType: 'events' }

// Y asigna:
{ role: 'owner', context: 'events' }
```

---

## 📁 Archivos Modificados

| Archivo | Cambio |
|---------|--------|
| `src/user/dto/create-user.dto.ts` | Agregar `businessType` |
| `src/auth/services/auth.service.ts` | Nuevo sistema de mapeo |
| `src/auth/models/permissions.model.ts` | Agregar `OWNER` en `EVENTS` |
| `src/auth/services/user-role.service.ts` | Helpers de identificación |
| `package.json` | Script `migrate:roles` |

### Archivos Nuevos

| Archivo | Propósito |
|---------|-----------|
| `src/scripts/migrate-user-roles.ts` | Migrar usuarios existentes |
| `docs/EVENT-FLOW-COMPLETE.md` | Flujo de eventos actualizado |
| `docs/IMPLEMENTATION-SUMMARY.md` | Resumen de implementación |

---

## 🎓 Ejemplos Prácticos

### Ejemplo 1: Dashboard del Organizador

```typescript
@Controller('organizer-dashboard')
export class OrganizerDashboardController {
  
  @Get()
  @UseGuards(JwtAuthGuard)
  async getDashboard(@Request() req) {
    const userId = req.user.userId;
    
    // Verificar si es organizador (OWNER en EVENTS)
    const isOrganizer = await this.userRoleService.isEventOrganizer(userId);
    
    if (!isOrganizer) {
      throw new ForbiddenException('No eres organizador de eventos');
    }
    
    // Obtener sus eventos
    const events = await this.eventService.findByOrganizer(userId);
    
    return { events };
  }
}
```

### Ejemplo 2: Middleware de Tipo de Usuario

```typescript
@Injectable()
export class UserTypeMiddleware implements NestMiddleware {
  async use(req: Request, res: Response, next: NextFunction) {
    const userId = req.user?.userId;
    
    // Identificar tipo de negocio
    req.user.isEventOrganizer = await this.userRoleService.isEventOrganizer(userId);
    req.user.isRestaurantOwner = await this.userRoleService.isRestaurantOwner(userId);
    req.user.businessType = await this.userRoleService.getUserBusinessType(userId);
    
    next();
  }
}
```

### Ejemplo 3: Query para Frontend

```typescript
// Obtener todos los organizadores de eventos
const organizers = await userRoleService.getEventOrganizers();

// Devolver al frontend
return organizers.map(ur => ({
  id: ur.user.id,
  email: ur.user.email,
  name: ur.user.name,
  type: 'event_organizer'
}));
```

---

## 🚀 Próximos Pasos Recomendados

1. **Ejecutar migración en desarrollo** para probar
2. **Actualizar frontend** para usar `businessType` en lugar de `role`
3. **Ejecutar migración en producción** con backup previo
4. **Documentar** para el equipo de desarrollo
5. **Monitorear** logs por posibles errores

---

## 📞 Soporte

Si tienes problemas:

1. Verificar que el usuario tiene el rol correcto:
   ```sql
   SELECT * FROM user_roles WHERE user_id = '<uuid>';
   ```

2. Revisar logs de la aplicación

3. Verificar que el token JWT tiene los claims correctos

4. Ejecutar migración de nuevo (es idempotente):
   ```bash
   npm run migrate:roles
   ```

---

## ✅ Checklist de Implementación

- [x] Código implementado
- [x] Tests unitarios pasan
- [x] Documentación actualizada
- [ ] Backup de base de datos realizado
- [ ] Migración ejecutada en desarrollo
- [ ] Verificación de usuarios migrados
- [ ] Migración ejecutada en producción
- [ ] Monitoreo activado

---

**Estado:** ✅ IMPLEMENTADO Y LISTO  
**Última actualización:** 14 de Mayo de 2026
