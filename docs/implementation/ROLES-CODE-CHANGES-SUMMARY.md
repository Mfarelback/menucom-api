# ✅ IMPLEMENTACIÓN COMPLETADA - Sistema de Roles y Contextos

## 📅 Fecha: 2026-05-14

---

## 🎯 Resumen de Cambios Implementados

### 1. DTO de Usuario (`src/user/dto/create-user.dto.ts`)
**Cambio:** Agregado campo `businessType`

```typescript
readonly businessType?: string; // 'customer' | 'events' | 'food' | 'dinning' | etc.
```

**Valores aceptados:**
- `customer` - Cliente final (solo compra)
- `events` - Organizador de eventos
- `food`, `dinning` - Dueño de restaurante
- `clothes` - Dueño de tienda de ropa
- `retail`, `grocery`, `electronics` - Vendedor de marketplace
- `admin`, `operador` - Administradores del sistema

---

### 2. Servicio de Autenticación (`src/auth/services/auth.service.ts`)

#### Método `registerUser()` - COMPLETAMENTE REESCRITO
**Lógica nueva:**
- Mapeo completo de `businessType` → `(role, context)`
- Usuarios comerciantes reciben **doble rol**:
  - `OWNER` en su contexto específico (ej: EVENTS)
  - `CUSTOMER` en GENERAL (para poder comprar en otros negocios)

**Ejemplos:**
```typescript
// Organizador de eventos
businessType: 'events' → 
  - OWNER en EVENTS (puede crear eventos)
  - CUSTOMER en GENERAL (puede comprar tickets de otros)

// Cliente normal
businessType: 'customer' → 
  - CUSTOMER en GENERAL (solo compra)

// Admin
businessType: 'admin' → 
  - ADMIN en GENERAL (control total)
```

#### Método `registerUserSocial()` - ACTUALIZADO
**Cambios:**
- Ahora acepta `businessType` en los datos de Firebase
- Usa el mismo mapeo que el registro tradicional
- Asigna roles correctos para usuarios sociales

---

### 3. Modelo de Permisos (`src/auth/models/permissions.model.ts`)

**Cambio:** Agregado `OWNER` en `BusinessContext.EVENTS`

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
  [RoleType.EVENT_ORGANIZER]: [...], // ← Mantenido para backward compat
  [RoleType.ADMIN]: [...],
  [RoleType.CUSTOMER]: [...],
}
```

**Nota:** `EVENT_ORGANIZER` se mantiene para compatibilidad, pero los nuevos usuarios usarán `OWNER`.

---

### 4. Servicio de Roles de Usuario (`src/auth/services/user-role.service.ts`)

**Nuevos métodos agregados:**

```typescript
// Identificación de tipos de usuario
isEventOrganizer(userId: string): Promise<boolean>
isRestaurantOwner(userId: string): Promise<boolean>
isWardrobeOwner(userId: string): Promise<boolean>
isMarketplaceOwner(userId: string): Promise<boolean>

// Utilidades
getUserBusinessType(userId: string): Promise<string | null>
getEventOrganizers(): Promise<UserRole[]>
```

---

### 5. Script de Migración (`src/scripts/migrate-user-roles.ts`)

**Nuevo archivo** - Migra usuarios existentes basándose en su actividad:

#### Fases de migración:

1. **Event Organizers** - Usuarios con eventos creados
   - Asigna: `OWNER` en `EVENTS` + `CUSTOMER` en `GENERAL`

2. **Restaurant Owners** - Usuarios con catálogos tipo 'food'/'dinning'
   - Asigna: `OWNER` en `RESTAURANT` + `CUSTOMER` en `GENERAL`

3. **Wardrobe Owners** - Usuarios con catálogos tipo 'clothes'
   - Asigna: `OWNER` en `WARDROBE`

4. **Marketplace Owners** - Usuarios con catálogos tipo 'retail', etc.
   - Asigna: `OWNER` en `MARKETPLACE`

5. **System Admins** - Usuarios con `role = 'admin'` en tabla user
   - Asigna: `ADMIN` en `GENERAL`

---

### 6. Package.json

**Nuevo script:**
```json
"migrate:roles": "ts-node -r tsconfig-paths/register src/scripts/migrate-user-roles.ts"
```

---

## 🚀 Cómo Usar

### Para Nuevos Registros

#### Registro Tradicional:
```bash
POST /auth/register
{
  "email": "organizador@eventos.com",
  "name": "Juan Pérez",
  "password": "123456",
  "businessType": "events"  // ← Nuevo campo
}
```

#### Registro Social:
```bash
POST /auth/social/login
Headers: Authorization: Bearer <Firebase Token>
Body: {
  "businessType": "events"  // ← Opcional, en el body
}
```

### Para Migrar Usuarios Existentes

```bash
# 1. Backup de base de datos
pg_dump $POSTGRESQL_URL > backup_pre_migration.sql

# 2. Ejecutar migración
npm run migrate:roles
```

**Output esperado:**
```
✅ Connected to database

🎪 Phase 1: Migrating Event Organizers...
  ✅ Migrated event organizer: juan@eventos.com (Juan Pérez)
  Phase 1 complete: 15 migrated, 3 skipped

🍽️  Phase 2: Migrating Restaurant Owners...
  Phase 2 complete: 8 migrated, 0 skipped
...

📊 Final Report:
New roles created by this migration:
  • owner in events: 15 users
  • owner in restaurant: 8 users
  • owner in wardrobe: 5 users
  • owner in marketplace: 12 users
  • admin in general: 2 users
  • customer in general: 35 users

👥 Total users migrated: 77
✅ Migration completed successfully!
```

---

## 🧪 Testing

### Verificar que un organizador puede crear eventos:
```bash
# 1. Registrar organizador
POST /auth/register
{
  "email": "test@organizer.com",
  "password": "123456",
  "businessType": "events"
}

# 2. Crear evento (debe funcionar con el token recibido)
POST /events
Headers: Authorization: Bearer <token>
{
  "name": "Concierto Test",
  "description": "Test event",
  "startDate": "2026-06-01T20:00:00Z",
  "endDate": "2026-06-02T02:00:00Z"
}
```

### Verificar que un cliente NO puede crear eventos:
```bash
# 1. Registrar cliente
POST /auth/register
{
  "email": "test@customer.com",
  "password": "123456",
  "businessType": "customer"
}

# 2. Intentar crear evento (debe fallar con 403)
POST /events
Headers: Authorization: Bearer <token>
{ ... }

# Response: 403 Forbidden
```

---

## 📊 Queries SQL Útiles

### Ver organizadores de eventos:
```sql
SELECT u.email, u.name, ur.role, ur.context
FROM public.user u
INNER JOIN user_roles ur ON u.id = ur.user_id
WHERE ur.role = 'owner' AND ur.context = 'events';
```

### Ver usuarios con doble rol (comerciantes):
```sql
SELECT u.email, 
       COUNT(ur.id) as role_count,
       STRING_AGG(ur.role || ' in ' || ur.context, ', ') as roles
FROM public.user u
INNER JOIN user_roles ur ON u.id = ur.user_id
GROUP BY u.id, u.email
HAVING COUNT(ur.id) > 1;
```

### Verificar migración:
```sql
SELECT 
  role,
  context,
  COUNT(*) as count
FROM user_roles
WHERE granted_by = 'migration-script-2026'
GROUP BY role, context;
```

---

## ⚠️ Backward Compatibility

✅ **100% compatible hacia atrás:**

- Campo `user.role` (legacy) se mantiene intacto
- Roles `EVENT_ORGANIZER` existentes siguen funcionando
- Tokens JWT actuales siguen siendo válidos
- Todas las rutas protegidas funcionan igual
- El frontend puede seguir enviando `role` en lugar de `businessType`

---

## 📝 Cambios en Frontend (Opcional)

Si tienes frontend, puedes actualizar el formulario de registro:

```typescript
// Antes
const registerData = {
  email: 'user@test.com',
  password: '123456',
  role: 'event_organizer',  // ← legacy
};

// Después (recomendado)
const registerData = {
  email: 'user@test.com',
  password: '123456',
  businessType: 'events',  // ← nuevo, más claro
};
```

---

## 🎓 Conceptos Clave

### ¿Por qué doble rol para comerciantes?

Un organizador de eventos puede:
1. **Crear y gestionar sus propios eventos** (como OWNER en EVENTS)
2. **Comprar tickets de otros eventos** (como CUSTOMER en GENERAL)

Esto permite que un comerciante también sea cliente del sistema.

### Jerarquía de Roles

```
ADMIN (en GENERAL)      → Superusuario del sistema
  │
OWNER (en EVENTS)       → Organizador de eventos
OWNER (en RESTAURANT)   → Dueño de restaurante
OWNER (en WARDROBE)     → Dueño de tienda de ropa
OWNER (en MARKETPLACE)  → Vendedor
  │
MANAGER (en contexto)   → Gerente (futuro)
  │
CUSTOMER (en GENERAL)   → Cliente final (solo compra)
```

---

## 🔧 Troubleshooting

### Error: "Role already exists"
El script de migración es idempotente - puede ejecutarse varias veces sin problemas.

### Error: "Cannot find module"
Asegúrate de tener `ts-node` instalado:
```bash
npm install -g ts-node
```

### Usuarios no pueden crear eventos después de migración
Verificar que tengan el rol OWNER en EVENTS:
```sql
SELECT * FROM user_roles 
WHERE user_id = '<user-uuid>' 
AND role = 'owner' 
AND context = 'events';
```

---

## ✅ Checklist de Verificación Post-Implementación

- [ ] Código compilado sin errores (`npm run build`)
- [ ] Tests pasan (`npm run test`)
- [ ] Script de migración creado (`src/scripts/migrate-user-roles.ts`)
- [ ] Backup de base de datos realizado
- [ ] Migración ejecutada en desarrollo
- [ ] Verificar que organizadores pueden crear eventos
- [ ] Verificar que clientes NO pueden crear eventos
- [ ] Verificar usuarios con doble rol
- [ ] Migración ejecutada en producción
- [ ] Monitoreo de errores activado

---

## 📞 Soporte

Si hay problemas:

1. Revisar logs de migración: `npm run migrate:roles`
2. Verificar roles en DB: Queries SQL arriba
3. Revisar logs de aplicación
4. Rollback disponible con backup de DB

---

**Estado:** ✅ IMPLEMENTADO Y LISTO PARA PRUEBAS

**Próximo paso:** Ejecutar `npm run migrate:roles` después de hacer backup de la base de datos.
