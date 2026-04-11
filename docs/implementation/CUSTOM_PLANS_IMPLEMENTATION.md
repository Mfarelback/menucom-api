# Sistema de Planes Personalizables - MenuCom API

## 🎯 Overview

Se ha extendido el sistema de membresías existente para permitir que los administradores creen **planes personalizables** con límites específicos para menús, items de menú, wardrobes e items de ropa. Este sistema mantiene compatibilidad total con los planes estándar existentes.

## ✨ Nuevas Funcionalidades

### 1. **Planes Personalizables por Administradores**
- Los administradores pueden crear planes con límites totalmente configurables
- Soporte para diferentes ciclos de facturación (mensual, anual, trimestral, semanal, lifetime)
- Metadata personalizable (colores, iconos, características especiales)
- Gestión de features específicas por plan

### 2. **Control de Límites Extendido**
Ahora se controlan límites para:
- **Menús**: Cantidad de menús que puede crear un usuario
- **Items de Menú**: Cantidad de items por menú/usuario
- **Wardrobes**: Cantidad de wardrobes que puede crear
- **Items de Ropa**: Cantidad de prendas por wardrobe/usuario
- **Ubicaciones**: Cantidad de locales/sucursales
- **Retención de Analytics**: Días de historial analítico
- **Usuarios**: Para planes empresariales multi-usuario
- **API Calls**: Límites de llamadas API por mes
- **Storage**: Límite de almacenamiento en MB

### 3. **Planes Estándar Actualizados**

#### **Plan FREE**
```json
{
  "maxMenus": 1,
  "maxMenuItems": 10,
  "maxWardrobes": 1,
  "maxClothingItems": 10,
  "maxLocations": 1,
  "analyticsRetention": 7,
  "maxUsers": 1,
  "maxApiCalls": 100,
  "storageLimit": 100
}
```

#### **Plan PREMIUM**
```json
{
  "maxMenus": 5,
  "maxMenuItems": 500,
  "maxWardrobes": 5,
  "maxClothingItems": 500,
  "maxLocations": 3,
  "analyticsRetention": 90,
  "maxUsers": 3,
  "maxApiCalls": 10000,
  "storageLimit": 1000
}
```

#### **Plan ENTERPRISE**
```json
{
  "maxMenus": -1,
  "maxMenuItems": -1,
  "maxWardrobes": -1,
  "maxClothingItems": -1,
  "maxLocations": -1,
  "analyticsRetention": 365,
  "maxUsers": -1,
  "maxApiCalls": -1,
  "storageLimit": -1
}
```

## 🏗️ Arquitectura Implementada

### Nuevas Entidades

#### **SubscriptionPlan**
```typescript
class SubscriptionPlan {
  id: string;
  name: string;
  displayName: string;
  description: string;
  type: PlanType; // STANDARD | CUSTOM
  status: PlanStatus; // ACTIVE | INACTIVE | ARCHIVED
  price: number;
  currency: string;
  billingCycle: string; // monthly, yearly, lifetime, etc.
  features: MembershipFeature[];
  limits: {
    maxMenus: number;
    maxMenuItems: number;
    maxWardrobes: number;
    maxClothingItems: number;
    maxLocations: number;
    analyticsRetention: number;
    maxUsers: number;
    maxApiCalls: number;
    storageLimit: number;
  };
  metadata: {
    color?: string;
    icon?: string;
    popular?: boolean;
    trial?: { enabled: boolean; days: number };
    customizations?: {
      branding?: boolean;
      whiteLabel?: boolean;
      customDomain?: boolean;
      prioritySupport?: boolean;
    };
  };
  createdByUserId: string;
}
```

#### **Membership (Actualizada)**
Se agregó relación con planes personalizables:
```typescript
class Membership {
  // ... campos existentes
  subscriptionPlan: SubscriptionPlan;
  subscriptionPlanId: string;
}
```

### Nuevos Servicios

#### **SubscriptionPlanService**
Gestiona la creación, actualización y consulta de planes personalizables:
- `createPlan()` - Crear planes personalizados
- `getActivePlans()` - Obtener todos los planes activos
- `getPlansByType()` - Filtrar por tipo (STANDARD/CUSTOM)
- `canCreateResource()` - Verificar límites específicos
- `archivePlan()` - Archivar planes (soft delete)

#### **ResourceLimitService**
Controla específicamente los límites de recursos:
- `canCreateMenu()` - Verificar límite de menús
- `canCreateMenuItem()` - Verificar límite de items de menú
- `canCreateWardrobe()` - Verificar límite de wardrobes
- `canCreateClothingItem()` - Verificar límite de items de ropa
- `validateResourceCreation()` - Validación completa con excepciones

## 🚀 API Endpoints

### Gestión de Planes (Solo Administradores)

```http
# Crear plan personalizado
POST /admin/subscription-plans
Authorization: Bearer {jwt_token}
Role: admin
{
  "name": "plan-profesional",
  "displayName": "Plan Profesional",
  "description": "Para negocios medianos",
  "price": 25000,
  "currency": "ARS",
  "billingCycle": "monthly",
  "features": ["basic_menu", "advanced_analytics"],
  "limits": {
    "maxMenus": 3,
    "maxMenuItems": 200,
    "maxWardrobes": 3,
    "maxClothingItems": 200,
    "maxLocations": 2,
    "analyticsRetention": 60,
    "maxUsers": 2,
    "maxApiCalls": 5000,
    "storageLimit": 500
  },
  "metadata": {
    "color": "#10B981",
    "icon": "professional",
    "popular": true
  }
}

# Obtener todos los planes
GET /admin/subscription-plans

# Actualizar plan
PUT /admin/subscription-plans/{id}

# Archivar plan
DELETE /admin/subscription-plans/{id}

# Estadísticas de planes
GET /admin/subscription-plans/stats

# Seed de planes estándar
POST /admin/subscription-plans/seed-standard-plans
```

### Planes para Usuarios

```http
# Obtener planes disponibles (público)
GET /membership/custom-plans

# Suscribirse a plan personalizado
POST /membership/subscribe-custom
{
  "subscriptionPlanId": "uuid-del-plan",
  "paymentId": "MP_PAYMENT_ID",
  "currency": "ARS"
}

# Obtener límites actuales del usuario
GET /membership/limits
```

## 💡 Uso en Controladores

### Validación de Límites en Creación de Recursos

```typescript
@Controller('menu')
export class MenuController {
  constructor(
    private readonly menuService: MenuService,
    private readonly resourceLimitService: ResourceLimitService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async createMenu(@Request() req, @Body() createMenuDto: CreateMenuDto) {
    // Validar límite antes de crear
    await this.resourceLimitService.validateResourceCreation(
      req.user.id,
      'menu',
    );
    
    return this.menuService.create(req.user.id, createMenuDto);
  }

  @Post(':menuId/items/bulk')
  @UseGuards(JwtAuthGuard)
  async createBulkItems(
    @Request() req,
    @Param('menuId') menuId: string,
    @Body() items: CreateMenuItemDto[],
  ) {
    // Validar límite con cantidad específica
    await this.resourceLimitService.validateResourceCreation(
      req.user.id,
      'menuItem',
      items.length,
    );
    
    return this.menuService.createBulkItems(menuId, items);
  }
}
```

### Controlador de Wardrobes

```typescript
@Controller('wardrobes')
export class WardrobeController {
  constructor(
    private readonly wardrobeService: WardrobeService,
    private readonly resourceLimitService: ResourceLimitService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async createWardrobe(@Request() req, @Body() createWardrobeDto: CreateWardrobeDto) {
    await this.resourceLimitService.validateResourceCreation(
      req.user.id,
      'wardrobe',
    );
    
    return this.wardrobeService.create(req.user.id, createWardrobeDto);
  }

  @Post(':wardrobeId/clothing-items')
  @UseGuards(JwtAuthGuard)
  async addClothingItem(
    @Request() req,
    @Param('wardrobeId') wardrobeId: string,
    @Body() createClothingItemDto: CreateClothingItemDto,
  ) {
    await this.resourceLimitService.validateResourceCreation(
      req.user.id,
      'clothingItem',
    );
    
    return this.wardrobeService.addClothingItem(wardrobeId, createClothingItemDto);
  }
}
```

## 🎨 Frontend Integration

### Mostrar Planes Disponibles

```typescript
// Obtener planes para mostrar en pricing page
const response = await fetch('/membership/custom-plans');
const { plans } = await response.json();

plans.forEach(plan => {
  console.log(`Plan: ${plan.displayName}`);
  console.log(`Precio: ${plan.price} ${plan.currency}`);
  console.log(`Límites:`, plan.limits);
  console.log(`Features:`, plan.features);
});
```

### Verificar Límites Antes de Crear Recursos

```typescript
// Verificar límites del usuario actual
const limitsResponse = await fetch('/membership/limits');
const limits = await limitsResponse.json();

// Mostrar progreso de uso
const menuUsage = (limits.usage.menus / limits.limits.maxMenus) * 100;
const wardrobeUsage = (limits.usage.wardrobes / limits.limits.maxWardrobes) * 100;

// Deshabilitar botones si se alcanzó el límite
const canCreateMenu = limits.usage.menus < limits.limits.maxMenus;
const canCreateWardrobe = limits.usage.wardrobes < limits.limits.maxWardrobes;
```

### Interfaz de Administrador

```typescript
// Panel de administración para crear planes
const createPlan = async (planData) => {
  const response = await fetch('/admin/subscription-plans', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(planData)
  });
  
  if (response.ok) {
    const newPlan = await response.json();
    console.log('Plan creado:', newPlan);
  }
};
```

## 🔄 Migración y Compatibilidad

### Backwards Compatibility
- Los usuarios existentes mantienen sus membresías actuales
- Los planes estándar (FREE, PREMIUM, ENTERPRISE) siguen funcionando
- Los límites existentes se amplían automáticamente para incluir wardrobes

### Migración de Datos
```sql
-- Los nuevos campos en Membership son opcionales
-- Los planes estándar se crean automáticamente con el endpoint seed
ALTER TABLE membership ADD COLUMN subscriptionPlanId VARCHAR NULL;
```

## 🧪 Testing

### Casos de Prueba Importantes

1. **Creación de Planes**
   - Administrador puede crear planes personalizados
   - Usuarios normales no pueden acceder a endpoints de admin
   - Validación de límites coherentes

2. **Suscripción a Planes**
   - Usuario puede suscribirse a plan personalizado
   - Limits se aplican correctamente según el plan
   - Auditoría registra cambios correctamente

3. **Validación de Límites**
   - Límites de menús se respetan
   - Límites de wardrobes se respetan
   - Límites de items se respetan
   - Planes unlimited (-1) funcionan correctamente

4. **Compatibilidad**
   - Usuarios con planes estándar siguen funcionando
   - Migración no rompe funcionalidad existente

## 🚦 Next Steps

### Implementaciones Pendientes
1. **Integrar conteos reales** en ResourceLimitService (conexión con MenuService y WardrobeService)
2. **Endpoints de pagos** para planes personalizados
3. **Dashboard de administrador** para gestión visual de planes
4. **Notificaciones** cuando usuarios se acercan a límites
5. **Analytics** de uso de planes personalizados
6. **Exportación** de configuraciones de planes
7. **Templates** de planes predefinidos para diferentes industrias

### Consideraciones Futuras
- **Planes por industria** (restaurante, boutique, spa, etc.)
- **Descuentos y promociones** en planes personalizados
- **Planes familiares/equipos** con usuarios múltiples
- **API Gateway** con rate limiting basado en plan
- **Webhooks** para cambios de plan
- **Integración con herramientas externas** según plan

## 📝 Conclusión

El sistema de planes personalizables extiende significativamente las capacidades de MenuCom, permitiendo:

✅ **Flexibilidad total** para administradores en la creación de planes
✅ **Control granular** de límites por tipo de recurso
✅ **Escalabilidad** para diferentes tipos de negocios
✅ **Compatibilidad completa** con el sistema existente
✅ **Experiencia mejorada** para usuarios con límites claros
✅ **Monetización avanzada** con planes específicos por segmento

Este sistema posiciona a MenuCom como una plataforma verdaderamente adaptable a las necesidades específicas de cada tipo de negocio, desde pequeños emprendimientos hasta grandes empresas con requerimientos complejos.
