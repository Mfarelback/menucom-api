# 📚 Cómo usar AppConfigService en otros módulos

El servicio `AppConfigService` está disponible globalmente en toda la aplicación. Aquí tienes ejemplos de cómo usarlo:

## 🔧 Importación en cualquier servicio

```typescript
import { Injectable } from '@nestjs/common';
import { AppConfigService } from 'src/app-data';

@Injectable()
export class MiServicio {
  constructor(
    private readonly appConfig: AppConfigService,
    // ... otros servicios
  ) {}

  async miMetodo() {
    // Usar las configuraciones...
  }
}
```

## 📝 Ejemplos de uso

### 1. Obtener configuraciones básicas

```typescript
// Obtener string con valor por defecto
const appName = await this.appConfig.getString('app_name', 'MenuCom Default');

// Obtener número
const maxItems = await this.appConfig.getNumber('max_items_per_page', 10);

// Obtener boolean
const maintenanceMode = await this.appConfig.getBoolean('maintenance_mode', false);

// Obtener array
const allowedDomains = await this.appConfig.getArray('allowed_domains', ['localhost']);

// Obtener objeto JSON
const settings = await this.appConfig.getObject('app_settings', {});
```

### 2. Manejo de errores y valores por defecto

```typescript
try {
  const config = await this.appConfig.get('mi_configuracion');
  console.log('Configuración encontrada:', config);
} catch (error) {
  console.log('Configuración no encontrada, usando valor por defecto');
}

// O más simple con valor por defecto
const config = await this.appConfig.get('mi_configuracion', 'valor_por_defecto');
```

### 3. Verificar si existe una configuración

```typescript
const exists = await this.appConfig.exists('feature_enabled');
if (exists) {
  const enabled = await this.appConfig.getBoolean('feature_enabled');
  // Hacer algo si la característica está habilitada
}
```

### 4. Obtener múltiples configuraciones

```typescript
const configs = await this.appConfig.getMultiple([
  'app_name',
  'max_items_per_page',
  'maintenance_mode'
]);

console.log('Todas las configuraciones:', configs);
// Resultado: { app_name: 'MenuCom', max_items_per_page: 20, maintenance_mode: false }
```

## 🎯 Ejemplos prácticos por módulo

### En MenuService

```typescript
@Injectable()
export class MenuService {
  constructor(
    private readonly appConfig: AppConfigService,
    // ... otros repositorios
  ) {}

  async getMenusWithPagination(page: number) {
    // Obtener configuración de paginación
    const itemsPerPage = await this.appConfig.getNumber('items_per_page', 10);
    const maxItems = await this.appConfig.getNumber('max_items_per_page', 50);
    
    const limit = Math.min(itemsPerPage, maxItems);
    const offset = (page - 1) * limit;
    
    return this.menuRepository.find({
      take: limit,
      skip: offset
    });
  }

  async createMenu(menuData: CreateMenuDto) {
    // Verificar si las imágenes están habilitadas
    const imagesEnabled = await this.appConfig.getBoolean('images_enabled', true);
    
    if (!imagesEnabled && menuData.imageUrl) {
      throw new BadRequestException('Las imágenes están deshabilitadas temporalmente');
    }
    
    // Continuar con la creación...
  }
}
```

### En PaymentsService

```typescript
@Injectable()
export class PaymentsService {
  constructor(
    private readonly appConfig: AppConfigService,
    // ... otros servicios
  ) {}

  async processPayment(paymentData: any) {
    // Obtener configuraciones de pago
    const paymentSettings = await this.appConfig.getObject('payment_settings', {
      currency: 'USD',
      tax_rate: 0.16,
      processing_fee: 2.50
    });
    
    const isTestMode = await this.appConfig.getBoolean('payment_test_mode', true);
    
    // Usar las configuraciones en el procesamiento...
  }
}
```

### En AuthService

```typescript
@Injectable()
export class AuthService {
  constructor(
    private readonly appConfig: AppConfigService,
    // ... otros servicios
  ) {}

  async validateLogin(credentials: any) {
    // Verificar si el login está habilitado
    const loginEnabled = await this.appConfig.getBoolean('login_enabled', true);
    
    if (!loginEnabled) {
      const maintenanceMessage = await this.appConfig.getString(
        'maintenance_message', 
        'Sistema en mantenimiento'
      );
      throw new ServiceUnavailableException(maintenanceMessage);
    }
    
    // Obtener configuraciones de seguridad
    const maxAttempts = await this.appConfig.getNumber('max_login_attempts', 5);
    const lockoutTime = await this.appConfig.getNumber('lockout_time_minutes', 15);
    
    // Continuar con la validación...
  }
}
```

## 🚀 Ventajas de usar AppConfigService

1. **Global**: Disponible en todos los módulos sin necesidad de importar el módulo
2. **Tipado**: Métodos específicos para cada tipo de dato
3. **Valores por defecto**: Manejo automático de configuraciones faltantes
4. **Logging**: Registro automático cuando se usan valores por defecto
5. **Performance**: Cache automático del servicio base
6. **Flexibilidad**: Manejo de múltiples configuraciones simultáneamente

## 🔄 Configuraciones dinámicas

Las configuraciones se obtienen en tiempo real desde la base de datos, por lo que cualquier cambio se refleja inmediatamente sin necesidad de reiniciar la aplicación.

```typescript
// Ejemplo de configuración dinámica
async checkMaintenanceMode() {
  const inMaintenance = await this.appConfig.getBoolean('maintenance_mode', false);
  
  if (inMaintenance) {
    const message = await this.appConfig.getString(
      'maintenance_message',
      'Sistema temporalmente no disponible'
    );
    throw new ServiceUnavailableException(message);
  }
}
```
