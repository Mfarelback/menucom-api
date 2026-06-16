# Code Review: Manejo de Notificaciones con Firebase FCM

**Fecha**: 2026-05-02  
**Alcance**: NotificationsModule, FirebaseAdmin, FCM Token Management

---

## 📁 Archivos Analizados

| Archivo | Propósito |
|---------|-----------|
| `src/notifications/notifications.service.ts` | Lógica de envío de notificaciones FCM |
| `src/notifications/notifications.module.ts` | Configuración del módulo |
| `src/auth/firebase-admin.ts` | Inicialización de Firebase Admin SDK |
| `src/user/dto/update-fcm-token.dto.ts` | DTO para actualizar token FCM |

---

## ✅ Aspectos Positivos

### 1. Estructura Modular
- El `NotificationsModule` está bien estructurado y sigue el patrón de NestJS.
- Exporta solo el servicio necesario, manteniendo una buena encapsulación.

### 2. TypeORM Integration
- Uso correcto de `@InjectRepository` para inyección del repositorio de usuarios.
- Consultas adecuadas para buscar usuarios y sus tokens FCM.

### 3. Manejo de Mensajes Multicast
- Implementación de `sendEachForMulticast` para envío a múltiples usuarios.
- Retorno de `BatchResponse` que incluye contadores de éxito/fallo.

### 4. Validación Básica de FCM Token
- El DTO `UpdateFcmTokenDto` usa `class-validator` con `@IsString()` y `@IsNotEmpty()`.

---

## ⚠️ Problemas Identificados

### Críticos

#### 1. Firebase Admin como Static Class (Anti-pattern en NestJS)
**Archivo**: `src/auth/firebase-admin.ts`

```typescript
// ❌ Problema: Clase estática con métodos estáticos
export class FirebaseAdmin {
  private static instance: admin.app.App;
  
  static initialize(configService: ConfigService): admin.app.App { ... }
  static getInstance(): admin.app.App { ... }
}
```

**Problema**: No aprovecha el sistema de inyección de dependencias de NestJS. Dificulta testing y puede causar problemas de estado global.

**Recomendación**: Convertir a un proveedor inyectable con `@Injectable()`.

#### 2. Falta de Verificación de Inicialización de Firebase
**Archivo**: `src/notifications/notifications.service.ts`

```typescript
// ❌ Firebase Admin se usa sin verificar si está inicializado
const response = await admin.messaging().send(message);
```

**Problema**: Si Firebase no está inicializado, `admin.messaging()` lanzará un error no controlado.

**Recomendación**: Verificar inicialización antes de usar FCM.

#### 3. Sin Manejo de Tokens FCM Inválidos
**Archivo**: `src/notifications/notifications.service.ts` (línea 91)

```typescript
const response = await admin.messaging().sendEachForMulticast(message);
```

**Problema**: Cuando un token FCM es inválido o expirado, la respuesta indica el fallo pero no se hace nada al respecto. Los tokens inválidos deberían eliminarse de la base de datos.

**Recomendación**: Procesar `response.responses` para identificar tokens fallidos y limpiarlos.

#### 4. Sin Reintentos (Retry Logic)
**Problema**: Si el envío falla por problemas de red o rate limiting de FCM, no hay reintentos automáticos.

**Recomendación**: Implementar lógica de reintento con backoff exponencial.

### Moderados

#### 5. No Se Validan los Datos de Notificación
**Archivo**: `src/notifications/notifications.service.ts` (línea 23)

```typescript
data?: { [key: string]: string }
```

**Problema**: El tipo `any` implícito y falta validación de que las claves/valores no contengan información sensible.

#### 6. Falta de Batching para Grandes Volúmenes
**Problema**: `sendEachForMulticast` tiene un límite de 500 tokens por llamada. Si `userIds` contiene más de 500 usuarios, fallará.

**Recomendación**: Implementar chunking de tokens en grupos de 500.

#### 7. DTO con Validación Insuficiente
**Archivo**: `src/user/dto/update-fcm-token.dto.ts`

```typescript
@IsString()
@IsNotEmpty()
fcmToken: string;
```

**Problema**: No valida el formato de un token FCM (que tiene una estructura específica).

**Recomendación**: Agregar `@Matches()` o validación personalizada para verificar formato.

#### 8. Exposición de Detalles Internos de FCM
**Archivo**: `src/notifications/notifications.service.ts` (línea 65)

```typescript
async sendNotificationToMultipleUsers(...): Promise<admin.messaging.BatchResponse>
```

**Problema**: Exponer el tipo de Firebase directamente en la interfaz pública acopla el servicio a Firebase.

**Recomendación**: Crear un DTO de respuesta propio.

### Menores

#### 9. Logs con Información Sensible
**Archivo**: `src/notifications/notifications.service.ts` (línea 46)

```typescript
this.logger.log(`Notificación enviada exitosamente al usuario ${userId}: ${response}`);
```

**Problema**: Se logea la respuesta completa de FCM, que puede contener información sensible.

#### 10. Configuración de Firebase con Ruta Hardcodeada
**Archivo**: `src/auth/firebase-admin.ts` (línea 14)

```typescript
const configPath = path.join(process.cwd(), 'menucom-gconfig.json');
```

**Problema**: Ruta relativa al directorio de trabajo, puede fallar dependiendo de desde dónde se ejecute la aplicación.

---

## 🔧 Recomendaciones de Mejora

### 1. Refactorizar FirebaseAdmin a un Proveedor Injectable

```typescript
@Injectable()
export class FirebaseAdminService {
  private app: admin.app.App | null = null;

  constructor(private configService: ConfigService) {}

  initialize(): admin.app.App {
    // ... lógica de inicialización existente
  }

  getApp(): admin.app.App {
    if (!this.app) {
      throw new Error('Firebase not initialized');
    }
    return this.app;
  }

  verifyIdToken(idToken: string) {
    return this.getApp().auth().verifyIdToken(idToken);
  }
}
```

### 2. Agregar Limpieza de Tokens Inválidos

```typescript
async sendNotificationToMultipleUsers(...) {
  // ... envío de notificación
  
  // Limpiar tokens fallidos
  if (response.failureCount > 0) {
    const failedTokens = fcmTokens.filter((_, index) => 
      !response.responses[index].success
    );
    
    // Eliminar tokens inválidos de la base de datos
    await this.cleanupFailedTokens(failedTokens, response);
  }
}
```

### 3. Implementar Batching para Múltiples Usuarios

```typescript
const CHUNK_SIZE = 500;
const chunks = [];
for (let i = 0; i < fcmTokens.length; i += CHUNK_SIZE) {
  chunks.push(fcmTokens.slice(i, i + CHUNK_SIZE));
}

const results = await Promise.all(
  chunks.map(tokens => 
    admin.messaging().sendEachForMulticast({ ...message, tokens })
  )
);
```

### 4. Validación de Formato de Token FCM

```typescript
import { Matches } from 'class-validator';

export class UpdateFcmTokenDto {
  @Matches(/^[a-zA-Z0-9:_-]{140,200}$/, {
    message: 'Invalid FCM token format',
  })
  fcmToken: string;
}
```

### 5. Verificar Inicialización en NotificationsService

```typescript
async sendNotificationToUser(...) {
  try {
    // Verificar que Firebase esté inicializado
    if (!FirebaseAdmin.instance) {
      throw new InternalServerErrorException('Firebase not configured');
    }
    
    const user = await this.userRepository.findOne(...);
    // ... resto del código
  }
}
```

---

## 📊 Métricas de Calidad

| Criterio | Puntuación | Notas |
|----------|------------|-------|
| Arquitectura | 6/10 | FirebaseAdmin como static class es anti-pattern |
| Manejo de Errores | 5/10 | No maneja tokens inválidos ni reintentos |
| Validación | 4/10 | Validación insuficiente de tokens FCM |
| Mantenibilidad | 7/10 | Código claro pero acoplado a Firebase |
| Testabilidad | 4/10 | Dificultado por métodos estáticos |

**Puntuación General**: 5.2/10

---

## 🎯 Prioridades de Acción

1. **ALTA**: Refactorizar `FirebaseAdmin` a un proveedor injectable
2. **ALTA**: Implementar limpieza de tokens FCM inválidos
3. **MEDIA**: Agregar batching para >500 tokens
4. **MEDIA**: Mejorar validación de tokens FCM
5. **BAJA**: Mejorar logs y ocultar datos sensibles

---

## 📝 Conclusión

El manejo actual de notificaciones FCM es funcional pero tiene problemas arquitectónicos importantes. El uso de Firebase Admin como clase estática y la falta de manejo de tokens inválidos son los problemas más críticos que deben resolverse para una implementación robusta en producción.
