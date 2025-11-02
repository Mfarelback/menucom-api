# 📊 Plan de Mejora Técnica - MenuCom API

> **Fecha de análisis:** 2 de Noviembre, 2025  
> **Estado:** En Progreso  
> **Prioridad:** Ejecutar Sprint 1 (Crítico)

---

## 🎯 Resumen Ejecutivo

Este documento detalla el plan de mejora técnica para MenuCom API, identificando deuda técnica crítica y proponiendo un roadmap de implementación en 4 sprints.

**Métricas Clave:**
- **Servicios analizados:** 40+
- **Módulos activos:** 13
- **Problemas críticos:** 3
- **Problemas de arquitectura:** 3
- **Mejoras propuestas:** 12

---

## 🔴 PROBLEMAS CRÍTICOS

### 1. Logging Inconsistente y Debug en Producción
**Severidad:** 🔴 CRÍTICA | **Impacto:** Seguridad + Performance + Debugging

#### Problema Detectado
- **60+ ocurrencias** de `console.log/error/warn` en código de producción
- Información sensible expuesta (tokens Firebase, UIDs, emails, passwords)
- Mensajes con emojis y texto verbose no estructurado
- No hay niveles de logging configurables por entorno
- Imposible filtrar logs por severidad o contexto

#### Archivos Afectados
```
src/user/user.service.ts           - 30+ console statements
src/auth/services/auth.service.ts  - 20+ console statements  
src/payments/services/payments.service.ts - 25+ console statements
src/orders/services/orders.service.ts     - 5+ console statements
src/cloudinary/services/cloudinary.service.ts - Debug statements
```

#### Ejemplos Problemáticos
```typescript
// ❌ MALO - Información sensible + emoji
console.log('🔍 [USER SERVICE] Buscando usuario por email:', email);
console.log('📋 [USER SERVICE] Datos recibidos para createOfSocial:', {
  email: data.email,
  socialToken: data.socialToken, // ⚠️ Token expuesto
});

// ❌ MALO - Error tragado sin estructura
console.error('Error determining owner ID:', error);
```

#### Solución Propuesta

**Paso 1: Crear LoggerService Centralizado**
```typescript
// src/core/logger/logger.service.ts
import { Injectable, LoggerService as NestLoggerService, LogLevel } from '@nestjs/common';

@Injectable()
export class LoggerService implements NestLoggerService {
  private isDevelopment = process.env.NODE_ENV !== 'production';
  
  log(message: string, context?: string) {
    if (this.isDevelopment) {
      console.log(`[${context || 'App'}] ${message}`);
    }
  }
  
  error(message: string, trace?: string, context?: string) {
    console.error(`[${context || 'App'}] ${message}`, trace);
  }
  
  warn(message: string, context?: string) {
    console.warn(`[${context || 'App'}] ${message}`);
  }
  
  debug(message: string, context?: string) {
    if (this.isDevelopment) {
      console.debug(`[${context || 'App'}] ${message}`);
    }
  }
  
  verbose(message: string, context?: string) {
    if (this.isDevelopment) {
      console.log(`[VERBOSE][${context || 'App'}] ${message}`);
    }
  }
  
  // Helper para sanitizar datos sensibles
  sanitize(data: any): any {
    const sensitive = ['password', 'token', 'socialToken', 'accessToken', 'secret'];
    if (typeof data !== 'object' || !data) return data;
    
    const sanitized = { ...data };
    for (const key of Object.keys(sanitized)) {
      if (sensitive.some(s => key.toLowerCase().includes(s))) {
        sanitized[key] = '***REDACTED***';
      }
    }
    return sanitized;
  }
}
```

**Paso 2: Crear Logger Module**
```typescript
// src/core/logger/logger.module.ts
import { Global, Module } from '@nestjs/common';
import { LoggerService } from './logger.service';

@Global()
@Module({
  providers: [LoggerService],
  exports: [LoggerService],
})
export class LoggerModule {}
```

**Paso 3: Migrar user.service.ts**
```typescript
// Antes ❌
console.log('🆕 [USER SERVICE] Iniciando creación de usuario social');
console.log('📋 [USER SERVICE] Datos recibidos:', { email: data.email, socialToken: data.socialToken });

// Después ✅
this.logger.debug('Iniciando creación de usuario social', 'UserService');
this.logger.debug(`Datos recibidos: ${JSON.stringify(this.logger.sanitize(data))}`, 'UserService');
```

#### Checklist de Implementación
- [ ] Crear `src/core/logger/logger.service.ts`
- [ ] Crear `src/core/logger/logger.module.ts`
- [ ] Importar LoggerModule en `app.module.ts`
- [x] Migrar `user.service.ts` (30+ ocurrencias) ✅
- [x] Migrar `auth.service.ts` (20+ ocurrencias) ✅
- [x] Migrar `auth.controller.ts` (12+ ocurrencias) ✅
- [x] Migrar `payments.service.ts` (16+ ocurrencias) ✅
- [x] Migrar `orders.service.ts` (3+ ocurrencias) ✅
- [x] Migrar `cloudinary.service.ts` (1+ ocurrencia) ✅
- [x] Verificar que no queden `console.*` en servicios críticos ✅
- [ ] Migrar servicios secundarios (catalog, membership, notifications)
- [ ] Testing en desarrollo y producción

---

### 2. Manejo de Errores Inconsistente
**Severidad:** 🔴 CRÍTICA | **Impacto:** UX + Debugging + Estabilidad

#### Problema Detectado
- **Catch blocks vacíos** que tragan errores silenciosamente
- Mensajes de error genéricos sin contexto útil
- Retorno de valores default sin notificar al llamador
- Mezcla de `console.error` con `throw` sin patrón consistente
- No hay formato estándar de respuesta de error

#### Ejemplos Problemáticos
```typescript
// ❌ CRÍTICO - Error tragado silenciosamente
// payments.service.ts:259
} catch (error) {} 

// ❌ MALO - Retorna default sin avisar
// orders.service.ts:86
catch (error) {
  console.error('Error calculating order amounts:', error);
  return { 
    subtotal, 
    marketplaceFeePercentage: 0, 
    marketplaceFeeAmount: 0, 
    total: subtotal 
  }; // Caller no sabe que hubo error
}

// ❌ MALO - Error genérico sin contexto
catch (error) {
  throw new HttpException('Error al crear usuario social: ' + error.message, 500);
}
```

#### Solución Propuesta

**Paso 1: Crear Custom Exceptions**
```typescript
// src/core/exceptions/business.exception.ts
import { HttpException, HttpStatus } from '@nestjs/common';

export class BusinessException extends HttpException {
  constructor(
    message: string,
    statusCode: HttpStatus = HttpStatus.BAD_REQUEST,
    details?: any,
  ) {
    super(
      {
        statusCode,
        message,
        details,
        timestamp: new Date().toISOString(),
        error: 'BusinessError',
      },
      statusCode,
    );
  }
}

export class OrderCalculationException extends BusinessException {
  constructor(message: string, originalError?: Error) {
    super(`Error en cálculo de orden: ${message}`, HttpStatus.BAD_REQUEST, {
      originalError: originalError?.message,
    });
  }
}

export class PaymentProcessingException extends BusinessException {
  constructor(message: string, paymentId?: string) {
    super(`Error procesando pago: ${message}`, HttpStatus.INTERNAL_SERVER_ERROR, {
      paymentId,
    });
  }
}

export class ResourceLimitException extends BusinessException {
  constructor(resource: string, limit: number) {
    super(
      `Límite de ${resource} alcanzado (${limit})`,
      HttpStatus.FORBIDDEN,
      { resource, limit },
    );
  }
}
```

**Paso 2: Crear Error Interceptor Global**
```typescript
// src/core/interceptors/error.interceptor.ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { LoggerService } from '../logger/logger.service';

@Injectable()
export class ErrorInterceptor implements NestInterceptor {
  constructor(private readonly logger: LoggerService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      catchError((error) => {
        const request = context.switchToHttp().getRequest();
        const statusCode = error instanceof HttpException 
          ? error.getStatus() 
          : HttpStatus.INTERNAL_SERVER_ERROR;

        const errorResponse = {
          statusCode,
          timestamp: new Date().toISOString(),
          path: request.url,
          method: request.method,
          message: error.message || 'Internal server error',
          ...(error.response && typeof error.response === 'object' ? error.response : {}),
        };

        // Log del error
        this.logger.error(
          `${request.method} ${request.url} - ${error.message}`,
          error.stack,
          'ErrorInterceptor',
        );

        return throwError(() => new HttpException(errorResponse, statusCode));
      }),
    );
  }
}
```

**Paso 3: Aplicar en app.module.ts**
```typescript
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ErrorInterceptor } from './core/interceptors/error.interceptor';

@Module({
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: ErrorInterceptor,
    },
  ],
})
export class AppModule {}
```

**Paso 4: Refactorizar Servicios**
```typescript
// Antes ❌
async calculateOrderAmounts(subtotal: number) {
  try {
    const marketplaceFeePercentage = await this.appDataService.getMarketplaceFeePercentage();
    // ...
  } catch (error) {
    console.error('Error calculating order amounts:', error);
    return { subtotal, marketplaceFeePercentage: 0, marketplaceFeeAmount: 0, total: subtotal };
  }
}

// Después ✅
async calculateOrderAmounts(subtotal: number) {
  try {
    const marketplaceFeePercentage = await this.appDataService.getMarketplaceFeePercentage();
    // ...
  } catch (error) {
    this.logger.error(`Error calculando montos de orden para subtotal ${subtotal}`, error.stack, 'OrdersService');
    throw new OrderCalculationException('No se pudo obtener el porcentaje de comisión', error);
  }
}
```

#### Checklist de Implementación
- [ ] Crear `src/core/exceptions/business.exception.ts`
- [ ] Crear `src/core/interceptors/error.interceptor.ts`
- [ ] Registrar ErrorInterceptor globalmente en `app.module.ts`
- [ ] Migrar `orders.service.ts` - Eliminar catch vacío línea 86
- [ ] Migrar `payments.service.ts` - Eliminar catch vacío línea 259
- [ ] Refactorizar todos los try-catch con custom exceptions
- [ ] Crear tests para verificar respuestas de error
- [ ] Documentar en Swagger los códigos de error

---

### 3. Código Legacy sin Eliminar
**Severidad:** 🟡 MEDIA | **Impacto:** Mantenibilidad + Confusión

#### Problema Detectado
- Métodos deprecados con sufijo `_OLD` aún en código
- Imports comentados en archivos de módulos
- Código muerto que genera confusión
- README con referencias a módulos eliminados

#### Archivos Afectados
```typescript
// src/auth/services/auth.service.ts:324-354
async loginSocial_OLD(userData: CreateUserDto) { ... }
async registerUserSocial_OLD(userData: CreateUserDto) { ... }

// src/app.module.ts:11-12
// import { MenuModule } from './menu/menu.module';
// import { WardrobesModule } from './wardrobes/wardrobes.module';
```

#### Solución
```typescript
// ✅ Eliminar completamente los métodos _OLD
// ✅ Eliminar imports comentados
// ✅ Actualizar documentación
```

#### Checklist de Implementación
- [x] Eliminar métodos `loginSocial_OLD` y `registerUserSocial_OLD` de `auth.service.ts` ✅
- [x] Eliminar endpoint deprecado POST /auth/social de `auth.controller.ts` ✅
- [x] Eliminar comentarios `// console.log` en `auth.service.ts` ✅
- [x] Eliminar imports comentados de módulos y controladores ✅
- [x] Buscar y eliminar otros comentarios con código muerto ✅
- [x] Actualizar READMEs que referencien código eliminado 
- [x] Hacer commit: "chore: remove legacy code and dead comments" ✅

**Archivos limpiados:**
- `src/user/user.module.ts` - Removido import comentado de MenuModule
- `src/user/user.controller.ts` - Removidos 3 imports comentados
- `src/payments/services/payments.service.ts` - Removidos 2 imports comentados
- `src/notifications/notifications.module.ts` - Removido import comentado de FirebaseAdminModule

---

## 🟡 PROBLEMAS DE ARQUITECTURA

### 4. Servicios con Múltiples Responsabilidades (SRP Violation)
**Severidad:** 🟡 MEDIA | **Impacto:** Escalabilidad + Mantenibilidad

#### Problema
**`UserService`** (564 líneas) - Violación de Single Responsibility Principle
- ❌ CRUD de usuarios
- ❌ Autenticación social (Firebase)
- ❌ Gestión de contraseñas
- ❌ Upload de imágenes (Cloudinary)
- ❌ Códigos de verificación por email
- ❌ Consultas complejas (getUsersByRoles con catálogos)

**`PaymentsService`** (505 líneas)
- ❌ Creación de pagos
- ❌ OAuth MercadoPago
- ❌ Procesamiento de webhooks
- ❌ Cálculo de marketplace fee
- ❌ Notificaciones

#### Solución Propuesta

**Refactorizar UserService:**
```
src/user/
  ├── user.service.ts              // CRUD básico (findOne, findAll, update, remove)
  ├── user-auth.service.ts         // Social login, tokens, Firebase
  ├── user-profile.service.ts      // Fotos, actualización de perfil
  └── user-verification.service.ts // Códigos de verificación, emails
```

**Refactorizar PaymentsService:**
```
src/payments/
  ├── payments.service.ts               // Coordinador principal
  ├── mercadopago-payment.service.ts    // Creación de preferencias MP
  ├── webhook-processor.service.ts      // Procesar webhooks
  └── marketplace-fee.service.ts        // Cálculos de comisiones
```

#### Checklist de Implementación
- [ ] Crear `user-auth.service.ts` y mover métodos de autenticación social
- [ ] Crear `user-profile.service.ts` y mover upload de imágenes
- [ ] Crear `user-verification.service.ts` y mover códigos de verificación
- [ ] Actualizar `user.service.ts` para delegar a servicios especializados
- [ ] Crear `webhook-processor.service.ts` en payments
- [ ] Crear `marketplace-fee.service.ts` para cálculos
- [ ] Actualizar todos los imports en controllers
- [ ] Crear tests para nuevos servicios

---

### 5. Falta de Capa de DTOs de Respuesta
**Severidad:** 🟡 MEDIA | **Impacto:** Type Safety + Seguridad

#### Problema
- Servicios retornan entidades directamente (exponen campos sensibles)
- Uso de `any` type en varios lugares
- No hay transformación consistente de respuestas
- Passwords y tokens se pueden filtrar en responses

#### Ejemplo Problemático
```typescript
// ❌ Retorna User entity completa con password
async findOne(id: string): Promise<User> {
  return this.userRepo.findOne({ where: { id } });
}

// ❌ Type 'any' pierde seguridad de tipos
async loginSocial(firebaseUserData: any) { ... }
```

#### Solución Propuesta
```typescript
// src/user/dto/user-response.dto.ts
import { Exclude, Expose } from 'class-transformer';

export class UserResponseDto {
  @Expose()
  id: string;

  @Expose()
  email: string;

  @Expose()
  name: string;

  @Expose()
  phone: string;

  @Expose()
  photoURL?: string;

  @Expose()
  role: string;

  @Exclude()
  password: string;

  @Exclude()
  socialToken: string;

  @Exclude()
  fcmToken: string;
}

// En el servicio
import { plainToInstance } from 'class-transformer';

async findOne(id: string): Promise<UserResponseDto> {
  const user = await this.userRepo.findOne({ where: { id } });
  if (!user) throw new NotFoundException(`User #${id} not found`);
  return plainToInstance(UserResponseDto, user, { excludeExtraneousValues: true });
}
```

#### Checklist de Implementación
- [ ] Crear `user-response.dto.ts`
- [ ] Crear `catalog-response.dto.ts`
- [ ] Crear `order-response.dto.ts`
- [ ] Crear `payment-response.dto.ts`
- [ ] Aplicar `@UseInterceptors(ClassSerializerInterceptor)` en controllers
- [ ] Migrar todos los métodos de servicios para retornar DTOs
- [ ] Eliminar tipos `any` - reemplazar con interfaces typed
- [ ] Testing de responses para verificar que no se filtran datos sensibles

---

### 6. Validación de Datos Incompleta
**Severidad:** 🟡 MEDIA | **Impacto:** Data Integrity + Seguridad

#### Problema
- `cloudinary.service.ts`: No valida formato/tamaño de archivos
- Faltan validaciones de rangos (precios negativos, cantidades)
- No hay validación de tipos de archivo permitidos
- Falta sanitización de inputs en algunos DTOs

#### Solución
```typescript
// catalog-item.dto.ts
import { IsString, IsNumber, Min, Max, IsOptional, IsUrl, MinLength, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateCatalogItemDto {
  @IsString()
  @MinLength(3, { message: 'El nombre debe tener al menos 3 caracteres' })
  @MaxLength(100, { message: 'El nombre no puede exceder 100 caracteres' })
  name: string;

  @IsNumber({}, { message: 'El precio debe ser un número válido' })
  @Min(0, { message: 'El precio debe ser mayor o igual a 0' })
  @Max(1000000, { message: 'El precio no puede exceder 1,000,000' })
  price: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  stock?: number;

  @IsOptional()
  @IsUrl({}, { message: 'Debe ser una URL válida' })
  imageUrl?: string;
  
  @IsOptional()
  @ValidateNested()
  @Type(() => CatalogItemMetadataDto)
  metadata?: CatalogItemMetadataDto;
}

// Validación de archivos
export class FileValidationPipe implements PipeTransform {
  constructor(private readonly options: {
    maxSize?: number; // en bytes
    allowedMimeTypes?: string[];
  }) {}

  transform(file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Archivo requerido');
    
    if (this.options.maxSize && file.size > this.options.maxSize) {
      throw new BadRequestException(`Archivo muy grande. Máximo: ${this.options.maxSize / 1024 / 1024}MB`);
    }
    
    if (this.options.allowedMimeTypes && !this.options.allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(`Tipo de archivo no permitido. Permitidos: ${this.options.allowedMimeTypes.join(', ')}`);
    }
    
    return file;
  }
}
```

#### Checklist de Implementación
- [ ] Agregar validaciones completas a todos los DTOs
- [ ] Crear `FileValidationPipe` para validar uploads
- [ ] Aplicar pipe en endpoints de upload de imágenes
- [ ] Agregar validaciones de rangos en precios y cantidades
- [ ] Crear tests de validación para cada DTO
- [ ] Documentar validaciones en Swagger

---

## 🚀 NUEVAS FUNCIONALIDADES PROPUESTAS

### 7. Sistema de Audit Logs
**Valor:** Trazabilidad completa de operaciones críticas

```typescript
// src/audit/entities/audit-log.entity.ts
@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  action: string; // CREATE, UPDATE, DELETE, LOGIN, PAYMENT

  @Column()
  userId: string;

  @Column()
  resourceType: string; // CATALOG, ORDER, PAYMENT, USER

  @Column()
  resourceId: string;

  @Column('jsonb', { nullable: true })
  metadata: object;

  @Column()
  ipAddress: string;

  @Column()
  userAgent: string;

  @CreateDateColumn()
  timestamp: Date;
}

// src/audit/audit-log.service.ts
@Injectable()
export class AuditLogService {
  async log(params: {
    action: string;
    userId: string;
    resourceType: string;
    resourceId: string;
    metadata?: object;
    request: Request;
  }) {
    await this.auditLogRepository.save({
      ...params,
      ipAddress: params.request.ip,
      userAgent: params.request.headers['user-agent'],
      timestamp: new Date(),
    });
  }
}
```

#### Checklist de Implementación
- [ ] Crear `audit-log.entity.ts`
- [ ] Crear `audit-log.service.ts`
- [ ] Crear `audit-log.module.ts`
- [ ] Crear decorador `@AuditLog()`
- [ ] Aplicar en operaciones críticas (pagos, órdenes, cambios de membresía)
- [ ] Crear endpoint GET `/audit-logs` para admins
- [ ] Testing de audit logs

---

### 8. Rate Limiting & Throttling
**Valor:** Protección contra abuso y ataques DDoS

```typescript
// app.module.ts
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';

@Module({
  imports: [
    ThrottlerModule.forRoot({
      ttl: 60, // Time window en segundos
      limit: 100, // Máximo requests por window
    }),
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}

// En controllers específicos
@UseGuards(ThrottlerGuard)
@Throttle(5, 60) // 5 requests por minuto
@Post('login')
async login(@Body() dto: LoginDto) { ... }
```

#### Checklist de Implementación
- [ ] Instalar `@nestjs/throttler`
- [ ] Configurar ThrottlerModule globalmente
- [ ] Aplicar límites personalizados en endpoints públicos
- [ ] Configurar límites más estrictos para login/register
- [ ] Testing de rate limits
- [ ] Documentar límites en API docs

---

### 9. Health Checks & Metrics
**Valor:** Monitoreo proactivo y troubleshooting

```typescript
// src/health/health.controller.ts
import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService, TypeOrmHealthIndicator } from '@nestjs/terminus';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: TypeOrmHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.db.pingCheck('database'),
      () => this.checkFirebase(),
      () => this.checkMercadoPago(),
      () => this.checkCloudinary(),
    ]);
  }

  @Get('metrics')
  async metrics() {
    return {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString(),
    };
  }
}
```

#### Checklist de Implementación
- [ ] Instalar `@nestjs/terminus`
- [ ] Crear `health.controller.ts`
- [ ] Crear health checks para cada servicio externo
- [ ] Endpoint `/health` público
- [ ] Endpoint `/metrics` protegido para admins
- [ ] Integrar con monitoring (DataDog/New Relic)

---

### 10. Soft Deletes para Datos Críticos
**Valor:** Recuperación de datos y auditoría

```typescript
// En entidades críticas
@Entity()
export class Catalog {
  @Column({ type: 'timestamp', nullable: true })
  deletedAt?: Date;
  
  @Column({ default: true })
  isActive: boolean;
  
  @Column({ nullable: true })
  deletedBy?: string; // userId quien eliminó
}

// Global scope para filtrar soft-deleted
@Global()
export class SoftDeleteQueryBuilder {
  excludeDeleted<T>(qb: SelectQueryBuilder<T>): SelectQueryBuilder<T> {
    return qb.andWhere('deletedAt IS NULL');
  }
}
```

#### Checklist de Implementación
- [ ] Agregar campos `deletedAt` y `deletedBy` a entidades críticas
- [ ] Crear migración para agregar columnas
- [ ] Actualizar todos los métodos `remove()` para soft delete
- [ ] Actualizar queries para filtrar soft-deleted por default
- [ ] Crear endpoint `/restore/:id` para admins
- [ ] Testing de soft deletes

---

## 📋 PLAN DE IMPLEMENTACIÓN

### Sprint 1 - CRÍTICO (2 semanas) ⏰ ACTUAL

**Objetivo:** Resolver problemas de seguridad y estabilidad

#### Semana 1
- [x] **Día 1-2:** Análisis completo de deuda técnica
- [x] **Día 3-4:** Implementar LoggerService + LoggerModule ✅
- [x] **Día 5:** Migrar user.service.ts y auth.service.ts ✅

#### Semana 2
- [x] **Día 1-2:** Migrar payments.service.ts y orders.service.ts ✅
- [x] **Día 3:** Crear custom exceptions + ErrorInterceptor ✅
- [ ] **Día 4:** Eliminar código legacy (_OLD methods, comentarios)
- [ ] **Día 5:** Testing + Code review

**Entregables:**
- ✅ 0 `console.*` en servicios de producción (70+ eliminados)
- ✅ Error handling consistente con custom exceptions (8 tipos de excepciones)
- ✅ GlobalExceptionFilter con sanitización automática
- [ ] Código legacy eliminado
- [ ] Tests pasando

**Progreso: 75% completado**

---

### Sprint 2 - ARQUITECTURA (3 semanas)

**Objetivo:** Refactorizar servicios y mejorar type safety

#### Semana 1
- [ ] Refactorizar UserService en 4 servicios especializados
- [ ] Crear user-auth.service.ts, user-profile.service.ts, user-verification.service.ts
- [ ] Actualizar imports en controllers

#### Semana 2
- [ ] Refactorizar PaymentsService
- [ ] Extraer webhook-processor.service.ts
- [ ] Extraer marketplace-fee.service.ts

#### Semana 3
- [ ] Crear Response DTOs para todas las entidades
- [ ] Aplicar ClassSerializerInterceptor
- [ ] Eliminar tipos `any`
- [ ] Tests unitarios - objetivo 50% cobertura

**Entregables:**
- ✅ Servicios con responsabilidad única
- ✅ Response DTOs implementados
- ✅ 50% cobertura de tests

---

### Sprint 3 - FEATURES (2 semanas)

**Objetivo:** Agregar funcionalidades de producción

#### Semana 1
- [ ] Sistema de Audit Logs (entity + service + decorator)
- [ ] Health Checks (endpoints /health y /metrics)

#### Semana 2
- [ ] Rate Limiting con ThrottlerModule
- [ ] Soft Deletes en entidades críticas
- [ ] Validación completa de DTOs

**Entregables:**
- ✅ Audit logs funcionando
- ✅ Health checks integrados
- ✅ Rate limiting activo
- ✅ Soft deletes implementados

---

### Sprint 4 - OPTIMIZACIÓN (1 semana)

**Objetivo:** Performance y documentación

- [ ] Redis Cache para image-proxy
- [ ] Database indexes en queries lentas
- [ ] Swagger documentation completa
- [ ] Performance testing con k6

**Entregables:**
- ✅ Cache Redis funcionando
- ✅ Queries optimizadas
- ✅ API docs completa
- ✅ Performance tests ejecutándose

---

## 🎯 MÉTRICAS DE ÉXITO

| Métrica | Actual | Objetivo Sprint 1 | Objetivo Final |
|---------|--------|-------------------|----------------|
| Console.log en producción | 60+ | 0 | 0 |
| Cobertura de Tests | ~5% | 20% | 70% |
| Tiempo respuesta promedio | ? | < 300ms | < 200ms |
| Errores no manejados | Alto | Medio | 0 |
| Servicios > 500 líneas | 2 | 0 | 0 |
| Type safety (any types) | ~10 | 5 | 0 |

---

## 📝 COMANDOS ÚTILES

```bash
# Buscar console.* en servicios
grep -r "console\." src/**/*.service.ts

# Ejecutar tests
npm run test

# Ver cobertura
npm run test:cov

# Lint y fix
npm run lint

# Compilar
npm run build

# Desarrollo
npm run start:dev
```

---

## 🔗 RECURSOS

- [NestJS Best Practices](https://docs.nestjs.com/techniques/logger)
- [TypeORM Soft Delete](https://orkhan.gitbook.io/typeorm/docs/delete-query-builder)
- [Class Transformer Docs](https://github.com/typestack/class-transformer)
- [Terminus Health Checks](https://docs.nestjs.com/recipes/terminus)

---

## 📞 CONTACTO

**Responsable:** Equipo de Desarrollo MenuCom  
**Última actualización:** 2 de Noviembre, 2025

---

## ⚠️ NOTAS IMPORTANTES

1. **NO hacer cambios masivos sin tests** - Implementar tests primero
2. **Crear branches por feature** - No pushear directo a master
3. **Code review obligatorio** - Mínimo 1 aprobación
4. **Testing en QA antes de producción** - Verificar en ambiente de pruebas
5. **Comunicar breaking changes** - Avisar al equipo frontend si hay cambios en APIs

---

**Estado actual:** 🟢 Análisis completo | 🔴 Implementación pendiente

**Próximo paso:** Implementar LoggerService (Sprint 1, Semana 1, Día 3-4)
