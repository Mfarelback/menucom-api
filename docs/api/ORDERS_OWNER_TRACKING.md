# Cambios en el Sistema de Órdenes - Owner Tracking

## Resumen de Cambios

Se ha implementado un sistema para rastrear el propietario (owner) del menú o wardrobe al cual pertenece cada orden. Esto permite que los comercios puedan ver las órdenes que han recibido.

## Nuevos Campos Agregados

### Entidad Order
- `ownerId` (string, nullable): ID del propietario del menú/wardrobe al que se le está comprando

### Entidad OrderItem
- `sourceId` (string, nullable): ID del menú o wardrobe del cual viene este item
- `sourceType` (string, nullable): Tipo de fuente: "menu" o "wardrobe"

## Nuevos DTOs

### CreateOrderDto
- `ownerId?` (string, opcional): ID del propietario (se puede determinar automáticamente)

### CreateOrderItemDto
- `sourceId?` (string, opcional): ID del menú o wardrobe
- `sourceType?` (string, opcional): "menu" o "wardrobe"

### OrderResponseDto
- DTO de respuesta que incluye el campo `ownerId`

## Nuevos Endpoints

### GET /orders/byBusinessOwner/:ownerId
Obtiene todas las órdenes recibidas por un propietario de negocio específico.

**Parámetros:**
- `ownerId` (path): ID del propietario del negocio

**Respuesta:** Array de órdenes con sus items relacionados, ordenadas por fecha de creación (más recientes primero).

## Funcionalidad Automática

### Determinación Automática del Owner ID
El sistema puede determinar automáticamente el `ownerId` basándose en los items de la orden:

1. Si se proporciona `ownerId` explícitamente en el DTO, se usa ese valor
2. Si no se proporciona, el sistema busca en los items que tengan `sourceId` y `sourceType` definidos
3. Consulta la base de datos (tabla Menu o Wardrobes) para obtener el `idOwner` correspondiente
4. Asigna ese valor como `ownerId` de la orden

## Nuevos Métodos de Servicio

### OrdersService.findByOwnerId(ownerId: string)
Busca todas las órdenes que pertenecen a un propietario específico.

### OrdersService.determineOwnerId(items: CreateOrderItemDto[])
Método privado que determina automáticamente el owner ID basándose en los items.

## Migración de Base de Datos

El proyecto usa TypeORM con `synchronize: true`, por lo que las nuevas columnas se crearán automáticamente al ejecutar la aplicación:

- `orders.ownerId` (varchar, nullable)
- `order_item.sourceId` (varchar, nullable)  
- `order_item.sourceType` (varchar, nullable)

## Ejemplos de Uso

### Crear una orden con owner automático
```json
POST /orders
{
  "customerEmail": "cliente@email.com",
  "total": 1500.00,
  "items": [
    {
      "productName": "Pizza Margherita",
      "quantity": 2,
      "price": 750.00,
      "sourceId": "menu-uuid-123",
      "sourceType": "menu"
    }
  ]
}
```

### Crear una orden con owner explícito
```json
POST /orders
{
  "customerEmail": "cliente@email.com",
  "ownerId": "owner-uuid-456",
  "total": 1500.00,
  "items": [
    {
      "productName": "Pizza Margherita", 
      "quantity": 2,
      "price": 750.00
    }
  ]
}
```

### Obtener órdenes de un negocio
```
GET /orders/byBusinessOwner/owner-uuid-456
```

## Beneficios

1. **Trazabilidad**: Cada orden ahora está vinculada al negocio que la recibió
2. **Dashboard de Negocio**: Los propietarios pueden ver todas sus órdenes
3. **Flexibilidad**: Se puede especificar el owner manualmente o determinarlo automáticamente
4. **Compatibilidad**: Los campos son opcionales, manteniendo compatibilidad con órdenes existentes
5. **Escalabilidad**: Soporte para múltiples tipos de fuentes (menús y wardrobes)

## Próximos Pasos

1. Actualizar el frontend para enviar `sourceId` y `sourceType` en los items
2. Implementar dashboard para propietarios de negocios
3. Agregar filtros adicionales (por fecha, estado, etc.)
4. Implementar notificaciones en tiempo real para nuevas órdenes
