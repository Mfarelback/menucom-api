# Sistema de Excepciones Personalizadas

## Descripción

Sistema robusto de manejo de excepciones que proporciona:
- ✅ Excepciones tipadas por dominio de negocio
- ✅ Códigos de error consistentes
- ✅ Contexto estructurado para debugging
- ✅ Sanitización automática de datos sensibles
- ✅ Logging integrado con LoggerService
- ✅ Respuestas HTTP estandarizadas

## Arquitectura

```
src/core/
├── exceptions/           # Excepciones personalizadas
│   ├── base.exception.ts        # Excepción base y comunes
│   ├── auth.exception.ts        # Autenticación
│   ├── user.exception.ts        # Usuarios
│   ├── payment.exception.ts     # Pagos
│   ├── order.exception.ts       # Órdenes
│   ├── membership.exception.ts  # Membresías
│   ├── catalog.exception.ts     # Catálogo
│   └── index.ts                 # Barrel export
└── interceptors/
    └── global-exception.filter.ts  # Filtro global de excepciones
```

## Uso Básico

### 1. Importar las Excepciones

```typescript
import {
  ResourceNotFoundException,
  BusinessValidationException,
  PaymentProcessingException,
  InvalidOrderException,
} from 'src/core/exceptions';
```

### 2. Lanzar Excepciones con Contexto

```typescript
// Ejemplo 1: Recurso no encontrado
const user = await this.userService.findById(userId);
if (!user) {
  throw new ResourceNotFoundException('Usuario', userId);
}

// Ejemplo 2: Validación de negocio
if (amount < 0) {
  throw new BusinessValidationException(
    'El monto no puede ser negativo',
    'INVALID_AMOUNT',
    { amount, field: 'total' }
  );
}

// Ejemplo 3: Error en procesamiento de pago
try {
  const payment = await this.mercadoPagoService.createPayment(data);
} catch (error) {
  throw new PaymentProcessingException(
    'Error al procesar pago con MercadoPago',
    paymentId,
    { mpError: error.message }
  );
}

// Ejemplo 4: Orden inválida
if (!order.items || order.items.length === 0) {
  throw new InvalidOrderException(
    'La orden debe tener al menos un item',
    order.id,
    { itemCount: 0 }
  );
}
```

## Catálogo de Excepciones

### Excepciones Base

#### `BaseBusinessException`
Clase abstracta base para todas las excepciones de negocio.

**Constructor:**
```typescript
constructor(
  message: string,
  statusCode: HttpStatus,
  errorCode?: string,
  context?: Record<string, any>
)
```

#### `BusinessValidationException`
Para errores de validación de reglas de negocio (400).

```typescript
throw new BusinessValidationException(
  'Stock insuficiente para completar la orden',
  'INSUFFICIENT_STOCK',
  { requested: 10, available: 5 }
);
```

#### `ResourceNotFoundException`
Para recursos no encontrados (404).

```typescript
throw new ResourceNotFoundException('Order', orderId);
// Mensaje: "Order con identificador '123' no encontrado"
```

#### `UnauthorizedOperationException`
Para operaciones no autorizadas (403).

```typescript
throw new UnauthorizedOperationException(
  'No tienes permisos para eliminar esta orden',
  { userId, orderId }
);
```

#### `BusinessConflictException`
Para conflictos de negocio (409).

```typescript
throw new BusinessConflictException(
  'Ya existe una orden activa para este usuario',
  { userId, existingOrderId }
);
```

### Excepciones de Autenticación

#### `AuthenticationException`
Error general de autenticación (401).

```typescript
throw new AuthenticationException(
  'Token de autenticación inválido',
  { tokenType: 'JWT' }
);
```

#### `InvalidTokenException`
Token inválido o expirado (401).

```typescript
throw new InvalidTokenException('Token expirado hace 2 horas');
```

#### `SocialLoginException`
Error en login social (401).

```typescript
throw new SocialLoginException(
  'Error al validar token de Firebase',
  'google',
  { firebaseError: error.code }
);
```

#### `InvalidCredentialsException`
Credenciales inválidas (401).

```typescript
throw new InvalidCredentialsException({ email });
```

#### `UnverifiedUserException`
Usuario no verificado (403).

```typescript
throw new UnverifiedUserException(
  'Debes verificar tu email antes de continuar',
  { email, userId }
);
```

### Excepciones de Usuario

#### `UserException`
Error general de usuario (400).

```typescript
throw new UserException('Formato de teléfono inválido');
```

#### `UserAlreadyExistsException`
Usuario duplicado (409).

```typescript
throw new UserAlreadyExistsException(email, 'email');
// Mensaje: "Usuario con email 'user@example.com' ya existe"
```

#### `UserNotFoundException`
Usuario no encontrado (404).

```typescript
throw new UserNotFoundException(userId);
// Mensaje: "Usuario '123' no encontrado"
```

#### `VerificationCodeException`
Error en códigos de verificación (400).

```typescript
throw new VerificationCodeException(
  'Código de verificación expirado',
  { codeId }
);
```

#### `InvalidPasswordChangeException`
Cambio de contraseña inválido (400).

```typescript
throw new InvalidPasswordChangeException(
  'La contraseña actual es incorrecta',
  { userId }
);
```

### Excepciones de Pago

#### `PaymentProcessingException`
Error al procesar pago (402 Payment Required).

```typescript
throw new PaymentProcessingException(
  'Error al crear preferencia de pago',
  paymentId,
  { orderId, mpError: error.message }
);
```

#### `MercadoPagoException`
Error de integración con MercadoPago (502 Bad Gateway).

```typescript
throw new MercadoPagoException(
  'API de MercadoPago no disponible',
  error.code,
  { statusCode: error.status }
);
```

#### `PaymentRejectedException`
Pago rechazado (402).

```typescript
throw new PaymentRejectedException(
  'Fondos insuficientes',
  paymentId,
  { mpStatus: 'rejected', mpDetail: error.detail }
);
```

#### `PaymentWebhookException`
Error en webhook de pago (422 Unprocessable Entity).

```typescript
throw new PaymentWebhookException(
  'Signature inválida en webhook',
  'payment.updated',
  { receivedSignature, expectedSignature }
);
```

#### `InsufficientBalanceException`
Saldo insuficiente (402).

```typescript
throw new InsufficientBalanceException(
  1500.00,
  500.00,
  { userId, accountId }
);
// Mensaje: "Saldo insuficiente. Requerido: 1500, Disponible: 500"
```

### Excepciones de Orden

#### `OrderCalculationException`
Error en cálculos de orden (400).

```typescript
throw new OrderCalculationException(
  'Error calculando marketplace fee',
  { subtotal, feePercentage }
);
```

#### `InvalidOrderException`
Orden inválida (400).

```typescript
throw new InvalidOrderException(
  'Items no pertenecen al mismo vendedor',
  orderId,
  { itemIds, sellerIds }
);
```

#### `OrderProcessingException`
Error procesando orden (422).

```typescript
throw new OrderProcessingException(
  'No se pudo crear la orden en el sistema de pagos',
  orderId,
  { paymentError: error.message }
);
```

#### `InvalidOrderStateTransitionException`
Transición de estado inválida (409).

```typescript
throw new InvalidOrderStateTransitionException(
  'completed',
  'pending',
  { orderId, reason: 'Cannot revert completed order to pending' }
);
// Mensaje: "Transición de estado inválida: de 'completed' a 'pending'"
```

#### `MarketplaceFeeException`
Error en marketplace fee (400).

```typescript
throw new MarketplaceFeeException(
  'Porcentaje de fee inválido',
  { feePercentage, maxAllowed: 30 }
);
```

### Excepciones de Membresía

#### `MembershipException`
Error general de membresía (400).

```typescript
throw new MembershipException(
  'Tipo de membresía no soportado',
  { requestedTier }
);
```

#### `InsufficientMembershipException`
Membresía insuficiente (403).

```typescript
throw new InsufficientMembershipException(
  'PREMIUM',
  'FREE',
  'advanced_analytics',
  { userId }
);
// Mensaje: "Se requiere membresía 'PREMIUM' para usar 'advanced_analytics'. Membresía actual: 'FREE'"
```

#### `MembershipLimitExceededException`
Límite de membresía excedido (403).

```typescript
throw new MembershipLimitExceededException(
  'monthly_orders',
  100,
  150,
  { userId, membershipTier: 'BASIC' }
);
// Mensaje: "Límite de 'monthly_orders' excedido. Máximo: 100, Actual: 150"
```

#### `SubscriptionException`
Error de suscripción (400).

```typescript
throw new SubscriptionException(
  'No se pudo actualizar la suscripción',
  { subscriptionId, mpError: error.message }
);
```

### Excepciones de Catálogo

#### `CatalogException`
Error general de catálogo (400).

```typescript
throw new CatalogException(
  'Formato de imagen no soportado',
  { fileName, allowedFormats: ['jpg', 'png'] }
);
```

#### `CatalogItemUnavailableException`
Item no disponible (409).

```typescript
throw new CatalogItemUnavailableException(
  itemId,
  'Item marcado como no disponible por el vendedor',
  { sellerId }
);
```

#### `InsufficientStockException`
Stock insuficiente (409).

```typescript
throw new InsufficientStockException(
  itemId,
  5,
  2,
  { itemName, sellerId }
);
// Mensaje: "Stock insuficiente para item 'item123'. Solicitado: 5, Disponible: 2"
```

#### `InvalidCategoryException`
Categoría inválida (400).

```typescript
throw new InvalidCategoryException(
  categoryId,
  { attemptedOperation: 'create_item' }
);
```

## Formato de Respuesta

### Excepciones de Negocio

```json
{
  "statusCode": 404,
  "message": "Usuario con identificador '123' no encontrado",
  "errorCode": "RESOURCE_NOT_FOUND",
  "timestamp": "2025-11-02T10:30:00.000Z",
  "path": "/api/users/123",
  "context": {
    "resourceType": "Usuario",
    "identifier": "123"
  }
}
```

### Errores 5xx (Producción)

```json
{
  "statusCode": 500,
  "message": "Error interno del servidor",
  "timestamp": "2025-11-02T10:30:00.000Z",
  "path": "/api/orders"
}
```

### Errores 5xx (Development)

```json
{
  "statusCode": 500,
  "message": "Cannot read property 'id' of undefined",
  "timestamp": "2025-11-02T10:30:00.000Z",
  "path": "/api/orders",
  "stack": [
    "TypeError: Cannot read property 'id' of undefined",
    "    at OrdersService.create (orders.service.ts:45:20)",
    "    at OrdersController.create (orders.controller.ts:23:15)",
    "..."
  ]
}
```

## Mejores Prácticas

### 1. Siempre Proporcionar Contexto

```typescript
// ❌ Mal - Sin contexto
throw new PaymentProcessingException('Error en pago');

// ✅ Bien - Con contexto útil
throw new PaymentProcessingException(
  'Error al crear preferencia de MercadoPago',
  paymentId,
  {
    orderId,
    userId,
    amount,
    mpErrorCode: error.code,
    mpErrorMessage: error.message
  }
);
```

### 2. Usar la Excepción Más Específica

```typescript
// ❌ Mal - Excepción genérica
throw new HttpException('Usuario no encontrado', 404);

// ✅ Bien - Excepción específica
throw new UserNotFoundException(userId);
```

### 3. No Exponer Datos Sensibles

```typescript
// ❌ Mal - Exponiendo datos sensibles
throw new AuthenticationException('Invalid token', {
  token: userToken,
  password: hashedPassword
});

// ✅ Bien - Sanitizado automáticamente
throw new InvalidTokenException('Token expirado', {
  tokenType: 'JWT',
  expiresAt: tokenExpiry,
  // password/token se eliminan automáticamente
});
```

### 4. Capturar y Re-lanzar con Contexto

```typescript
try {
  await this.externalService.call();
} catch (error) {
  // ❌ Mal - Perdiendo contexto original
  throw new Error('Failed');

  // ✅ Bien - Preservando contexto
  throw new PaymentProcessingException(
    'Error al comunicarse con servicio externo',
    paymentId,
    {
      originalError: error.message,
      service: 'MercadoPago',
      operation: 'createPreference'
    }
  );
}
```

## Integración con LoggerService

El `GlobalExceptionFilter` automáticamente:

1. **Registra errores según severidad:**
   - `5xx`: `logger.error()` con stack trace completo
   - `4xx`: `logger.warn()` con mensaje
   - Excepciones de negocio: `logger.warn()` con errorCode

2. **Sanitiza datos sensibles:**
   - Automático para `password`, `token`, `accessToken`, etc.
   - Contexto limpio tanto en logs como en respuestas

3. **Agrega contexto de request:**
   - URL, método HTTP, body, params, query
   - Solo para errores no controlados (500)

## Testing

```typescript
describe('OrdersService', () => {
  it('should throw InvalidOrderException for empty items', async () => {
    await expect(
      service.create({ items: [] })
    ).rejects.toThrow(InvalidOrderException);
  });

  it('should include proper context in exception', async () => {
    try {
      await service.create({ items: [] });
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidOrderException);
      expect(error.getResponse()).toMatchObject({
        errorCode: 'INVALID_ORDER',
        context: expect.objectContaining({
          reason: expect.any(String)
        })
      });
    }
  });
});
```

## Migración desde Excepciones Antiguas

### Antes
```typescript
throw new HttpException('Usuario no encontrado', HttpStatus.NOT_FOUND);
throw new BadRequestException('Datos inválidos');
throw new UnauthorizedException('Token inválido');
```

### Después
```typescript
throw new UserNotFoundException(userId);
throw new BusinessValidationException('Datos inválidos', 'INVALID_DATA', { field: 'email' });
throw new InvalidTokenException();
```

## Roadmap

- [ ] Agregar soporte para internacionalización (i18n)
- [ ] Crear decorador `@BusinessRule()` para validaciones complejas
- [ ] Integrar con sistema de métricas/APM
- [ ] Generar documentación OpenAPI automática con ejemplos de errores
