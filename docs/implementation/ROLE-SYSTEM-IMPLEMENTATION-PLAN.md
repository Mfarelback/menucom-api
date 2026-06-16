# Plan de Implementación: Sistema de Roles y Contextos

## 📋 Resumen Ejecutivo

**Objetivo:** Corregir el sistema de roles para que los usuarios se registren con el rol y contexto correctos según su tipo de negocio.

**Impacto:** Alto - Modifica el flujo de registro y requiere migración de datos existentes.

**Tiempo estimado:** 2-3 días (implementación + pruebas + migración)

---

## 🎯 Cambios Principales

### 1. Modificar Registro de Usuarios
**Archivo:** `src/auth/services/auth.service.ts`

**Cambio:** Mapear roles legacy a (RoleType, BusinessContext) correctos.

### 2. Actualizar DTO de Registro
**Archivo:** `src/user/dto/create-user.dto.ts`

**Cambio:** Agregar validación para `businessType`.

### 3. Migrar Usuarios Existentes
**Archivo:** Nuevo `src/scripts/migrate-user-roles.ts`

**Cambio:** Script para corregir roles de usuarios existentes.

### 4. Actualizar Permisos
**Archivo:** `src/auth/models/permissions.model.ts`

**Cambio:** Agregar OWNER en EVENTS (reemplaza EVENT_ORGANIZER en el futuro).

---

## 📊 Análisis de Impacto

### Archivos Afectados Directamente

| Archivo | Líneas | Cambio | Riesgo |
|---------|--------|--------|--------|
| `auth.service.ts` | ~150 | Mapeo de roles | Medio |
| `create-user.dto.ts` | ~60 | Nuevo campo | Bajo |
| `permissions.model.ts` | ~220 | Agregar permisos OWNER | Bajo |
| `user-role.service.ts` | ~400 | Nuevo método helper | Bajo |
| `auth.controller.ts` | ~230 | Validación adicional | Bajo |

### Archivos Afectados Indirectamente

| Archivo | Impacto |
|---------|---------|
| Todos los controllers con `@RequirePermissions` | Verificar que los guards funcionen |
| Frontend (si existe) | Debe enviar `businessType` en registro |
| Documentación API | Actualizar ejemplos |

### Base de Datos

| Tabla | Cambio |
|-------|--------|
| `user_roles` | Insertar nuevos roles corregidos |
| `user` | Campo `role` legacy se mantiene (backward compat) |

---

## 🗺️ Plan de Migración de Datos

### Situación Actual (Problema)

```sql
-- Usuarios registrados actualmente
SELECT u.id, u.email, u.role, ur.role as user_role, ur.context
FROM public.user u
LEFT JOIN user_roles ur ON u.id = ur.user_id
WHERE ur.role = 'customer' AND ur.context = 'general';

-- Resultado: TODOS los usuarios tienen CUSTOMER en GENERAL
-- Incluso los que deberían ser organizadores o comerciantes
```

### Estrategia de Migración

#### Paso 1: Identificar Usuarios por Tipo

```sql
-- Usuarios que tienen eventos (deberían ser OWNER en EVENTS)
SELECT DISTINCT u.id, u.email, u.name
FROM public.user u
INNER JOIN events e ON u.id = e."organizerId"
WHERE NOT EXISTS (
  SELECT 1 FROM user_roles ur 
  WHERE ur.user_id = u.id 
  AND ur.role = 'owner' 
  AND ur.context = 'events'
);

-- Usuarios que tienen catálogos de restaurante
SELECT DISTINCT u.id, u.email
FROM public.user u
INNER JOIN catalogs c ON u.id = c."userId"
WHERE c.type = 'food' 
AND NOT EXISTS (
  SELECT 1 FROM user_roles ur 
  WHERE ur.user_id = u.id 
  AND ur.role = 'owner' 
  AND ur.context = 'restaurant'
);

-- Usuarios admin
SELECT id, email, role 
FROM public.user 
WHERE role = 'admin';
```

#### Paso 2: Script de Migración

```typescript
// src/scripts/migrate-user-roles.ts
import { DataSource } from 'typeorm';
import { UserRole } from '../auth/entities/user-role.entity';
import { User } from '../user/entities/user.entity';
import { RoleType, BusinessContext } from '../auth/models/permissions.model';

async function migrateUserRoles() {
  const dataSource = new DataSource({
    type: 'postgres',
    url: process.env.POSTGRESQL_URL,
    entities: [UserRole, User],
  });
  
  await dataSource.initialize();
  
  const userRoleRepo = dataSource.getRepository(UserRole);
  const userRepo = dataSource.getRepository(User);
  
  // 1. Migrar organizadores de eventos
  const eventOrganizers = await dataSource.query(`
    SELECT DISTINCT u.id, u.email, u.name
    FROM public.user u
    INNER JOIN events e ON u.id = e."organizerId"
  `);
  
  for (const user of eventOrganizers) {
    // Verificar si ya tiene el rol correcto
    const existing = await userRoleRepo.findOne({
      where: {
        userId: user.id,
        role: RoleType.OWNER,
        context: BusinessContext.EVENTS,
      },
    });
    
    if (!existing) {
      // Crear rol OWNER en EVENTS
      const userRole = userRoleRepo.create({
        userId: user.id,
        role: RoleType.OWNER,
        context: BusinessContext.EVENTS,
        grantedBy: 'migration-script',
        metadata: { reason: 'user_has_events', migratedAt: new Date() },
      });
      await userRoleRepo.save(userRole);
      console.log(`✅ Migrated event organizer: ${user.email}`);
    }
  }
  
  // 2. Migrar dueños de restaurantes
  const restaurantOwners = await dataSource.query(`
    SELECT DISTINCT u.id, u.email
    FROM public.user u
    INNER JOIN catalogs c ON u.id = c."userId"
    WHERE c.type IN ('food', 'dinning')
  `);
  
  for (const user of restaurantOwners) {
    const existing = await userRoleRepo.findOne({
      where: {
        userId: user.id,
        role: RoleType.OWNER,
        context: BusinessContext.RESTAURANT,
      },
    });
    
    if (!existing) {
      const userRole = userRoleRepo.create({
        userId: user.id,
        role: RoleType.OWNER,
        context: BusinessContext.RESTAURANT,
        grantedBy: 'migration-script',
        metadata: { reason: 'user_has_restaurant_catalog', migratedAt: new Date() },
      });
      await userRoleRepo.save(userRole);
      console.log(`✅ Migrated restaurant owner: ${user.email}`);
    }
  }
  
  // 3. Asegurar que admins tengan ADMIN en GENERAL
  const admins = await userRepo.find({ where: { role: 'admin' } });
  
  for (const user of admins) {
    const existing = await userRoleRepo.findOne({
      where: {
        userId: user.id,
        role: RoleType.ADMIN,
        context: BusinessContext.GENERAL,
      },
    });
    
    if (!existing) {
      const userRole = userRoleRepo.create({
        userId: user.id,
        role: RoleType.ADMIN,
        context: BusinessContext.GENERAL,
        grantedBy: 'migration-script',
        metadata: { reason: 'user_is_admin', migratedAt: new Date() },
      });
      await userRoleRepo.save(userRole);
      console.log(`✅ Migrated admin: ${user.email}`);
    }
  }
  
  // 4. Para usuarios que SOLO tienen CUSTOMER en GENERAL (sin actividad comercial)
  // Verificar si realmente son solo clientes o si tienen actividad no detectada
  const customersOnly = await dataSource.query(`
    SELECT u.id, u.email
    FROM public.user u
    INNER JOIN user_roles ur ON u.id = ur.user_id
    WHERE ur.role = 'customer' AND ur.context = 'general'
    AND NOT EXISTS (
      SELECT 1 FROM user_roles ur2 
      WHERE ur2.user_id = u.id 
      AND (ur2.role = 'owner' OR ur2.role = 'admin')
    )
    AND NOT EXISTS (
      SELECT 1 FROM events e WHERE e."organizerId" = u.id
    )
    AND NOT EXISTS (
      SELECT 1 FROM catalogs c WHERE c."userId" = u.id
    )
  `);
  
  console.log(`ℹ️ Found ${customersOnly.length} users who are actual customers only`);
  
  await dataSource.destroy();
  console.log('Migration completed!');
}

migrateUserRoles().catch(console.error);
```

---

## 🔧 Implementación Paso a Paso

### Paso 1: Actualizar permissions.model.ts

```typescript
// Agregar OWNER en EVENTS
[BusinessContext.EVENTS]: {
  [RoleType.OWNER]: [  // ← NUEVO: OWNER para organizadores
    Permission.CREATE_EVENT,
    Permission.READ_EVENT,
    Permission.UPDATE_EVENT,
    Permission.DELETE_EVENT,
    Permission.MANAGE_TICKETS,
    Permission.VALIDATE_TICKETS,
    Permission.VIEW_ANALYTICS,
    Permission.MANAGE_PAYMENTS,
  ],
  [RoleType.EVENT_ORGANIZER]: [  // ← Mantener por backward compat (deprecated)
    Permission.CREATE_EVENT,
    Permission.READ_EVENT,
    Permission.UPDATE_EVENT,
    Permission.DELETE_EVENT,
    Permission.MANAGE_TICKETS,
    Permission.VALIDATE_TICKETS,
    Permission.VIEW_ANALYTICS,
    Permission.MANAGE_PAYMENTS,
  ],
  [RoleType.ADMIN]: [...],
  [RoleType.CUSTOMER]: [...],
}
```

### Paso 2: Actualizar CreateUserDto

```typescript
export class CreateUserDto {
  // ... campos existentes ...
  
  /**
   * Tipo de negocio del usuario
   * Determina el rol y contexto asignados automáticamente
   */
  @IsString()
  @IsOptional()
  @ApiPropertyOptional({
    description: 'Tipo de negocio/comportamiento del usuario',
    enum: ['customer', 'restaurant', 'events', 'wardrobe', 'marketplace', 'admin'],
    example: 'events',
  })
  readonly businessType?: string;
  
  /**
   * @deprecated Usar businessType. Rol legacy para compatibilidad.
   */
  @IsString()
  @IsOptional()
  readonly role?: string;
}
```

### Paso 3: Modificar auth.service.ts

```typescript
async registerUser(userData: CreateUserDto) {
  const userRegister = await this.usersService.create(userData);
  
  // NUEVO: Mapeo completo de businessType a (role, context)
  const businessTypeMapping: Record<string, { 
    role: RoleType; 
    context: BusinessContext;
    needsCustomerRole: boolean;
  }> = {
    // Cliente final - solo compra
    'customer': { 
      role: RoleType.CUSTOMER, 
      context: BusinessContext.GENERAL,
      needsCustomerRole: false,  // Ya es customer
    },
    
    // Comerciantes - OWNER en su contexto + CUSTOMER para comprar en otros
    'food': { 
      role: RoleType.OWNER, 
      context: BusinessContext.RESTAURANT,
      needsCustomerRole: true,
    },
    'dinning': { 
      role: RoleType.OWNER, 
      context: BusinessContext.RESTAURANT,
      needsCustomerRole: true,
    },
    'clothes': { 
      role: RoleType.OWNER, 
      context: BusinessContext.WARDROBE,
      needsCustomerRole: true,
    },
    'retail': { 
      role: RoleType.OWNER, 
      context: BusinessContext.MARKETPLACE,
      needsCustomerRole: true,
    },
    'grocery': { 
      role: RoleType.OWNER, 
      context: BusinessContext.MARKETPLACE,
      needsCustomerRole: true,
    },
    'electronics': { 
      role: RoleType.OWNER, 
      context: BusinessContext.MARKETPLACE,
      needsCustomerRole: true,
    },
    'events': {  // ← NUEVO
      role: RoleType.OWNER, 
      context: BusinessContext.EVENTS,
      needsCustomerRole: true,
    },
    
    // Administradores del sistema
    'admin': { 
      role: RoleType.ADMIN, 
      context: BusinessContext.GENERAL,
      needsCustomerRole: false,
    },
    'operador': { 
      role: RoleType.OPERATOR, 
      context: BusinessContext.GENERAL,
      needsCustomerRole: false,
    },
  };
  
  // Usar businessType (nuevo) o role (legacy)
  const typeKey = userData.businessType || userData.role || 'customer';
  const mapping = businessTypeMapping[typeKey] || businessTypeMapping['customer'];
  
  // 1. Asignar rol principal (OWNER/ADMIN/CUSTOMER en su contexto)
  await this.userRoleService.assignRole(
    userRegister.id,
    mapping.role,
    mapping.context,
    {
      grantedBy: 'system',
      metadata: { 
        source: 'registration',
        businessType: typeKey,
      },
    },
  );
  
  // 2. Si es comerciante, también darle CUSTOMER para que pueda comprar
  if (mapping.needsCustomerRole) {
    await this.userRoleService.assignRole(
      userRegister.id,
      RoleType.CUSTOMER,
      BusinessContext.GENERAL,
      {
        grantedBy: 'system',
        metadata: { 
          source: 'registration-dual-role',
          reason: 'merchant_can_also_buy',
        },
      },
    );
  }
  
  // Generar JWT
  const payload = {
    username: userRegister.role,
    sub: userRegister.id,
  };
  
  return {
    access_token: this.jwtService.sign(payload),
    needToChangePassword: userRegister.needToChangepassword,
  };
}
```

### Paso 4: Agregar Helper en user-role.service.ts

```typescript
/**
 * Identifica si un usuario es organizador de eventos
 */
async isEventOrganizer(userId: string): Promise<boolean> {
  return await this.hasRole(
    userId,
    RoleType.OWNER,
    BusinessContext.EVENTS,
  );
}

/**
 * Identifica si un usuario es dueño de restaurante
 */
async isRestaurantOwner(userId: string): Promise<boolean> {
  return await this.hasRole(
    userId,
    RoleType.OWNER,
    BusinessContext.RESTAURANT,
  );
}

/**
 * Obtiene el tipo de negocio principal del usuario
 */
async getUserBusinessType(userId: string): Promise<string | null> {
  const roles = await this.getUserRoles(userId);
  
  // Buscar roles OWNER primero (son comerciantes)
  const ownerRole = roles.find(r => r.role === RoleType.OWNER);
  if (ownerRole) {
    return ownerRole.context; // 'events', 'restaurant', etc.
  }
  
  // Si no es OWNER, verificar si es admin
  const adminRole = roles.find(r => r.role === RoleType.ADMIN);
  if (adminRole) {
    return 'admin';
  }
  
  // Si no, es customer
  const customerRole = roles.find(r => r.role === RoleType.CUSTOMER);
  if (customerRole) {
    return 'customer';
  }
  
  return null;
}
```

---

## 🧪 Plan de Pruebas

### Pruebas Unitarias

```typescript
// auth.service.spec.ts
describe('AuthService - Role Assignment', () => {
  it('should assign OWNER in EVENTS for event organizer registration', async () => {
    const userData = {
      email: 'organizer@test.com',
      name: 'Test Organizer',
      password: 'password123',
      businessType: 'events',
    };
    
    const result = await authService.registerUser(userData);
    
    expect(userRoleService.assignRole).toHaveBeenCalledWith(
      expect.any(String),
      RoleType.OWNER,
      BusinessContext.EVENTS,
      expect.any(Object),
    );
    
    // También debe asignar CUSTOMER en GENERAL
    expect(userRoleService.assignRole).toHaveBeenCalledWith(
      expect.any(String),
      RoleType.CUSTOMER,
      BusinessContext.GENERAL,
      expect.any(Object),
    );
  });
  
  it('should assign OWNER in RESTAURANT for food business', async () => {
    const userData = {
      email: 'restaurant@test.com',
      businessType: 'food',
    };
    
    await authService.registerUser(userData);
    
    expect(userRoleService.assignRole).toHaveBeenCalledWith(
      expect.any(String),
      RoleType.OWNER,
      BusinessContext.RESTAURANT,
      expect.any(Object),
    );
  });
  
  it('should assign CUSTOMER in GENERAL for customer registration', async () => {
    const userData = {
      email: 'customer@test.com',
      businessType: 'customer',
    };
    
    await authService.registerUser(userData);
    
    expect(userRoleService.assignRole).toHaveBeenCalledWith(
      expect.any(String),
      RoleType.CUSTOMER,
      BusinessContext.GENERAL,
      expect.any(Object),
    );
    
    // No debe asignar CUSTOMER dos veces
    const customerCalls = (userRoleService.assignRole as jest.Mock).mock.calls
      .filter(call => call[1] === RoleType.CUSTOMER);
    expect(customerCalls).toHaveLength(1);
  });
});
```

### Pruebas de Integración

```typescript
// user-role.e2e-spec.ts
describe('User Roles E2E', () => {
  it('POST /auth/register - event organizer can create events after registration', async () => {
    // 1. Registrar organizador
    const registerResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'organizer@events.com',
        name: 'Event Organizer',
        password: 'password123',
        businessType: 'events',
      });
    
    expect(registerResponse.status).toBe(201);
    const token = registerResponse.body.access_token;
    
    // 2. Intentar crear evento (debería funcionar)
    const eventResponse = await request(app.getHttpServer())
      .post('/events')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Test Event',
        description: 'Test',
        startDate: '2026-01-01T00:00:00Z',
        endDate: '2026-01-02T00:00:00Z',
      });
    
    expect(eventResponse.status).toBe(201);
  });
  
  it('POST /auth/register - customer cannot create events', async () => {
    // 1. Registrar cliente
    const registerResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'customer@test.com',
        name: 'Customer',
        password: 'password123',
        businessType: 'customer',
      });
    
    const token = registerResponse.body.access_token;
    
    // 2. Intentar crear evento (debería fallar con 403)
    const eventResponse = await request(app.getHttpServer())
      .post('/events')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Test Event',
        description: 'Test',
        startDate: '2026-01-01T00:00:00Z',
        endDate: '2026-01-02T00:00:00Z',
      });
    
    expect(eventResponse.status).toBe(403);
  });
});
```

---

## 🚀 Plan de Despliegue

### Fase 1: Preparación (Día 1)

1. **Backup de base de datos**
   ```bash
   pg_dump $POSTGRESQL_URL > backup_pre_role_migration.sql
   ```

2. **Crear feature branch**
   ```bash
   git checkout -b feature/fix-role-assignment
   ```

3. **Implementar cambios en código**
   - Modificar `auth.service.ts`
   - Actualizar `create-user.dto.ts`
   - Agregar permisos OWNER en EVENTS
   - Crear script de migración

### Fase 2: Pruebas (Día 2)

1. **Pruebas locales**
   ```bash
   npm run test
   npm run test:e2e
   ```

2. **Probar migración en ambiente de desarrollo**
   ```bash
   npm run migrate:roles
   ```

3. **Verificar datos migrados**
   ```sql
   -- Contar usuarios con roles correctos
   SELECT role, context, COUNT(*) 
   FROM user_roles 
   GROUP BY role, context;
   ```

### Fase 3: Despliegue a Producción (Día 3)

1. **Deploy código**
   ```bash
   git push origin feature/fix-role-assignment
   # Crear PR y mergear
   ```

2. **Ejecutar migración en producción**
   ```bash
   # Conectar a producción y ejecutar script
   NODE_ENV=production npm run migrate:roles
   ```

3. **Verificar**
   - Revisar logs de migración
   - Verificar que nuevos registros funcionen
   - Monitorear errores

### Rollback Plan

Si algo sale mal:

```bash
# 1. Restaurar backup
psql $POSTGRESQL_URL < backup_pre_role_migration.sql

# 2. Revertir código
git revert <commit-hash>

# 3. Redeploy
git push origin main
```

---

## 📈 Métricas de Éxito

Después de la migración, verificar:

```sql
-- Usuarios con rol OWNER en EVENTS (organizadores)
SELECT COUNT(*) as event_organizers
FROM user_roles
WHERE role = 'owner' AND context = 'events';

-- Usuarios con rol OWNER en RESTAURANT
SELECT COUNT(*) as restaurant_owners
FROM user_roles
WHERE role = 'owner' AND context = 'restaurant';

-- Usuarios que son CUSTOMER + OWNER (pueden vender y comprar)
SELECT COUNT(DISTINCT ur1.user_id) as dual_role_users
FROM user_roles ur1
INNER JOIN user_roles ur2 ON ur1.user_id = ur2.user_id
WHERE ur1.role = 'customer' AND ur1.context = 'general'
  AND ur2.role = 'owner';

-- Usuarios que solo son CUSTOMER (solo compran)
SELECT COUNT(*)
FROM user_roles
WHERE role = 'customer' AND context = 'general'
  AND user_id NOT IN (
    SELECT user_id FROM user_roles WHERE role = 'owner'
  );
```

---

## 🎓 Guía para el Frontend (si aplica)

Si hay un frontend, debe actualizar el registro:

```typescript
// Antes
const registerData = {
  email: 'user@test.com',
  password: '123456',
  role: 'event_organizer', // ← legacy
};

// Después
const registerData = {
  email: 'user@test.com',
  password: '123456',
  businessType: 'events', // ← nuevo, más claro
  // o 'customer', 'restaurant', 'wardrobe', etc.
};
```

---

*Plan generado: 2026-05-14*
*Versión: 1.0*
