# 🧮 Casos de Prueba para Marketplace Fee

## Casos de Configuración Válidos

### 1. Sin comisión (0%)
```json
POST /app-data/marketplace-fee
{
  "percentage": 0
}
```
**Resultado:** Órdenes sin comisión adicional

### 2. Comisión baja (2.5%)
```json
{
  "percentage": 2.5
}
```
**Orden $1000 → Subtotal: $1000, Fee: $25, Total: $1025**

### 3. Comisión estándar (5.5%)
```json
{
  "percentage": 5.5
}
```
**Orden $1000 → Subtotal: $1000, Fee: $55, Total: $1055**

### 4. Comisión alta (15%)
```json
{
  "percentage": 15
}
```
**Orden $1000 → Subtotal: $1000, Fee: $150, Total: $1150**

### 5. Comisión con decimales (7.75%)
```json
{
  "percentage": 7.75
}
```
**Orden $1000 → Subtotal: $1000, Fee: $77.50, Total: $1077.50**

## Casos de Validación (deben fallar)

### 1. Porcentaje negativo
```json
{
  "percentage": -1
}
```
**Error esperado:** 400 - "El porcentaje no puede ser menor a 0"

### 2. Porcentaje mayor a 100
```json
{
  "percentage": 101
}
```
**Error esperado:** 400 - "El porcentaje no puede ser mayor a 100"

### 3. Sin token de admin
```bash
POST /app-data/marketplace-fee (sin Authorization header)
```
**Error esperado:** 401 o 403 - Sin permisos

### 4. Valor no numérico
```json
{
  "percentage": "texto"
}
```
**Error esperado:** 400 - Validation error

## Ejemplos de Cálculo

| Subtotal | Fee % | Fee Amount | Total |
|----------|-------|------------|-------|
| $100     | 0%    | $0         | $100  |
| $100     | 5%    | $5         | $105  |
| $250     | 3.5%  | $8.75      | $258.75 |
| $1000    | 7.25% | $72.50     | $1072.50 |
| $99.99   | 2.5%  | $2.50      | $102.49 |

## Verificación en Base de Datos

```sql
-- Ver configuración actual
SELECT * FROM app_data WHERE key = 'marketplace_fee_percentage';

-- Ver órdenes recientes con comisiones
SELECT 
  id,
  subtotal,
  marketplaceFeePercentage,
  marketplaceFeeAmount,
  total,
  createdAt
FROM orders 
ORDER BY createdAt DESC 
LIMIT 10;
```

## Testing con diferentes montos

### Montos pequeños
- $10 con 5% = Total: $10.50
- $1.99 con 3% = Total: $2.05

### Montos grandes  
- $10,000 con 2% = Total: $10,200
- $50,000 con 1.5% = Total: $50,750

### Montos decimales
- $123.45 con 4.5% = Fee: $5.56, Total: $129.01
- $999.99 con 6.25% = Fee: $62.50, Total: $1062.49
