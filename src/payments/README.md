# MercadoPago Service - Guía de Uso

Este documento describe cómo usar el servicio refactorizado de MercadoPago que ahora es más reutilizable y flexible.

## Servicios Disponibles

### 1. MercadopagoService (Servicio Base)
Proporciona métodos de bajo nivel para interactuar directamente con la API de MercadoPago.

### 2. MercadoPagoHelperService (Servicio Helper)
Proporciona métodos de conveniencia para casos de uso comunes.

### 3. PaymentsService (Servicio de Negocio)
Maneja la lógica de negocio específica de la aplicación.

## Ejemplos de Uso

### Uso Básico - Crear una Preferencia Simple

```typescript
import { MercadopagoService } from './services/mercado_pago.service';

// Inyectar el servicio
constructor(private readonly mercadoPagoService: MercadopagoService) {}

// Crear una preferencia simple
async createSimplePayment() {
  const items = [
    {
      title: 'Producto de prueba',
      description: 'Descripción del producto',
      quantity: 1,
      currency_id: 'ARS',
      unit_price: 100.50,
    }
  ];

  const payer = {
    name: 'Juan',
    surname: 'Pérez',
    email: 'juan.perez@email.com',
    phone: {
      number: '1234567890'
    },
    identification: {
      type: 'DNI',
      number: '12345678'
    }
  };

  const preferenceId = await this.mercadoPagoService.createSimplePreference(
    'order-123', // external_reference
    items,
    payer
  );

  return preferenceId;
}
```

### Uso Avanzado - Crear una Preferencia Completa

```typescript
async createAdvancedPayment() {
  const options = {
    items: [
      {
        title: 'Producto Premium',
        description: 'Producto con características premium',
        quantity: 2,
        currency_id: 'ARS',
        unit_price: 250.00,
        category_id: 'electronics'
      }
    ],
    external_reference: 'order-456',
    payer: {
      name: 'María',
      surname: 'González',
      first_name: 'María',    // Campo preferido por MP para mejor tasa de aprobación
      last_name: 'González',  // Campo preferido por MP para mejor tasa de aprobación
      email: 'maria.gonzalez@email.com',
      phone: {
        area_code: '11',
        number: '1234567890'
      },
      identification: {
        type: 'DNI',
        number: '87654321'
      },
      address: {
        street_name: 'Av. Corrientes',
        street_number: 1234,
        zip_code: '1043'
      }
    },
    back_urls: {
      success: 'https://miapp.com/success',
      failure: 'https://miapp.com/failure',
      pending: 'https://miapp.com/pending'
    },
    notification_url: 'https://miapp.com/webhooks/mercadopago',
    auto_return: 'approved',
    payment_methods: {
      excluded_payment_methods: [{ id: 'amex' }],
      excluded_payment_types: [{ id: 'ticket' }],
      installments: 12
    },
    statement_descriptor: 'MI TIENDA'
  };

  const preferenceId = await this.mercadoPagoService.createPreference(options);
  return preferenceId;
}
```

### Usando el Helper Service - E-commerce

```typescript
import { MercadoPagoHelperService } from './services/mercado-pago-helper.service';

constructor(private readonly mpHelper: MercadoPagoHelperService) {}

async createEcommerceOrder() {
  const orderData = {
    items: [
      {
        name: 'Smartphone',
        price: 50000,
        quantity: 1,
        description: 'Smartphone último modelo',
        category: 'electronics',
        imageUrl: 'https://example.com/smartphone.jpg'
      },
      {
        name: 'Funda protectora',
        price: 1500,
        quantity: 1,
        description: 'Funda de silicona'
      }
    ],
    externalReference: 'ecommerce-789',
    customer: {
      email: 'cliente@email.com',
      name: 'Carlos',
      surname: 'Rodríguez',
      phone: '1123456789',
      documentType: 'DNI',
      documentNumber: '11223344',
      address: {
        street: 'Av. Santa Fe',
        number: 1234,
        zipCode: '1425'
      }
    },
    shipping: {
      cost: 500,
      mode: 'custom'
    },
    paymentMethods: {
      excludedPaymentTypes: ['ticket'],
      maxInstallments: 6
    },
    backUrls: {
      success: 'https://mitienda.com/success',
      failure: 'https://mitienda.com/failure',
      pending: 'https://mitienda.com/pending'
    },
    notificationUrl: 'https://mitienda.com/webhooks/mp'
  };

  const preferenceId = await this.mpHelper.createEcommercePreference(orderData);
  return preferenceId;
}
```

### Verificar Estado de Pago

```typescript
async checkPaymentStatus(externalReference: string) {
  // Verificación simple
  const isApproved = await this.mpHelper.isPaymentApproved(externalReference);
  
  // Verificación detallada
  const paymentStatus = await this.mpHelper.getPaymentStatus(externalReference);
  
  console.log('Estado:', paymentStatus.status);
  console.log('Monto total:', paymentStatus.totalAmount);
  console.log('Monto aprobado:', paymentStatus.approvedAmount);
  console.log('Pagos:', paymentStatus.payments);
  
  return paymentStatus;
}
```

### Buscar Pagos con Criterios Específicos

```typescript
async searchPayments() {
  // Buscar por referencia externa
  const paymentsByRef = await this.mercadoPagoService.getPaymentsByExternalReference('order-123');
  
  // Buscar con múltiples criterios
  const searchOptions = {
    status: 'approved',
    operation_type: 'regular_payment',
    begin_date: '2024-01-01T00:00:00.000-04:00',
    end_date: '2024-12-31T23:59:59.000-04:00',
    limit: 50
  };
  
  const payments = await this.mercadoPagoService.searchPayments(searchOptions);
  return payments;
}
```

### Buscar Merchant Orders

```typescript
async searchMerchantOrders() {
  // Buscar por ID de preferencia
  const orders = await this.mercadoPagoService.getMerchantOrdersByPreferenceId('preference-id');
  
  // Buscar con criterios personalizados
  const searchOptions = {
    external_reference: 'order-123',
    site_id: 'MLA'
  };
  
  const customOrders = await this.mercadoPagoService.searchMerchantOrders(searchOptions);
  return customOrders;
}
```

## Configuración de Variables de Entorno

```env
# Requeridas
MP_ACCESS_TOKEN=your_mercadopago_access_token

# Opcionales (para URLs de retorno automáticas)
MP_BACK_URL=https://your-app.com
MP_CHECKOUT_PATH=/#/checkout/status

# Opcionales (para datos de pagador por defecto - mejora tasas de aprobación)
MP_TEST_PAYER_EMAIL=test_user@test.com
MP_TEST_PAYER_FIRST_NAME=Test
MP_TEST_PAYER_LAST_NAME=User
MP_STATEMENT_DESCRIPTOR=MI TIENDA
```

## Migración desde la Versión Anterior

Si estás usando el método anterior `createPreference(external_id: string)`, puedes migrar de las siguientes maneras:

### Opción 1: Usar el método de compatibilidad (temporal)
```typescript
// Esto seguirá funcionando pero está marcado como deprecated
const preferenceId = await this.mercadoPagoService.createPreferenceOld(external_id);
```

### Opción 2: Migrar al nuevo método (recomendado)
```typescript
// Antes
const preferenceId = await this.mercadoPagoService.createPreference(external_id);

// Después
const items = [
  {
    title: 'Tu producto/servicio',
    quantity: 1,
    currency_id: 'ARS',
    unit_price: amount
  }
];

const preferenceId = await this.mercadoPagoService.createSimplePreference(
  external_id,
  items
);
```

## Beneficios de la Nueva Implementación

1. **Flexibilidad**: Permite configurar todos los aspectos de una preferencia
2. **Reutilización**: Métodos que pueden usarse en diferentes contextos
3. **Validación**: Validación robusta de parámetros
4. **Logging**: Mejor logging para debugging
5. **Tipos**: Interfaces TypeScript para mejor desarrollo
6. **Helpers**: Métodos de conveniencia para casos comunes
7. **Compatibilidad**: Mantiene compatibilidad hacia atrás
8. **Configuración**: URLs y configuraciones más flexibles
9. **Mejor Aprobación**: Incluye automáticamente `first_name`, `last_name` y `statement_descriptor` para mejorar tasas de aprobación

## Campos para Mejorar Tasas de Aprobación

MercadoPago recomienda incluir los siguientes campos para reducir rechazos por el motor de prevención de fraude:

- **`payer.first_name`**: Nombre del comprador (preferido sobre `payer.name`)
- **`payer.last_name`**: Apellido del comprador (preferido sobre `payer.surname`)
- **`statement_descriptor`**: Descripción que aparece en el resumen de tarjeta (máximo 22 caracteres)

El servicio ahora incluye automáticamente estos campos con valores por defecto configurables via variables de entorno.

## Casos de Uso Comunes

- **E-commerce**: Usar `MercadoPagoHelperService.createEcommercePreference()`
- **Suscripciones**: Usar `MercadoPagoHelperService.createSubscriptionPreference()`
- **Producto único**: Usar `MercadoPagoHelperService.createSingleProductPreference()`
- **Múltiples productos**: Usar `MercadoPagoHelperService.createMultipleProductsPreference()`
- **Configuración avanzada**: Usar `MercadopagoService.createPreference()` directamente