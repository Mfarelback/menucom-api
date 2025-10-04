# Notificaciones Push con Firebase Cloud Messaging (FCM)

## Índice
- [Descripción General](#descripción-general)
- [Arquitectura del Sistema](#arquitectura-del-sistema)
- [Flujo de Notificaciones](#flujo-de-notificaciones)
- [Implementación Backend](#implementación-backend)
- [Implementación Frontend](#implementación-frontend)
- [Ejemplos de Uso](#ejemplos-de-uso)
- [Testing con cURL](#testing-con-curl)
- [Troubleshooting](#troubleshooting)

---

## Descripción General

El sistema de notificaciones de MenuCom utiliza **Firebase Cloud Messaging (FCM)** para enviar notificaciones push a dispositivos móviles y web. Este módulo permite:

- ✅ Enviar notificaciones individuales a usuarios específicos
- ✅ Enviar notificaciones masivas a múltiples usuarios
- ✅ Incluir datos personalizados en las notificaciones
- ✅ Gestionar tokens FCM de dispositivos
- ✅ Logging detallado de eventos de notificación

---

## Arquitectura del Sistema

```
┌─────────────────┐
│   Frontend      │
│ (Flutter/Web)   │
└────────┬────────┘
         │ 1. Obtiene FCM Token
         │
         ▼
┌─────────────────────────────────┐
│     Backend API (NestJS)        │
│  ┌──────────────────────────┐   │
│  │  NotificationsService    │   │
│  │  - sendNotificationTo    │   │
│  │    User()                │   │
│  │  - sendNotificationTo    │   │
│  │    MultipleUsers()       │   │
│  └──────────┬───────────────┘   │
│             │                    │
│  ┌──────────▼───────────────┐   │
│  │   User Repository        │   │
│  │   (fcmToken storage)     │   │
│  └──────────────────────────┘   │
└─────────────┬───────────────────┘
              │ 2. Envía mensaje FCM
              ▼
┌─────────────────────────────────┐
│  Firebase Cloud Messaging       │
│  (Google Services)              │
└─────────────┬───────────────────┘
              │ 3. Push notification
              ▼
┌─────────────────────────────────┐
│   Dispositivo del Usuario       │
│   (Recibe notificación)         │
└─────────────────────────────────┘
```

---

## Flujo de Notificaciones

### 1. Registro de Token FCM

**Frontend → Backend**

```
Cliente obtiene token FCM
      ↓
Envía token al backend (PATCH /user/fcm-token)
      ↓
Backend guarda token en DB (campo user.fcmToken)
```

### 2. Envío de Notificación

**Backend → Firebase → Cliente**

```
Servicio llama NotificationsService.sendNotificationToUser()
      ↓
Backend consulta user.fcmToken de la DB
      ↓
Se construye mensaje FCM (title, body, data)
      ↓
Backend llama a Firebase Admin SDK
      ↓
Firebase distribuye notificación
      ↓
Dispositivo recibe y muestra notificación
```

### 3. Manejo de Errores

```
Token inválido/expirado
      ↓
Firebase retorna error
      ↓
Backend registra error en logs
      ↓
(Opcional) Backend marca token como inválido
```

---

## Implementación Backend

### Módulo de Notificaciones

**Archivo:** `src/notifications/notifications.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../user/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
```

### Servicio de Notificaciones

**Archivo:** `src/notifications/notifications.service.ts`

#### Métodos Principales

##### 1. `sendNotificationToUser()`

Envía una notificación a un usuario específico.

```typescript
async sendNotificationToUser(
  userId: string,
  title: string,
  body: string,
  data?: { [key: string]: string },
): Promise<boolean>
```

**Parámetros:**
- `userId`: ID del usuario destinatario
- `title`: Título de la notificación
- `body`: Cuerpo del mensaje
- `data`: Objeto con datos adicionales (opcional)

**Retorna:** `true` si se envió exitosamente, `false` si el usuario no tiene token FCM

**Ejemplo de uso:**
```typescript
await notificationsService.sendNotificationToUser(
  'user-123',
  'Nuevo pedido',
  'Tienes un nuevo pedido #4567',
  { 
    orderId: '4567', 
    type: 'NEW_ORDER',
    screen: 'OrderDetails' 
  }
);
```

##### 2. `sendNotificationToMultipleUsers()`

Envía notificaciones a múltiples usuarios simultáneamente.

```typescript
async sendNotificationToMultipleUsers(
  userIds: string[],
  title: string,
  body: string,
  data?: { [key: string]: string },
): Promise<admin.messaging.BatchResponse>
```

**Parámetros:**
- `userIds`: Array de IDs de usuarios
- `title`: Título de la notificación
- `body`: Cuerpo del mensaje
- `data`: Objeto con datos adicionales (opcional)

**Retorna:** Objeto `BatchResponse` con `successCount` y `failureCount`

**Ejemplo de uso:**
```typescript
const response = await notificationsService.sendNotificationToMultipleUsers(
  ['user-1', 'user-2', 'user-3'],
  '¡Oferta especial!',
  'Descuento del 20% en todos los platillos',
  { 
    promoId: 'promo-456',
    type: 'PROMOTION' 
  }
);

console.log(`Enviadas: ${response.successCount}, Fallidas: ${response.failureCount}`);
```

### Integración en Otros Módulos

Para usar el servicio de notificaciones en otros módulos:

```typescript
// En el módulo
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  // ...
})
export class OrdersModule {}

// En el servicio
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class OrdersService {
  constructor(
    private readonly notificationsService: NotificationsService,
  ) {}

  async createOrder(orderData: CreateOrderDto) {
    // Crear orden...
    const order = await this.ordersRepository.save(newOrder);
    
    // Notificar al restaurante
    await this.notificationsService.sendNotificationToUser(
      order.restaurantOwnerId,
      'Nuevo pedido recibido',
      `Pedido #${order.id} - ${order.items.length} items`,
      {
        orderId: order.id,
        type: 'NEW_ORDER',
        screen: 'OrderDetails',
      }
    );
    
    return order;
  }
}
```

---

## Implementación Frontend

### Configuración Inicial

#### 1. Instalación de Dependencias

**Flutter (Android/iOS):**
```yaml
# pubspec.yaml
dependencies:
  firebase_core: ^2.24.2
  firebase_messaging: ^14.7.10
```

**Web:**
```html
<!-- public/index.html -->
<script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging.js"></script>
```

#### 2. Inicialización de Firebase

**Flutter:**
```dart
// main.dart
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp();
  
  // Solicitar permisos (iOS)
  final messaging = FirebaseMessaging.instance;
  await messaging.requestPermission(
    alert: true,
    badge: true,
    sound: true,
  );
  
  runApp(MyApp());
}
```

**Web:**
```javascript
// firebase-config.js
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "menucom-xxxxx.firebaseapp.com",
  projectId: "menucom-xxxxx",
  storageBucket: "menucom-xxxxx.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();
```

### Obtención y Registro de Token FCM

#### Flutter

```dart
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';

class NotificationService {
  final FirebaseMessaging _messaging = FirebaseMessaging.instance;
  final String apiUrl = 'https://api.menucom.com';
  
  /// Obtiene el token FCM y lo registra en el backend
  Future<void> registerFCMToken(String userId, String authToken) async {
    try {
      // 1. Obtener token FCM
      final fcmToken = await _messaging.getToken();
      
      if (fcmToken == null) {
        print('No se pudo obtener el token FCM');
        return;
      }
      
      print('Token FCM obtenido: $fcmToken');
      
      // 2. Enviar token al backend
      final response = await http.patch(
        Uri.parse('$apiUrl/user/fcm-token'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $authToken',
        },
        body: jsonEncode({
          'fcmToken': fcmToken,
        }),
      );
      
      if (response.statusCode == 200) {
        print('Token FCM registrado exitosamente');
      } else {
        print('Error al registrar token: ${response.statusCode}');
      }
    } catch (e) {
      print('Error en registerFCMToken: $e');
    }
  }
  
  /// Configura los listeners de notificaciones
  void setupNotificationListeners() {
    // Notificación recibida cuando la app está en foreground
    FirebaseMessaging.onMessage.listen((RemoteMessage message) {
      print('Notificación recibida en foreground');
      print('Título: ${message.notification?.title}');
      print('Cuerpo: ${message.notification?.body}');
      print('Data: ${message.data}');
      
      // Mostrar diálogo/snackbar con la notificación
      _showNotificationDialog(message);
    });
    
    // Notificación tocada (app en background o terminada)
    FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
      print('Notificación tocada, abriendo app');
      _handleNotificationTap(message);
    });
    
    // Verificar si se abrió desde notificación (app terminada)
    _messaging.getInitialMessage().then((RemoteMessage? message) {
      if (message != null) {
        print('App abierta desde notificación');
        _handleNotificationTap(message);
      }
    });
  }
  
  void _showNotificationDialog(RemoteMessage message) {
    // Implementar UI para mostrar notificación
    // Ejemplo: SnackBar, Dialog, etc.
  }
  
  void _handleNotificationTap(RemoteMessage message) {
    // Navegar a pantalla específica según data
    final data = message.data;
    
    if (data['type'] == 'NEW_ORDER' && data['orderId'] != null) {
      // Navigator.push a OrderDetailsScreen
      print('Navegando a detalles de orden: ${data['orderId']}');
    } else if (data['type'] == 'PROMOTION') {
      // Navigator.push a PromotionScreen
      print('Navegando a promoción');
    }
  }
}
```

#### Web (JavaScript)

```javascript
// notification-service.js
class NotificationService {
  constructor(apiUrl, authToken) {
    this.apiUrl = apiUrl;
    this.authToken = authToken;
    this.messaging = firebase.messaging();
  }
  
  async registerFCMToken() {
    try {
      // 1. Solicitar permisos
      const permission = await Notification.requestPermission();
      
      if (permission !== 'granted') {
        console.log('Permiso de notificaciones denegado');
        return;
      }
      
      // 2. Obtener token FCM
      const fcmToken = await this.messaging.getToken({
        vapidKey: 'YOUR_VAPID_KEY' // Obtener de Firebase Console
      });
      
      console.log('Token FCM obtenido:', fcmToken);
      
      // 3. Enviar token al backend
      const response = await fetch(`${this.apiUrl}/user/fcm-token`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.authToken}`
        },
        body: JSON.stringify({ fcmToken })
      });
      
      if (response.ok) {
        console.log('Token FCM registrado exitosamente');
      } else {
        console.error('Error al registrar token:', response.status);
      }
    } catch (error) {
      console.error('Error en registerFCMToken:', error);
    }
  }
  
  setupNotificationListeners() {
    // Notificación recibida en foreground
    this.messaging.onMessage((payload) => {
      console.log('Notificación recibida:', payload);
      
      // Mostrar notificación personalizada
      this.showNotification(payload);
    });
  }
  
  showNotification(payload) {
    const { title, body } = payload.notification;
    const { data } = payload;
    
    // Crear notificación del navegador
    new Notification(title, {
      body: body,
      icon: '/logo.png',
      data: data
    });
  }
}

// Uso
const notifService = new NotificationService(
  'https://api.menucom.com',
  localStorage.getItem('authToken')
);

notifService.registerFCMToken();
notifService.setupNotificationListeners();
```

### Service Worker (Web - Background Notifications)

```javascript
// public/firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging.js');

firebase.initializeApp({
  apiKey: "YOUR_API_KEY",
  authDomain: "menucom-xxxxx.firebaseapp.com",
  projectId: "menucom-xxxxx",
  storageBucket: "menucom-xxxxx.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
});

const messaging = firebase.messaging();

// Manejo de notificaciones en background
messaging.onBackgroundMessage((payload) => {
  console.log('Notificación en background:', payload);
  
  const { title, body } = payload.notification;
  
  self.registration.showNotification(title, {
    body: body,
    icon: '/logo.png',
    badge: '/badge.png',
    data: payload.data
  });
});
```

---

## Ejemplos de Uso

### Caso 1: Notificación de Nuevo Pedido

```typescript
// orders.service.ts
async notifyNewOrder(order: Order) {
  const restaurant = await this.restaurantsService.findOne(order.restaurantId);
  
  await this.notificationsService.sendNotificationToUser(
    restaurant.ownerId,
    '🔔 Nuevo pedido recibido',
    `Pedido #${order.orderNumber} - Total: $${order.total}`,
    {
      type: 'NEW_ORDER',
      orderId: order.id,
      screen: 'OrderDetails',
      priority: 'high'
    }
  );
}
```

### Caso 2: Actualización de Estado de Pedido

```typescript
// orders.service.ts
async notifyOrderStatusChange(order: Order, newStatus: OrderStatus) {
  const statusMessages = {
    PREPARING: 'Tu pedido está siendo preparado 👨‍🍳',
    READY: '¡Tu pedido está listo! 🎉',
    DELIVERED: 'Tu pedido ha sido entregado ✅'
  };
  
  await this.notificationsService.sendNotificationToUser(
    order.customerId,
    'Actualización de pedido',
    statusMessages[newStatus],
    {
      type: 'ORDER_STATUS_UPDATE',
      orderId: order.id,
      status: newStatus,
      screen: 'OrderTracking'
    }
  );
}
```

### Caso 3: Promoción Masiva

```typescript
// promotions.service.ts
async sendPromotionNotification(promotion: Promotion) {
  const activeUsers = await this.usersService.findActiveUsers();
  const userIds = activeUsers.map(u => u.id);
  
  const response = await this.notificationsService.sendNotificationToMultipleUsers(
    userIds,
    '🎁 ¡Oferta Especial!',
    `${promotion.discount}% de descuento en ${promotion.category}`,
    {
      type: 'PROMOTION',
      promotionId: promotion.id,
      screen: 'Promotions'
    }
  );
  
  this.logger.log(`Promoción enviada: ${response.successCount} exitosas`);
}
```

---

## Testing con cURL

### 1. Registrar Token FCM

```bash
curl -X PATCH https://api.menucom.com/user/fcm-token \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "fcmToken": "fGxP9K8jRU-vXYZ123456789..."
  }'
```

**Respuesta esperada:**
```json
{
  "message": "Token FCM actualizado exitosamente",
  "user": {
    "id": "user-123",
    "email": "user@example.com",
    "fcmToken": "fGxP9K8jRU-vXYZ123456789..."
  }
}
```

### 2. Enviar Notificación de Prueba

Si tienes un endpoint dedicado para testing:

```bash
curl -X POST https://api.menucom.com/notifications/send-test \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "userId": "user-123",
    "title": "Notificación de prueba",
    "body": "Este es un mensaje de prueba desde cURL",
    "data": {
      "type": "TEST",
      "timestamp": "2025-10-04T12:00:00Z"
    }
  }'
```

### 3. Verificar Token FCM del Usuario

```bash
curl -X GET https://api.menucom.com/user/profile \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Respuesta esperada:**
```json
{
  "id": "user-123",
  "email": "user@example.com",
  "name": "John Doe",
  "fcmToken": "fGxP9K8jRU-vXYZ123456789...",
  "createdAt": "2025-01-15T10:30:00Z"
}
```

### 4. Eliminar Token FCM (Logout)

```bash
curl -X DELETE https://api.menucom.com/user/fcm-token \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## Troubleshooting

### Problema: Notificaciones no se reciben

**Diagnóstico:**

1. **Verificar token FCM en la base de datos:**
   ```sql
   SELECT id, email, fcmToken FROM users WHERE id = 'user-123';
   ```

2. **Revisar logs del backend:**
   ```bash
   # Buscar errores de Firebase en los logs
   grep "Error al enviar notificación" logs/app.log
   ```

3. **Verificar configuración de Firebase:**
   - Confirmar que `menucom-gconfig.json` está presente en la raíz del proyecto
   - Verificar que las credenciales de Firebase Admin SDK son válidas

**Soluciones comunes:**

- ✅ Token FCM expirado → Regenerar token en el frontend
- ✅ Permisos de notificación deshabilitados → Solicitar permisos nuevamente
- ✅ App no registrada en Firebase → Añadir en Firebase Console
- ✅ Credenciales de Firebase inválidas → Renovar `menucom-gconfig.json`

### Problema: Error "Requested entity was not found"

**Causa:** El token FCM no es válido o pertenece a otro proyecto.

**Solución:**
1. Verificar que el `projectId` en Firebase Admin coincide con el del cliente
2. Regenerar token FCM desde el frontend
3. Limpiar tokens antiguos de la DB

### Problema: Notificaciones solo funcionan en foreground

**Causa:** Service worker no configurado (Web) o permisos de background (Mobile).

**Solución Web:**
- Registrar `firebase-messaging-sw.js` correctamente
- Verificar que el service worker está activo en DevTools

**Solución Mobile:**
- Configurar manejador de background en `main.dart`:
  ```dart
  @pragma('vm:entry-point')
  Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
    await Firebase.initializeApp();
    print('Notificación en background: ${message.messageId}');
  }
  
  void main() async {
    FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);
    runApp(MyApp());
  }
  ```

### Problema: Rate limiting o throttling

**Síntoma:** Notificaciones no se envían después de muchas peticiones.

**Causa:** Firebase tiene límites de tasa para envíos masivos.

**Solución:**
- Implementar cola de notificaciones con procesamiento por lotes
- Usar tópicos de FCM para mensajes masivos
- Distribuir envíos en el tiempo

---

## Mejores Prácticas

### 1. Seguridad
- ✅ Nunca exponer tokens FCM en logs públicos
- ✅ Validar permisos antes de enviar notificaciones
- ✅ Limpiar tokens cuando el usuario cierra sesión

### 2. Performance
- ✅ Usar `sendMulticast()` para envíos masivos en lugar de loops
- ✅ Implementar caché de tokens para reducir consultas DB
- ✅ Procesar notificaciones en background jobs para operaciones pesadas

### 3. User Experience
- ✅ Permitir que usuarios configuren preferencias de notificaciones
- ✅ No abusar de notificaciones (evitar spam)
- ✅ Usar datos contextuales para navegación directa
- ✅ Personalizar mensajes según el usuario

### 4. Monitoreo
- ✅ Registrar métricas de envío (éxito/fallo)
- ✅ Alertar si la tasa de fallo supera un umbral
- ✅ Trackear engagement de notificaciones

---

## Referencias

- [Firebase Cloud Messaging Documentation](https://firebase.google.com/docs/cloud-messaging)
- [Firebase Admin SDK for Node.js](https://firebase.google.com/docs/admin/setup)
- [Flutter Firebase Messaging Package](https://pub.dev/packages/firebase_messaging)
- [Web Push Notifications](https://web.dev/push-notifications-overview/)

---

## Contacto y Soporte

Para preguntas o problemas con el sistema de notificaciones:
- 📧 Email: dev@menucom.com
- 📚 Documentación interna: `/docs/notifications`
- 🐛 Reportar bugs: GitHub Issues
