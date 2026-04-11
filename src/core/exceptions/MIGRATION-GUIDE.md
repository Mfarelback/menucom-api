# Guía de Migración de Excepciones

## Ejemplo: Migración de user.service.ts

### ANTES (Excepciones genéricas)

```typescript
// user.service.ts
import { HttpException, HttpStatus, NotFoundException, BadRequestException } from '@nestjs/common';

async findById(id: number): Promise<User> {
  const user = await this.userRepository.findOne({ where: { id } });
  if (!user) {
    throw new NotFoundException('Usuario no encontrado');
  }
  return user;
}

async create(createUserDto: CreateUserDto): Promise<User> {
  const existing = await this.findByEmail(createUserDto.email);
  if (existing) {
    throw new HttpException('Email ya registrado', HttpStatus.CONFLICT);
  }
  
  if (!this.isValidPhone(createUserDto.phone)) {
    throw new BadRequestException('Formato de teléfono inválido');
  }
  
  return this.userRepository.save(createUserDto);
}

async changePassword(userId: number, oldPassword: string, newPassword: string) {
  const user = await this.findById(userId);
  const isValid = await bcrypt.compare(oldPassword, user.password);
  
  if (!isValid) {
    throw new HttpException('Contraseña actual incorrecta', HttpStatus.BAD_REQUEST);
  }
  
  user.password = await bcrypt.hash(newPassword, 10);
  return this.userRepository.save(user);
}
```

### DESPUÉS (Excepciones personalizadas)

```typescript
// user.service.ts
import {
  UserNotFoundException,
  UserAlreadyExistsException,
  BusinessValidationException,
  InvalidPasswordChangeException,
} from 'src/core/exceptions';

async findById(id: number): Promise<User> {
  const user = await this.userRepository.findOne({ where: { id } });
  if (!user) {
    throw new UserNotFoundException(id); // ✅ Específica y con contexto
  }
  return user;
}

async create(createUserDto: CreateUserDto): Promise<User> {
  const existing = await this.findByEmail(createUserDto.email);
  if (existing) {
    throw new UserAlreadyExistsException(
      createUserDto.email,
      'email',
      { attemptedOperation: 'create' }  // ✅ Contexto adicional
    );
  }
  
  if (!this.isValidPhone(createUserDto.phone)) {
    throw new BusinessValidationException(
      'Formato de teléfono inválido',
      'INVALID_PHONE_FORMAT',
      { phone: createUserDto.phone, expectedFormat: '+54 9 XXX XXX XXXX' }
    );
  }
  
  return this.userRepository.save(createUserDto);
}

async changePassword(userId: number, oldPassword: string, newPassword: string) {
  const user = await this.findById(userId);
  const isValid = await bcrypt.compare(oldPassword, user.password);
  
  if (!isValid) {
    throw new InvalidPasswordChangeException(
      'La contraseña actual es incorrecta',
      { userId, attemptCount: await this.getFailedAttempts(userId) }
    );
  }
  
  user.password = await bcrypt.hash(newPassword, 10);
  return this.userRepository.save(user);
}
```

## Ejemplo: Migración de payments.service.ts

### ANTES

```typescript
// payments.service.ts
async processWebhook(paymentId: string) {
  try {
    const payment = await this.mercadoPago.getPayment(paymentId);
    if (!payment) {
      throw new NotFoundException('Pago no encontrado');
    }
    
    if (payment.status === 'rejected') {
      throw new BadRequestException('Pago rechazado');
    }
    
    return this.updatePaymentIntent(paymentId, payment.status);
  } catch (error) {
    console.error('Error en webhook:', error);
    throw new InternalServerErrorException('Error procesando webhook');
  }
}
```

### DESPUÉS

```typescript
// payments.service.ts
import {
  PaymentProcessingException,
  PaymentRejectedException,
  MercadoPagoException,
  ResourceNotFoundException,
} from 'src/core/exceptions';

async processWebhook(paymentId: string) {
  try {
    const payment = await this.mercadoPago.getPayment(paymentId);
    if (!payment) {
      throw new ResourceNotFoundException('Payment', paymentId);
    }
    
    if (payment.status === 'rejected') {
      throw new PaymentRejectedException(
        payment.status_detail,
        paymentId,
        {
          mpStatus: payment.status,
          mpStatusDetail: payment.status_detail,
          rejectionCode: payment.status_detail,
        }
      );
    }
    
    return this.updatePaymentIntent(paymentId, payment.status);
  } catch (error) {
    if (error instanceof BaseBusinessException) {
      throw error; // Re-lanzar excepciones de negocio
    }
    
    // Error de integración con MercadoPago
    throw new MercadoPagoException(
      'Error al consultar estado del pago',
      error.code,
      {
        paymentId,
        originalError: error.message,
        mpErrorType: error.type,
      }
    );
  }
}
```

## Ejemplo: Migración de orders.service.ts

### ANTES

```typescript
// orders.service.ts
async create(createOrderDto: CreateOrderDto) {
  if (!createOrderDto.items || createOrderDto.items.length === 0) {
    throw new BadRequestException('La orden debe tener items');
  }
  
  const total = this.calculateTotal(createOrderDto.items);
  if (total < 0) {
    throw new HttpException('Total inválido', 400);
  }
  
  try {
    return await this.orderRepository.save(createOrderDto);
  } catch (error) {
    throw new InternalServerErrorException('Error guardando orden');
  }
}
```

### DESPUÉS

```typescript
// orders.service.ts
import {
  InvalidOrderException,
  OrderCalculationException,
  OrderProcessingException,
} from 'src/core/exceptions';

async create(createOrderDto: CreateOrderDto) {
  if (!createOrderDto.items || createOrderDto.items.length === 0) {
    throw new InvalidOrderException(
      'La orden debe contener al menos un item',
      undefined,
      { itemCount: 0, operation: 'create' }
    );
  }
  
  const total = this.calculateTotal(createOrderDto.items);
  if (total < 0) {
    throw new OrderCalculationException(
      'Error en cálculo del total: resultado negativo',
      {
        calculatedTotal: total,
        items: createOrderDto.items.map(i => ({ id: i.id, price: i.price }))
      }
    );
  }
  
  try {
    return await this.orderRepository.save(createOrderDto);
  } catch (error) {
    throw new OrderProcessingException(
      'Error al guardar orden en base de datos',
      createOrderDto.id,
      {
        dbError: error.message,
        operation: 'save',
      }
    );
  }
}
```

## Checklist de Migración

### Por cada servicio:

- [ ] **Importar excepciones necesarias**
  ```typescript
  import { UserNotFoundException, ... } from 'src/core/exceptions';
  ```

- [ ] **Reemplazar `NotFoundException`**
  ```typescript
  // Antes
  throw new NotFoundException('X no encontrado');
  
  // Después
  throw new ResourceNotFoundException('X', id);
  // O usar excepciones específicas como UserNotFoundException
  ```

- [ ] **Reemplazar `BadRequestException`**
  ```typescript
  // Antes
  throw new BadRequestException('Datos inválidos');
  
  // Después
  throw new BusinessValidationException(
    'Descripción específica',
    'ERROR_CODE',
    { contexto }
  );
  ```

- [ ] **Reemplazar `UnauthorizedException`**
  ```typescript
  // Antes
  throw new UnauthorizedException('No autorizado');
  
  // Después
  throw new InvalidTokenException();
  // O InvalidCredentialsException, AuthenticationException, etc.
  ```

- [ ] **Reemplazar `HttpException` genéricas**
  ```typescript
  // Antes
  throw new HttpException('Error', 409);
  
  // Después
  throw new BusinessConflictException('Descripción específica', { contexto });
  ```

- [ ] **Agregar contexto útil**
  - IDs de recursos involucrados
  - Valores que causaron el error
  - Operación que se estaba realizando
  - Estado actual vs esperado

- [ ] **Preservar información en catch blocks**
  ```typescript
  } catch (error) {
    if (error instanceof BaseBusinessException) {
      throw error; // No wrappear excepciones de negocio
    }
    
    throw new SpecificException(
      'Mensaje descriptivo',
      id,
      { originalError: error.message }
    );
  }
  ```

## Beneficios de la Migración

### Antes
```json
// Respuesta genérica
{
  "statusCode": 404,
  "message": "Not Found"
}
```

### Después
```json
// Respuesta estructurada con contexto
{
  "statusCode": 404,
  "message": "Usuario con identificador '123' no encontrado",
  "errorCode": "USER_NOT_FOUND",
  "timestamp": "2025-11-02T10:30:00.000Z",
  "path": "/api/users/123",
  "context": {
    "identifier": "123"
  }
}
```

## Orden de Migración Recomendado

1. ✅ **Servicios críticos** (ya migrados)
   - user.service.ts
   - auth.service.ts
   - payments.service.ts

2. **Servicios de negocio**
   - orders.service.ts
   - catalog.service.ts
   - membership.service.ts

3. **Servicios auxiliares**
   - cloudinary.service.ts
   - notifications.service.ts
   - wardrobes.service.ts

4. **Controladores**
   - Actualizar documentación Swagger con ejemplos de errores
   - Agregar `@ApiResponse` decorators

## Testing

Actualizar tests para verificar excepciones específicas:

```typescript
// Antes
expect(() => service.findById(999)).rejects.toThrow(NotFoundException);

// Después
expect(() => service.findById(999)).rejects.toThrow(UserNotFoundException);

// O más específico
await expect(service.findById(999)).rejects.toMatchObject({
  message: expect.stringContaining('999'),
  errorCode: 'USER_NOT_FOUND',
  context: { identifier: 999 }
});
```
