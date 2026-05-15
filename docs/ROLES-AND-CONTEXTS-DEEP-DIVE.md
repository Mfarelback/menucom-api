# Sistema de Roles y Contextos - Análisis Profundo

## ⚠️ Problema Conceptual Identificado

El sistema actual tiene una **inconsistencia arquitectónica**: asigna `CUSTOMER` en contexto `GENERAL` a todos los usuarios nuevos, pero esto es incorrecto para usuarios que deberían ser comerciantes/organizadores.

---

## Índice
1. [Conceptos Fundamentales](#conceptos-fundamentales)
2. [Matriz Roles × Contextos](#matriz-roles--contextos)
3. [Multi-Tenancy y Aislamiento](#multi-tenancy-y-aislamiento)
4. [Problema del Registro Actual](#problema-del-registro-actual)
5. [Cómo Debería Funcionar](#cómo-debería-funcionar)
6. [Jerarquía de Permisos](#jerarquía-de-permisos)
7. [Casos de Uso Reales](#casos-de-uso-reales)
8. [Soluciones Propuestas](#soluciones-propuestas)

---

## Conceptos Fundamentales

### ¿Qué es un Contexto (BusinessContext)?

Un **contexto** es un dominio de negocio aislado donde un usuario puede tener diferentes capacidades:

```typescript
enum BusinessContext {
  GENERAL = 'general',       // Sistema completo (solo para super admins)
  RESTAURANT = 'restaurant', // Negocios de comida
  WARDROBE = 'wardrobe',     // Guardarropas/ropa
  MARKETPLACE = 'marketplace', // Tiendas/Marketplaces
  EVENTS = 'events',         // Eventos y tickets
}
```

**Analogía:** Los contextos son como "dimensiones paralelas" donde el mismo usuario puede tener diferentes roles.

### ¿Qué es un Rol (RoleType)?

Un **rol** define el nivel de privilegio dentro de un contexto:

```typescript
enum RoleType {
  ADMIN = 'admin',           // Control total (en su contexto)
  OWNER = 'owner',           // Dueño del negocio/recurso
  MANAGER = 'manager',       // Gerente (subordinado al owner)
  OPERATOR = 'operator',     // Operador del sistema
  EVENT_ORGANIZER = 'event_organizer', // Organizador de eventos
  CUSTOMER = 'customer',     // Cliente final (solo consume)
}
```

### La Combinación Rol + Contexto

La magia está en la combinación. Un usuario tiene permisos basados en:

```
Permisos = f(Rol, Contexto)
```

Ejemplos:
- `ADMIN` en `GENERAL` = Superusuario del sistema (acceso a todo)
- `OWNER` en `RESTAURANT` = Dueño de un restaurante (acceso solo a su restaurante)
- `EVENT_ORGANIZER` en `EVENTS` = Organizador de eventos (acceso a sus eventos)
- `CUSTOMER` en `EVENTS` = Comprador de tickets (solo puede comprar)

---

## Matriz Roles × Contextos

### Matriz Actual (con PROBLEMAS marcados ⚠️)

| Rol \ Contexto | GENERAL | RESTAURANT | WARDROBE | MARKETPLACE | EVENTS |
|----------------|---------|------------|----------|-------------|--------|
| **ADMIN** | ✅ Todos los permisos | ✅ Todos | ✅ Todos | ✅ Todos | ✅ Todos |
| **OWNER** | ❌ No aplica | ✅ Dueño de restaurante | ✅ Dueño de wardrobe | ✅ Dueño de tienda | ❌ No aplica |
| **MANAGER** | ❌ No aplica | ✅ Gerente de restaurante | ✅ Gerente | ❌ No aplica | ❌ No aplica |
| **EVENT_ORGANIZER** | ❌ No aplica | ❌ No aplica | ❌ No aplica | ❌ No aplica | ✅ Crea eventos |
| **OPERATOR** | ✅ Soporte/Admin | ❌ No aplica | ❌ No aplica | ❌ No aplica | ❌ No aplica |
| **CUSTOMER** | ✅ Compra general | ✅ Cliente restaurante | ✅ Cliente | ✅ Cliente | ✅ Compra tickets |

### Observaciones Críticas:

1. **⚠️ GENERAL no debería tener CUSTOMER** - El contexto GENERAL es para administración del sistema, no para usuarios finales
2. **⚠️ EVENT_ORGANIZER es redundante** - Debería ser OWNER en EVENTS
3. **⚠️ ADMIN en GENERAL es superusuario** - No es lo mismo que OWNER en un contexto

---

## Multi-Tenancy y Aislamiento

### Concepto de Tenant

Un **tenant** es un cliente/organización aislada dentro del sistema:

```
Sistema Menucom (Tenant: sistema)
├── Admin General (ADMIN en GENERAL)
│   └── Puede ver todos los tenants
│
├── Tenant: "Restaurante La Esquina"
│   ├── Owner: Juan (OWNER en RESTAURANT, resourceId: tenant-123)
│   ├── Manager: María (MANAGER en RESTAURANT, resourceId: tenant-123)
│   └── Customers: Clientes varios
│
├── Tenant: "Eventos Pro"
│   ├── Owner: Pedro (OWNER en EVENTS, resourceId: tenant-456)
│   └── Customers: Asistentes a eventos
│
└── Tenant: "Tienda Online X"
    ├── Owner: Ana (OWNER en MARKETPLACE, resourceId: tenant-789)
    └── Customers: Compradores
```

### resourceId - El Aislamiento

El campo `resourceId` en `UserRole` es CRÍTICO para el aislamiento:

```typescript
@Entity('user_roles')
export class UserRole {
  userId: string;      // Quién
  role: RoleType;      // Qué nivel
  context: BusinessContext;  // En qué dominio
  resourceId?: string;  // Cuál recurso específico (NULL = todos en el contexto)
  // ...
}
```

**Ejemplos de resourceId:**
- `resourceId: null` + `role: ADMIN` + `context: GENERAL` = Admin del sistema completo
- `resourceId: "rest-123"` + `role: OWNER` + `context: RESTAURANT` = Dueño del restaurante rest-123
- `resourceId: "rest-123"` + `role: MANAGER` + `context: RESTAURANT` = Gerente del restaurante rest-123

---

## Problema del Registro Actual

### Código Actual (PROBLEMÁTICO)

```typescript
// src/auth/services/auth.service.ts
async registerUser(userData: CreateUserDto) {
  const userRegister = await this.usersService.create(userData);
  
  // ⚠️ PROBLEMA: Siempre asigna CUSTOMER en GENERAL
  await this.userRoleService.assignRole(
    userRegister.id,
    RoleType.CUSTOMER,        // ← Siempre CUSTOMER
    BusinessContext.GENERAL,  // ← Siempre GENERAL
    {
      grantedBy: 'system',
      metadata: { source: 'standard-registration' },
    },
  );
}
```

### Por Qué Está Mal:

1. **GENERAL es para administración del sistema** - No para usuarios comerciales
2. **CUSTOMER no puede crear contenido** - Un organizador necesita permisos de creación
3. **No hay aislamiento por tenant** - Todos quedan en el mismo "bucket"
4. **No distingue tipos de negocio** - Un restaurante vs eventos vs tienda

### Ejemplo del Problema:

```typescript
// Juan se registra como organizador de eventos
POST /auth/register
{
  "email": "juan@eventos.com",
  "name": "Juan Pérez",
  "password": "123456",
  "role": "event_organizer"  // ← Esto va a User.role (legacy)
}

// Resultado ACTUAL (INCORRECTO):
UserRole: {
  userId: "juan-uuid",
  role: "customer",        // ← Wrong!
  context: "general",      // ← Wrong!
  resourceId: null
}

// Juan NO puede crear eventos porque CUSTOMER en GENERAL solo tiene:
// - READ_CATALOG
// - CREATE_ORDER (comprar)
// Pero NO tiene CREATE_EVENT!
```

---

## Cómo Debería Funcionar

### Opción 1: Selección de Tipo de Negocio en Registro (Recomendada)

```typescript
// El usuario selecciona su tipo de negocio al registrarse
POST /auth/register
{
  "email": "juan@eventos.com",
  "name": "Juan Pérez",
  "password": "123456",
  "businessType": "events"  // Nuevo campo: restaurant|wardrobe|events|marketplace|customer
}

// Lógica de asignación:
async registerUser(userData: CreateUserDto) {
  const userRegister = await this.usersService.create(userData);
  
  switch(userData.businessType) {
    case 'events':
      // Es un organizador de eventos
      await this.userRoleService.assignRole(
        userRegister.id,
        RoleType.OWNER,              // ← OWNER, no CUSTOMER
        BusinessContext.EVENTS,      // ← EVENTS, no GENERAL
        { grantedBy: 'system' }
      );
      break;
      
    case 'restaurant':
      await this.userRoleService.assignRole(
        userRegister.id,
        RoleType.OWNER,
        BusinessContext.RESTAURANT,
        { grantedBy: 'system' }
      );
      break;
      
    case 'customer':
    default:
      // Solo quiere comprar, no vender
      await this.userRoleService.assignRole(
        userRegister.id,
        RoleType.CUSTOMER,
        BusinessContext.GENERAL,     // ← Solo customers van a GENERAL
        { grantedBy: 'system' }
      );
  }
}
```

### Opción 2: Flujo de Onboarding Post-Registro

```typescript
// Paso 1: Registro básico (todos son CUSTOMER temporalmente)
POST /auth/register → Crea usuario con CUSTOMER en GENERAL

// Paso 2: Elige tipo de negocio
POST /onboarding/select-business-type
{
  "businessType": "events",
  "businessName": "Eventos Pro"
}

// Resultado:
// - Crea tenant para el negocio
// - Asigna OWNER en EVENTS con resourceId = tenant-id
// - Mantiene CUSTOMER en GENERAL (para comprar en otros negocios)
```

### Resultado Correcto:

```typescript
// Juan el organizador de eventos:
UserRoles: [
  {
    userId: "juan-uuid",
    role: "owner",
    context: "events",
    resourceId: null,  // Puede crear eventos (se asigna tenantId después)
    isActive: true
  },
  {
    userId: "juan-uuid", 
    role: "customer",
    context: "general",
    resourceId: null,  // Para comprar en otros negocios
    isActive: true
  }
]

// Permisos de Juan en EVENTS (como OWNER):
// - CREATE_EVENT ✅
// - READ_EVENT ✅
// - UPDATE_EVENT ✅
// - DELETE_EVENT ✅
// - MANAGE_TICKETS ✅
// - VALIDATE_TICKETS ✅
// - VIEW_ANALYTICS ✅
// - MANAGE_PAYMENTS ✅
```

---

## Jerarquía de Permisos

### Jerarquía en un Contexto Específico

```
ADMIN (en EVENTS)
  └── Todos los permisos + puede gestionar otros usuarios

OWNER (en EVENTS)  ← Lo que debería ser un organizador
  └── CREATE_EVENT, UPDATE_EVENT, DELETE_EVENT
  └── MANAGE_TICKETS, VALIDATE_TICKETS
  └── VIEW_ANALYTICS, MANAGE_PAYMENTS
  └── NO puede crear otros owners (solo managers)

MANAGER (en EVENTS, resourceId: event-123)
  └── UPDATE_EVENT (del evento específico)
  └── MANAGE_TICKETS, VALIDATE_TICKETS (del evento)
  └── NO puede crear eventos nuevos

CUSTOMER (en EVENTS)
  └── READ_EVENT (ver eventos)
  └── CREATE_ORDER (comprar tickets)
  └── READ_ORDER (ver sus compras)
```

### Comparación: OWNER vs ADMIN

| Capacidad | OWNER en EVENTS | ADMIN en EVENTS |
|-----------|-----------------|-----------------|
| Crear eventos | ✅ Sí | ✅ Sí |
| Editar sus eventos | ✅ Sí | ✅ Sí |
| Editar eventos de otros | ❌ No | ✅ Sí |
| Ver analytics de sus eventos | ✅ Sí | ✅ Sí |
| Ver analytics de todos | ❌ No | ✅ Sí |
| Crear managers | ✅ Sí | ✅ Sí |
| Crear otros owners | ❌ No | ✅ Sí |
| Gestionar pagos propios | ✅ Sí | ✅ Sí |
| Gestionar pagos de todos | ❌ No | ✅ Sí |

---

## Casos de Uso Reales

### Caso 1: Organizador de Eventos (Juan)

```typescript
// Registro
POST /auth/register
{
  "email": "juan@eventospro.com",
  "name": "Juan Pérez",
  "businessType": "events"
}

// Roles asignados:
UserRoles: [
  { role: "owner", context: "events", resourceId: null }
]

// Acciones permitidas:
// ✅ Crear evento "Concierto Rock"
// ✅ Crear tickets para el evento
// ✅ Ver dashboard de ventas
// ✅ Validar tickets en puerta
// ❌ No puede ver eventos de otros organizadores
// ❌ No puede modificar restaurantes
```

### Caso 2: Cliente que Compra Ticket (María)

```typescript
// Registro
POST /auth/register
{
  "email": "maria@gmail.com",
  "name": "María García",
  "businessType": "customer"
}

// Roles asignados:
UserRoles: [
  { role: "customer", context: "general", resourceId: null },
  { role: "customer", context: "events", resourceId: null },
  { role: "customer", context: "restaurant", resourceId: null }
]

// Acciones permitidas:
// ✅ Ver eventos disponibles
// ✅ Comprar tickets
// ✅ Ver sus tickets comprados
// ❌ No puede crear eventos
// ❌ No puede ver analytics
```

### Caso 3: Dueño de Restaurante (Pedro)

```typescript
// Registro
POST /auth/register
{
  "email": "pedro@laesquina.com",
  "name": "Pedro López",
  "businessType": "restaurant"
}

// Roles asignados:
UserRoles: [
  { role: "owner", context: "restaurant", resourceId: "tenant-la-esquina" }
]

// Acciones permitidas:
// ✅ Crear menú/catálogo
// ✅ Gestionar órdenes
// ✅ Ver analytics del restaurante
// ❌ No puede crear eventos
// ❌ No puede ver otros restaurantes
```

### Caso 4: Gerente de Evento (Ana)

```typescript
// Juan (owner) invita a Ana como gerente
POST /user-roles/assign
{
  "userId": "ana-uuid",
  "role": "manager",
  "context": "events",
  "resourceId": "event-concierto-123"  // ← Solo este evento específico
}

// Roles asignados:
UserRoles: [
  { role: "manager", context: "events", resourceId: "event-concierto-123" }
]

// Acciones permitidas:
// ✅ Validar tickets del evento
// ✅ Ver analytics del evento
// ✅ Editar información del evento
// ❌ No puede crear nuevos eventos
// ❌ No puede ver otros eventos de Juan
```

### Caso 5: Super Admin del Sistema (Carlos)

```typescript
// Roles asignados (manualmente por dev/ops):
UserRoles: [
  { role: "admin", context: "general", resourceId: null }
]

// Acciones permitidas:
// ✅ Todo en todos los contextos
// ✅ Gestionar todos los tenants
// ✅ Ver analytics globales
// ✅ Modificar cualquier recurso
```

---

## Soluciones Propuestas

### Solución 1: Modificar el Registro (Mínima Invasiva)

**Archivo:** `src/auth/services/auth.service.ts`

```typescript
async registerUser(userData: CreateUserDto) {
  const userRegister = await this.usersService.create(userData);
  
  // Mapear role legacy a (roleType, businessContext)
  const roleMapping: Record<string, { role: RoleType; context: BusinessContext }> = {
    // Comerciantes - se convierten en OWNERS en su contexto
    'food': { role: RoleType.OWNER, context: BusinessContext.RESTAURANT },
    'dinning': { role: RoleType.OWNER, context: BusinessContext.RESTAURANT },
    'clothes': { role: RoleType.OWNER, context: BusinessContext.WARDROBE },
    'retail': { role: RoleType.OWNER, context: BusinessContext.MARKETPLACE },
    'grocery': { role: RoleType.OWNER, context: BusinessContext.MARKETPLACE },
    'electronics': { role: RoleType.OWNER, context: BusinessContext.MARKETPLACE },
    'pharmacy': { role: RoleType.OWNER, context: BusinessContext.GENERAL },
    'beauty': { role: RoleType.OWNER, context: BusinessContext.GENERAL },
    
    // ⚠️ NUEVO: Organizador de eventos
    'event_organizer': { role: RoleType.OWNER, context: BusinessContext.EVENTS },
    
    // Admin del sistema
    'admin': { role: RoleType.ADMIN, context: BusinessContext.GENERAL },
    'operador': { role: RoleType.OPERATOR, context: BusinessContext.GENERAL },
    
    // Cliente final
    'customer': { role: RoleType.CUSTOMER, context: BusinessContext.GENERAL },
  };
  
  const mapping = roleMapping[userData.role] || { 
    role: RoleType.CUSTOMER, 
    context: BusinessContext.GENERAL 
  };
  
  await this.userRoleService.assignRole(
    userRegister.id,
    mapping.role,
    mapping.context,
    {
      grantedBy: 'system',
      metadata: { 
        source: 'standard-registration',
        legacyRole: userData.role 
      },
    },
  );
  
  // Si es un comerciante, también darle CUSTOMER para que pueda comprar en otros negocios
  if (mapping.role === RoleType.OWNER || mapping.role === RoleType.EVENT_ORGANIZER) {
    await this.userRoleService.assignRole(
      userRegister.id,
      RoleType.CUSTOMER,
      BusinessContext.GENERAL,
      {
        grantedBy: 'system',
        metadata: { source: 'dual-role-customer-capability' },
      },
    );
  }
}
```

### Solución 2: Separar Autenticación de Onboarding (Más Completa)

**Nuevo flujo:**

1. **Registro:** Solo crea el usuario sin roles específicos (o CUSTOMER en GENERAL)
2. **Onboarding:** Endpoint separado para configurar el tipo de negocio
3. **Resultado:** Asigna roles correctos según el tipo de negocio elegido

```typescript
// Paso 1: Registro (auth.service.ts)
async registerUser(userData: CreateUserDto) {
  const userRegister = await this.usersService.create(userData);
  
  // Por defecto, solo CUSTOMER en GENERAL (para navegar y comprar)
  await this.userRoleService.assignRole(
    userRegister.id,
    RoleType.CUSTOMER,
    BusinessContext.GENERAL,
    { grantedBy: 'system' }
  );
  
  return { access_token, needsOnboarding: true };  // ← Flag importante
}

// Paso 2: Onboarding (nuevo onboarding.service.ts)
async completeOnboarding(userId: string, businessType: BusinessType) {
  // Crear tenant para el negocio
  const tenant = await this.tenantService.create({
    ownerId: userId,
    type: businessType,
    // ...
  });
  
  // Asignar rol de OWNER en el contexto correspondiente
  const context = this.getContextForBusinessType(businessType);
  await this.userRoleService.assignRole(
    userId,
    RoleType.OWNER,
    context,
    { 
      resourceId: tenant.id,  // ← Importante: vinculado al tenant
      grantedBy: 'system' 
    }
  );
  
  return { onboardingComplete: true, tenantId: tenant.id };
}
```

### Solución 3: Eliminar EVENT_ORGANIZER y unificar con OWNER

**Cambio en permissions.model.ts:**

```typescript
// ELIMINAR:
// EVENT_ORGANIZER = 'event_organizer'

// USAR OWNER en su lugar:
[BusinessContext.EVENTS]: {
  [RoleType.OWNER]: [  // ← OWNER en lugar de EVENT_ORGANIZER
    Permission.CREATE_EVENT,
    Permission.READ_EVENT,
    Permission.UPDATE_EVENT,
    Permission.DELETE_EVENT,
    Permission.MANAGE_TICKETS,
    Permission.VALIDATE_TICKETS,
    Permission.VIEW_ANALYTICS,
    Permission.MANAGE_PAYMENTS,
  ],
  // ...
}
```

**Ventajas:**
- Simplifica el modelo mental: OWNER = dueño del negocio (sea restaurante o eventos)
- Unifica la jerarquía: ADMIN > OWNER > MANAGER > CUSTOMER
- Funciona igual en todos los contextos

---

## Conclusión

### El Problema Real

El sistema actual **confunde** el contexto `GENERAL` (administración del sistema) con el registro de usuarios comerciales. Esto lleva a:

1. Organizadores de eventos sin permisos para crear eventos
2. Todos los usuarios en el mismo "bucket" sin aislamiento
3. Imposibilidad de tener multi-tenancy real

### La Solución Correcta

Un organizador de eventos debería tener:

```typescript
{
  role: RoleType.OWNER,           // ← OWNER, no CUSTOMER ni EVENT_ORGANIZER
  context: BusinessContext.EVENTS, // ← EVENTS, no GENERAL
  resourceId: "tenant-eventos-pro" // ← Su tenant específico
}
```

Con estos permisos:
```typescript
[BusinessContext.EVENTS]: {
  [RoleType.OWNER]: [
    Permission.CREATE_EVENT,
    Permission.READ_EVENT,
    Permission.UPDATE_EVENT,
    Permission.DELETE_EVENT,
    Permission.MANAGE_TICKETS,
    Permission.VALIDATE_TICKETS,
    Permission.VIEW_ANALYTICS,
    Permission.MANAGE_PAYMENTS,
  ]
}
```

### Próximos Pasos Recomendados

1. **Inmediato:** Modificar `auth.service.ts` para mapear `event_organizer` → `OWNER` en `EVENTS`
2. **Corto plazo:** Implementar flujo de onboarding para crear tenants automáticamente
3. **Mediano plazo:** Considerar eliminar `EVENT_ORGANIZER` y unificar con `OWNER`
4. **Largo plazo:** Implementar resourceId en todas las queries para aislamiento completo

---

*Documento generado: 2026-05-14*
*Análisis de arquitectura de roles y contextos*
