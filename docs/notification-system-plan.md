# Plan de Implementación: Sistema de Notificaciones Automáticas Configurable

Este documento detalla la estrategia para integrar notificaciones push (FCM) de forma automática y configurable en los flujos principales del sistema (Órdenes, Pagos y Registro).

## 1. Objetivos
- **Automatización**: Disparar notificaciones sin intervención manual tras eventos clave.
- **Configurabilidad**: Permitir activar/desactivar y personalizar mensajes desde la base de datos.
- **Escalabilidad**: Usar una arquitectura orientada a eventos para no acoplar la lógica de negocio con las notificaciones.

## 2. Arquitectura Propuesta

### 2.1. Comunicación por Eventos
Se utilizará `@nestjs/event-emitter` para desacoplar los servicios. Los servicios de Órdenes, Pagos y Auth emitirán eventos, y un `NotificationListener` centralizado procesará el envío.

**Dependencia necesaria:**
```bash
npm install @nestjs/event-emitter
```

### 2.2. Modelo de Datos (Persistencia)
Se creará una nueva entidad `NotificationConfig` para persistir la configuración en la base de datos.

```typescript
// src/notifications/entities/notification-config.entity.ts
@Entity('notification_configs')
export class NotificationConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  event: string; // Ej: 'order.created', 'payment.success'

  @Column({ default: true })
  enabled: boolean;

  @Column()
  titleTemplate: string; // Ej: "¡Nueva Orden #{{orderId}}!"

  @Column('text')
  bodyTemplate: string; // Ej: "Hola {{name}}, recibimos tu pago de ${{amount}}."

  @Column({ nullable: true })
  targetRole: string; // 'CUSTOMER', 'OWNER', o 'ADMIN'
}
```

## 3. Flujo de Trabajo

### Paso 1: Configuración de Eventos
Definir un enumerado con los eventos del sistema:
- `USER_REGISTERED`: Bienvenida al usuario.
- `ORDER_CREATED`: Notificación al comercio (Owner).
- `ORDER_STATUS_CHANGED`: Notificación al cliente (Preparando, Enviado, etc).
- `PAYMENT_SUCCESS`: Confirmación de pago al cliente y comercio.
- `PAYMENT_FAILED`: Aviso de error en pago al cliente.

### Paso 2: Emisión de Eventos
Modificar los servicios existentes para emitir eventos tras operaciones exitosas:

- **OrdersService**: Emitir `order.created` y `order.status_changed`.
- **PaymentsService**: Emitir `payment.success` y `payment.failed`.
- **AuthService**: Emitir `user.registered`.

### Paso 3: Listener de Notificaciones
Crear un `NotificationEventListener` que:
1. Escuche los eventos.
2. Consulte la configuración en `NotificationConfig`.
3. Si el evento está activo, reemplace los *placeholders* (ej: `{{name}}`) por datos reales.
4. Llame a `NotificationsService.sendNotificationToUser`.

### Paso 4: Servicio de Configuración
Crear `NotificationConfigService` con métodos para:
- `updateConfig(eventId, dto)`: Para que el administrador cambie el texto o apague notificaciones.
- `initializeDefaults()`: Script para cargar las plantillas base en la base de datos si no existen.

## 4. Detalle de Notificaciones por Flujo

| Evento | Destinatario | Título (Ejemplo) | Cuerpo (Ejemplo) |
| :--- | :--- | :--- | :--- |
| **Registro** | Cliente | ¡Bienvenido a Menucom! | Hola {{name}}, gracias por unirte a nosotros. |
| **Nueva Orden** | Comercio | Nueva Orden Recibida | Tienes un nuevo pedido #{{orderId}} por ${{total}}. |
| **Pago Exitoso** | Cliente | Pago Confirmado | Tu pago para la orden #{{orderId}} fue procesado con éxito. |
| **Estado Orden** | Cliente | Tu pedido está en camino | La orden #{{orderId}} ha sido despachada. |

## 5. Próximos Pasos (Implementación)
1. Instalar `@nestjs/event-emitter`.
2. Crear la entidad `NotificationConfig` y su repositorio.
3. Implementar el `NotificationEventListener`.
4. Integrar la emisión de eventos en los servicios de negocio.
5. Crear endpoints para la gestión de las plantillas desde el dashboard.

---
**Nota**: Se utilizará el servicio de FCM ya existente (`NotificationsService`) para el envío técnico de los mensajes.
