# Gestión Dinámica de Marketplace Fee por Comercio

## 1. Introducción
Este documento describe el mecanismo para aplicar comisiones (fees) personalizadas a diferentes comercios o tenants dentro de la plataforma Menucom. Actualmente, el sistema cuenta con un fee global, pero se requiere flexibilidad para ajustar el porcentaje según acuerdos comerciales individuales.

## 2. Niveles de Aplicación de Fee
Para garantizar flexibilidad y escalabilidad, el sistema resolverá el porcentaje de comisión siguiendo este orden de prioridad:

1.  **Fee por Comercio (Nivel 1)**: Porcentaje específico definido en la configuración del comercio/tenant.
2.  **Fee por Tipo de Membresía (Nivel 2)**: Porcentaje predefinido para planes PREMIUM, ENTERPRISE, etc.
3.  **Fee Global (Nivel 3)**: Porcentaje por defecto configurado en `AppData` (clave `MARKETPLACE_FEE_PERCENTAGE`).

## 3. Modelo de Datos Propuesto

### 3.1. Extensión de Configuración de Tenant/User
Se recomienda crear una tabla de configuración por comercio o extender la entidad de perfil del comercio:

```typescript
// MerchantConfig.entity.ts
@Entity()
export class MerchantConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  tenantId: string; // O relación con User (OWNER)

  @Column('decimal', { precision: 5, scale: 2, nullable: true })
  customMarketplaceFee: number; // Ej: 2.50 para 2.5%

  @Column({ default: true })
  isActive: boolean;
}
```

## 4. Lógica de Negocio (Fee Resolver)

El `PaymentService` debe utilizar un "Fee Resolver" para determinar el monto a cobrar en cada transacción:

```typescript
async resolveMarketplaceFee(tenantId: string): Promise<number> {
  // 1. Buscar fee personalizado
  const customConfig = await this.merchantConfigRepo.findOne({ where: { tenantId } });
  if (customConfig?.customMarketplaceFee !== null) {
    return customConfig.customMarketplaceFee;
  }

  // 2. Buscar fee por membresía (opcional)
  const user = await this.userService.findByTenantId(tenantId);
  if (user.membership?.plan === 'ENTERPRISE') return 3.0;
  if (user.membership?.plan === 'PREMIUM') return 5.0;

  // 3. Retornar fee global
  return this.appDataService.getNumber('MARKETPLACE_FEE_PERCENTAGE') || 7.0;
}
```

## 5. Integración con Mercado Pago (Direct Charge)

En el modelo de **Cobro Directo**, el comprador paga directamente al organizador, y Menucom recibe su comisión en el momento de la transacción utilizando el campo `application_fee` en la creación de la preferencia.

### 5.1. Ejemplo de Creación de Preferencia
```typescript
const preference = {
  items: [...],
  marketplace_fee: calculatedFeeAmount, // Monto calculado basado en el porcentaje resuelto
  external_reference: ticketPurchaseId,
  notification_url: webhookUrl,
  // ...
};
```

> [!IMPORTANT]
> Para que el Cobro Directo funcione, el organizador **debe** haber vinculado su cuenta de Mercado Pago mediante el flujo de OAuth existente en la plataforma.

## 6. Auditoría y Transparencia
Cada `TicketPurchase` o `PaymentIntent` debe registrar:
-   `appliedFeePercentage`: El porcentaje resuelto en el momento de la compra.
-   `feeAmount`: El monto exacto en moneda local que recibió la plataforma.
-   `netAmount`: El monto neto que recibió el organizador.

---

# 📦 IMPLEMENTACIÓN REALIZADA

> **Nota para desarrolladores futuros**: Esta sección documenta lo que ya está implementado. Úsala como referencia para continuar el desarrollo o hacer modificaciones.

## 7. Estructura de Archivos Implementados

### 7.1. Servicio Principal - Fee Resolver
**Archivo**: `src/payments/services/marketplace-fee-resolver.service.ts`

Servicio completo que implementa la jerarquía de 3 niveles para resolver el fee:

```typescript
// Métodos principales:
- resolveFeePercentage(tenantId: string): Promise<FeeResolutionResult>
- calculateFee(totalAmount: number, tenantId: string): Promise<FeeCalculationResult>
- setCustomFee(tenantId: string, feePercentage: number): Promise<MerchantConfig>
- getMerchantConfig(tenantId: string): Promise<MerchantConfig | null>
- disableCustomFee(tenantId: string): Promise<void>
```

**Tarifas por membresía definidas**:
```typescript
MEMBERSHIP_FEE_RATES = {
  'ENTERPRISE': 3.0,   // 3% para plan Enterprise
  'PREMIUM': 5.0,      // 5% para plan Premium  
  'FREE': 7.0,         // 7% para plan Free
}
```

**Valor por defecto**: 5.0% si ningún fee está configurado.

### 7.2. Entidad MerchantConfig
**Archivo**: `src/payments/entities/merchant-config.entity.ts`

```typescript
@Entity('merchant_configs')
class MerchantConfig {
  id: string;           // UUID
  tenantId: string;     // ID del tenant (único)
  customMarketplaceFee: number;  // Decimal(5,2) - ej: 2.50 para 2.5%
  isActive: boolean;    // Default: true
  createdAt: Date;
  updatedAt: Date;
}
```

### 7.3. Migración de Base de Datos
**Archivo**: `src/scripts/migrations/005_add_merchant_config_and_net_amount.sql`

La migración crea:
1. Tabla `merchant_configs` con índices en `tenantId` e `isActive`
2. Columna `netAmount` en tabla `ticket_purchases`
3. Índices para consultas de reporting

### 7.4. DTOs
**Archivo**: `src/app-data/dtos/marketplace-fee.dto.ts`

```typescript
SetMarketplaceFeeDto {
  percentage: number;  // 0-100, máx 2 decimales
}

MarketplaceFeeResponseDto {
  percentage: number;
}
```

## 8. Integración con EventPaymentService

**Archivo**: `src/events/services/event-payment.service.ts`

El servicio ya utiliza el FeeResolver en el método `createTicketPreference()`:

```typescript
// Líneas 64-67: Calcular fee dinámico
const feeCalculation = await this.feeResolver.calculateFee(
  savedPurchase.totalAmount,
  tenantId,
);

// Línea 107: Pasar el fee a MercadoPago
marketplace_fee: feeCalculation.feeAmount,

// Líneas 117-119: Guardar datos del fee en el TicketPurchase
savedPurchase.appliedFeePercentage = feeCalculation.feePercentage;
savedPurchase.feeAmount = feeCalculation.feeAmount;
savedPurchase.netAmount = feeCalculation.netAmount;
```

## 9. Endpoints de API Disponibles

### 9.1. Fee Global (AppData)
**Controlador**: `src/app-data/controllers/app-data.controller.ts`

```
GET  /app-data/marketplace-fee     -> Obtiene el fee global configurado
POST /app-data/marketplace-fee     -> Configura el fee global (body: { percentage: number })
```

**Respuesta GET**:
```json
{
  "percentage": 5.5
}
```

**Body POST**:
```json
{
  "percentage": 5.5
}
```

> Nota: Requiere autenticación. El fee global se guarda en la tabla `app_data` con key = `marketplace_fee_percentage`.

## 10. Flujo de Datos en una Compra

```
1. Usuario crea preferencia de pago
   ↓
2. EventPaymentService llama a feeResolver.calculateFee(totalAmount, tenantId)
   ↓
3. FeeResolver aplica jerarquía:
   a. Busca customMarketplaceFee en merchant_configs para ese tenantId
   b. Si no existe, busca membresía del usuario y aplica tarifa según plan
   c. Si no tiene membresía, usa fee global de app_data
   d. Si no hay nada configurado, usa 5% por defecto
   ↓
4. Se calcula: feeAmount = (totalAmount * percentage) / 100
   ↓
5. Se crea preferencia en MercadoPago con marketplace_fee
   ↓
6. Se guarda en TicketPurchase:
   - appliedFeePercentage (el % usado)
   - feeAmount (monto de la comisión)
   - netAmount (total - feeAmount)
```

## 11. Scripts de Testing

**PowerShell**: `scripts/test-marketplace-fee.ps1`
**Bash**: `scripts/test-marketplace-fee.sh`

Ambos scripts ejecutan el flujo completo:
1. Obtener fee actual
2. Configurar fee al 5.5%
3. Verificar configuración
4. Probar valores inválidos
5. Limpiar (opcional)

## 12. Próximos Pasos / TODO

Si necesitas continuar el desarrollo:

### 12.1. Endpoints para Admin (Fee Personalizado por Tenant)
```
POST   /admin/merchants/:tenantId/fee     -> Configurar fee personalizado
GET    /admin/merchants/:tenantId/fee     -> Ver fee resuelto para un tenant
DELETE /admin/merchants/:tenantId/fee     -> Desactivar fee personalizado
GET    /admin/merchants/:tenantId/config  -> Ver configuración completa
```

**Implementación**: Usar los métodos ya existentes en `MarketplaceFeeResolverService`:
- `setCustomFee(tenantId, percentage)`
- `getMerchantConfig(tenantId)`
- `disableCustomFee(tenantId)`

### 12.2. Endpoint para el Organizador Ver su Fee
```
GET /merchants/me/fee -> Ver el fee que le aplica actualmente
```

Usar: `feeResolver.resolveFeePercentage(currentUser.tenantId)`

### 12.3. Reportes de Ingresos
Extender queries en `TicketPurchaseRepository` para incluir:
- Total de fees recolectados por período
- Net amount pagado a organizadores
- Breakdown por tipo de fee (custom/membership/global)

### 12.4. Webhook de Cambio de Membresía
Cuando un usuario cambia de plan, el fee debe actualizarse automáticamente para futuras compras (no requiere cambios, el resolver lo calcula dinámicamente).

## 13. Configuración de Variables de Entorno

```bash
# Webhook para notificaciones de tickets
MP_TICKET_NOTIFICATION_URL=https://api.menucom.com/webhooks/tickets

# O usa el genérico
MP_NOTIFICATION_URL=https://api.menucom.com/webhooks/mercadopago
```

## 14. Notas Técnicas Importantes

1. **El fee se aplica en el momento de la compra**: Si cambias el fee global, solo afecta a compras NUEVAS, no a las pendientes.

2. **Precisión decimal**: Los cálculos usan `toFixed(2)` para redondear a 2 decimales.

3. **Índices de BD**: La tabla `merchant_configs` tiene índices en `tenantId` e `isActive` para consultas rápidas.

4. **Relación con User**: El resolver busca el usuario por `tenantId` (asumiendo que el tenant es un usuario OWNER/EVENT_ORGANIZER) para obtener su membresía.

5. **Columna netAmount**: Fue agregada a `ticket_purchases` para auditoría. El valor es: `totalAmount - feeAmount`.

## 15. Testing Manual Rápido

```bash
# 1. Configurar fee global al 7%
curl -X POST http://localhost:3000/app-data/marketplace-fee \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"percentage": 7.0}'

# 2. Verificar configuración
curl http://localhost:3000/app-data/marketplace-fee \
  -H "Authorization: Bearer <token>"

# 3. Crear una compra de ticket y verificar en BD:
#    - ticket_purchases.appliedFeePercentage = 7.0
#    - ticket_purchases.feeAmount = (total * 0.07)
#    - ticket_purchases.netAmount = total - feeAmount
```

---
**Última actualización**: Implementación completada y documentada para referencia futura.
