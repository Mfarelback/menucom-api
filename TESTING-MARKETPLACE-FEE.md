# Guía de Testing para Marketplace Fee

## 1. Configuración Inicial del Marketplace Fee

### Paso 1: Configurar el porcentaje de comisión (requiere token de admin)
```bash
# POST /app-data/marketplace-fee
curl -X POST http://localhost:3000/app-data/marketplace-fee \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "percentage": 5.5
  }'
```

### Paso 2: Verificar la configuración (público)
```bash
# GET /app-data/marketplace-fee
curl -X GET http://localhost:3000/app-data/marketplace-fee
```

**Respuesta esperada:**
```json
{
  "percentage": 5.5
}
```

## 2. Testing de Creación de Órdenes

### Paso 1: Crear una orden con el marketplace fee aplicado
```bash
# POST /orders
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d '{
    "customerEmail": "test@example.com",
    "customerPhone": "1234567890",
    "total": 1000,
    "items": [
      {
        "name": "Producto Test",
        "price": 1000,
        "quantity": 1
      }
    ]
  }'
```

**Respuesta esperada (con 5.5% de comisión):**
```json
{
  "id": "uuid-order-123",
  "customerEmail": "test@example.com",
  "subtotal": 1000,
  "marketplaceFeePercentage": 5.5,
  "marketplaceFeeAmount": 55,
  "total": 1055,
  "status": "pending",
  "items": [...],
  "paymentUrl": "https://mercadopago.com/checkout/..."
}
```

## 3. Casos de Prueba

### Caso 1: Sin comisión configurada (0%)
```bash
curl -X POST http://localhost:3000/app-data/marketplace-fee \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{"percentage": 0}'
```

### Caso 2: Comisión moderada (5%)
```bash
curl -X POST http://localhost:3000/app-data/marketplace-fee \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{"percentage": 5}'
```

### Caso 3: Comisión alta (15.75%)
```bash
curl -X POST http://localhost:3000/app-data/marketplace-fee \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{"percentage": 15.75}'
```

## 4. Validaciones que se deben probar

### Validaciones exitosas:
- ✅ `percentage: 0` (sin comisión)
- ✅ `percentage: 5.5` (comisión decimal)
- ✅ `percentage: 100` (comisión máxima)

### Validaciones que deben fallar:
- ❌ `percentage: -1` (número negativo)
- ❌ `percentage: 101` (mayor a 100)
- ❌ `percentage: "texto"` (no es número)
- ❌ Sin token de admin en POST

## 5. Verificación en Base de Datos

El registro en la tabla `app_data` debería verse así:

```sql
SELECT * FROM app_data WHERE key = 'marketplace_fee_percentage';
```

**Resultado esperado:**
```
id              | key                      | value | dataType | description                                    | isActive
uuid-123-456    | marketplace_fee_percentage| 5.5   | number   | Porcentaje de comisión del marketplace por...  | true
```
