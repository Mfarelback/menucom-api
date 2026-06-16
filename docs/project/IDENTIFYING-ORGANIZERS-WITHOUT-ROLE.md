# Identificación de Organizadores sin EVENT_ORGANIZER

## La Respuesta Corta

**Un organizador de eventos se identifica por:**
```typescript
role: RoleType.OWNER
context: BusinessContext.EVENTS
```

**No por:**
```typescript
role: RoleType.EVENT_ORGANIZER  // ← Redundante
context: BusinessContext.EVENTS
```

---

## Analogía: El Shopping Center

Imagina un shopping center con diferentes sectores:

```
🏢 SHOPPING CENTER (Menucom)
│
├── 🍽️ SECTOR RESTAURANTES (BusinessContext.RESTAURANT)
│   ├── Local 1: "Parrilla Don José" (resourceId: rest-001)
│   │   └── 👤 Juan (OWNER) ← Dueño del restaurante
│   │
│   └── Local 2: "Sushi Club" (resourceId: rest-002)
│       └── 👤 María (OWNER) ← Dueña del restaurante
│
├── 👔 SECTOR ROPA (BusinessContext.WARDROBE)
│   └── Local 3: "Fashion Store" (resourceId: ward-001)
│       └── 👤 Pedro (OWNER) ← Dueño de la tienda
│
└── 🎪 SECTOR EVENTOS (BusinessContext.EVENTS)
    ├── Local 4: "Eventos Pro" (resourceId: event-001)
    │   └── 👤 Ana (OWNER) ← Dueña de la productora de eventos
    │
    └── Local 5: "Conciertos SA" (resourceId: event-002)
        └── 👤 Carlos (OWNER) ← Dueño de la productora
```

**Observación:** Todos son **OWNER**, pero en **contextos diferentes**. Ana es organizadora de eventos porque es OWNER en el contexto EVENTS.

---

## Cómo Identificar un Organizador de Eventos

### Método 1: Query Simple

```typescript
// ¿Es organizador de eventos?
async isEventOrganizer(userId: string): Promise<boolean> {
  const roles = await this.userRoleRepository.find({
    where: {
      userId,
      role: RoleType.OWNER,
      context: BusinessContext.EVENTS,
      isActive: true,
    },
  });
  
  return roles.length > 0;
}
```

### Método 2: Con ResourceId (Tenant Específico)

```typescript
// ¿Es organizador del evento específico?
async isEventOwner(userId: string, eventId: string): Promise<boolean> {
  // Obtener el tenant del evento
  const event = await this.eventRepository.findOne({
    where: { id: eventId },
    select: ['tenantId'],
  });
  
  // Verificar si el usuario es OWNER de ese tenant en contexto EVENTS
  return await this.userRoleService.hasRole(
    userId,
    RoleType.OWNER,
    BusinessContext.EVENTS,
    event.tenantId,  // resourceId
  );
}
```

### Método 3: Obtener Todos los Organizadores

```typescript
// Obtener todos los organizadores de eventos
async getAllEventOrganizers(): Promise<User[]> {
  const userRoles = await this.userRoleRepository.find({
    where: {
      role: RoleType.OWNER,
      context: BusinessContext.EVENTS,
      isActive: true,
    },
    relations: ['user'],
  });
  
  return userRoles.map(ur => ur.user);
}
```

### Método 4: En el Guard/Decorator

```typescript
// Decorator para proteger rutas de organizadores
export function RequireEventOrganizer() {
  return applyDecorators(
    UseGuards(JwtAuthGuard, PermissionsGuard),
    InBusinessContext(BusinessContext.EVENTS),
    RequirePermissions(Permission.CREATE_EVENT),
  );
}

// Uso:
@Controller('events')
export class EventsController {
  
  @Post()
  @RequireEventOrganizer()  // ← Verifica OWNER en EVENTS
  async createEvent(@Body() dto: CreateEventDto, @Request() req) {
    // Solo organizadores pueden crear eventos
  }
}
```

---

## Comparación: Antes vs Después

### Antes (con EVENT_ORGANIZER)

```typescript
// Identificación
async isEventOrganizer(userId: string): Promise<boolean> {
  return await this.userRoleService.hasRole(
    userId,
    RoleType.EVENT_ORGANIZER,  // ← Tipo específico
    BusinessContext.EVENTS,
  );
}

// Permisos
[BusinessContext.EVENTS]: {
  [RoleType.EVENT_ORGANIZER]: [  // ← Rol específico solo para eventos
    Permission.CREATE_EVENT,
    Permission.MANAGE_TICKETS,
    // ...
  ],
  [RoleType.ADMIN]: [...],
  [RoleType.CUSTOMER]: [...],
}
```

**Problemas:**
- ❌ Necesitas un rol específico por cada tipo de negocio
- ❌ Si agregas "Escuelas de baile", necesitas `DANCE_SCHOOL_OWNER`
- ❌ Jerarquía inconsistente: ADMIN > EVENT_ORGANIZER > ? > CUSTOMER
- ❌ No hay relación clara entre EVENT_ORGANIZER y OWNER de restaurante

### Después (sin EVENT_ORGANIZER)

```typescript
// Identificación
async isEventOrganizer(userId: string): Promise<boolean> {
  return await this.userRoleService.hasRole(
    userId,
    RoleType.OWNER,           // ← Rol genérico: dueño del negocio
    BusinessContext.EVENTS,   // ← Contexto específico: eventos
  );
}

// Permisos
[BusinessContext.EVENTS]: {
  [RoleType.OWNER]: [  // ← OWNER funciona igual en todos los contextos
    Permission.CREATE_EVENT,
    Permission.MANAGE_TICKETS,
    // ...
  ],
  [RoleType.ADMIN]: [...],
  [RoleType.MANAGER]: [...],  // ← Ahora puedes tener managers!
  [RoleType.CUSTOMER]: [...],
}
```

**Ventajas:**
- ✅ Un OWNER es dueño de su negocio, sea cual sea
- ✅ Jerarquía consistente: ADMIN > OWNER > MANAGER > CUSTOMER
- ✅ Funciona para cualquier contexto nuevo sin crear roles
- ✅ Puedes tener MANAGERs de eventos (imposible con EVENT_ORGANIZER)

---

## Casos de Uso Prácticos

### 1. Dashboard del Organizador

```typescript
@Controller('organizer-dashboard')
export class OrganizerDashboardController {
  
  @Get()
  @UseGuards(JwtAuthGuard)
  async getDashboard(@Request() req) {
    const userId = req.user.userId;
    
    // Verificar si es organizador
    const isOrganizer = await this.userRoleService.hasRole(
      userId,
      RoleType.OWNER,
      BusinessContext.EVENTS,
    );
    
    if (!isOrganizer) {
      throw new ForbiddenException('No eres organizador de eventos');
    }
    
    // Obtener sus eventos
    const events = await this.eventService.findByOrganizer(userId);
    
    // Obtener analytics
    const analytics = await this.analyticsService.getEventAnalytics(userId);
    
    return { events, analytics };
  }
}
```

### 2. Selector de Tipo de Usuario en Frontend

```typescript
// React/Vue/Angular component
interface UserType {
  id: string;
  label: string;
  icon: string;
  role: RoleType;
  context: BusinessContext;
}

const userTypes: UserType[] = [
  { 
    id: 'customer', 
    label: 'Solo quiero comprar', 
    icon: '🛒',
    role: RoleType.CUSTOMER,
    context: BusinessContext.GENERAL,
  },
  { 
    id: 'event_organizer', 
    label: 'Organizar eventos', 
    icon: '🎪',
    role: RoleType.OWNER,           // ← OWNER
    context: BusinessContext.EVENTS, // ← en EVENTS
  },
  { 
    id: 'restaurant_owner', 
    label: 'Tengo un restaurante', 
    icon: '🍽️',
    role: RoleType.OWNER,              // ← OWNER
    context: BusinessContext.RESTAURANT, // ← en RESTAURANT
  },
  { 
    id: 'store_owner', 
    label: 'Tengo una tienda', 
    icon: '🏪',
    role: RoleType.OWNER,               // ← OWNER
    context: BusinessContext.MARKETPLACE, // ← en MARKETPLACE
  },
];

// El usuario selecciona "Organizar eventos"
// Backend recibe: { businessType: 'events' }
// Backend asigna: OWNER en EVENTS
```

### 3. Middleware de Identificación

```typescript
// Express/NestJS middleware
@Injectable()
export class EventOrganizerMiddleware implements NestMiddleware {
  constructor(private userRoleService: UserRoleService) {}
  
  async use(req: Request, res: Response, next: NextFunction) {
    const userId = req.user?.userId;
    
    // Verificar si es organizador
    const isOrganizer = await this.userRoleService.hasRole(
      userId,
      RoleType.OWNER,
      BusinessContext.EVENTS,
    );
    
    // Agregar flag a la request
    req.user.isEventOrganizer = isOrganizer;
    req.user.isRestaurantOwner = await this.userRoleService.hasRole(
      userId,
      RoleType.OWNER,
      BusinessContext.RESTAURANT,
    );
    
    next();
  }
}
```

---

## Extensibilidad: Agregar Nuevos Tipos de Negocio

### Escenario: Agregar "Escuelas de Baile"

**Con EVENT_ORGANIZER (mal):**
```typescript
// Tienes que crear un nuevo rol
enum RoleType {
  // ... roles existentes
  EVENT_ORGANIZER = 'event_organizer',
  DANCE_SCHOOL_OWNER = 'dance_school_owner',  // ← Nuevo rol
  // ...
}

// Y definir permisos
[BusinessContext.DANCE_SCHOOLS]: {
  [RoleType.DANCE_SCHOOL_OWNER]: [...],  // ← Nuevo mapeo
}
```

**Sin EVENT_ORGANIZER (bien):**
```typescript
// Solo agregas el contexto
enum BusinessContext {
  // ... contextos existentes
  EVENTS = 'events',
  DANCE_SCHOOLS = 'dance_schools',  // ← Solo esto
}

// Y usas OWNER que ya existe
[BusinessContext.DANCE_SCHOOLS]: {
  [RoleType.OWNER]: [...],  // ← OWNER funciona para todo
}
```

---

## Jerarquía Clara y Universal

### Jerarquía de Roles (Independiente del Contexto)

```
ADMIN        → Control total del contexto
  │
  ├── Puede crear otros admins
  ├── Puede ver todos los recursos
  └── Puede gestionar todos los usuarios
  
OWNER        → Dueño del negocio/local
  │
  ├── Puede crear managers
  ├── Puede ver analytics de su negocio
  └── Puede gestionar su negocio
  
MANAGER      → Gerente/Administrador del negocio
  │
  ├── Puede operar el negocio
  ├── NO puede crear otros managers
  └── Limitado a ciertos recursos (con resourceId)
  
CUSTOMER     → Cliente final
   └── Solo puede consumir/comprar
```

### Ejemplos por Contexto

| Contexto | ADMIN | OWNER | MANAGER | CUSTOMER |
|----------|-------|-------|---------|----------|
| **GENERAL** | Super admin del sistema | N/A | Operador de soporte | Usuario registrado |
| **EVENTS** | Admin de plataforma de eventos | Organizador de eventos | Staff del evento | Comprador de tickets |
| **RESTAURANT** | Admin de plataforma de restaurantes | Dueño del restaurante | Gerente del restaurante | Cliente que pide |
| **MARKETPLACE** | Admin de marketplace | Vendedor de la tienda | Empleado de la tienda | Comprador |

---

## Queries SQL de Identificación

### ¿Quiénes son organizadores de eventos?

```sql
-- Todos los organizadores de eventos
SELECT u.id, u.name, u.email
FROM public.user u
INNER JOIN user_roles ur ON u.id = ur.user_id
WHERE ur.role = 'owner'
  AND ur.context = 'events'
  AND ur.is_active = true;
```

### ¿Qué eventos puede gestionar este usuario?

```sql
-- Eventos que el usuario puede gestionar (es OWNER)
SELECT e.id, e.name, e.start_date
FROM events e
WHERE e.tenant_id IN (
  SELECT resource_id
  FROM user_roles
  WHERE user_id = 'uuid-del-usuario'
    AND role = 'owner'
    AND context = 'events'
    AND is_active = true
);
```

### ¿Cuántos organizadores tenemos?

```sql
-- Contar organizadores de eventos
SELECT COUNT(DISTINCT user_id) as total_organizers
FROM user_roles
WHERE role = 'owner'
  AND context = 'events'
  AND is_active = true;
```

---

## Conclusión

### ¿Por qué funciona mejor así?

1. **Semántica clara:** Un organizador de eventos es un **dueño de un negocio de eventos**
2. **Jerarquía consistente:** OWNER > MANAGER > CUSTOMER funciona en todos los contextos
3. **Escalable:** Agregar nuevos tipos de negocio no requiere nuevos roles
4. **Flexible:** Puedes tener MANAGERs de eventos (lo que era imposible con EVENT_ORGANIZER)
5. **Simple:** Menos enums, menos código, menos confusión

### La Regla de Oro

```
Tipo de Negocio = Contexto (BusinessContext)
Nivel de Acceso = Rol (RoleType)

Organizador de eventos = OWNER en EVENTS
Dueño de restaurante = OWNER en RESTAURANT
Vendedor de tienda = OWNER en MARKETPLACE
```

---

*Documento generado: 2026-05-14*
*Explicación de identificación de organizadores sin role específico*
