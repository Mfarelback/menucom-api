# 🔗 Integración OAuth2 de Mercado Pago

## 📋 **Configuración Requerida**

### 1. Variables de Entorno
Agrega estas variables a tu archivo `.env`:

```env
# OAuth de Mercado Pago
MERCADO_PAGO_CLIENT_ID=tu_client_id_aqui
MERCADO_PAGO_CLIENT_SECRET=tu_client_secret_aqui
MERCADO_PAGO_REDIRECT_URI=https://tudominio.com/oauth/callback

# O para desarrollo local:
# MERCADO_PAGO_REDIRECT_URI=http://localhost:3000/oauth/callback
```

### 2. Configuración en Mercado Pago Developers
1. Ve a [https://www.mercadopago.com/developers](https://www.mercadopago.com/developers)
2. Crea una aplicación
3. En la sección "OAuth", configura:
   - **Redirect URI**: `https://tudominio.com/oauth/callback`
   - **Scopes**: `read`, `write` (según necesites)

---

## 🚀 **Endpoints Disponibles**

### 1. **Iniciar Vinculación OAuth**
```bash
POST /payments/oauth/initiate
Authorization: Bearer {JWT_TOKEN}
Content-Type: application/json

{
  "redirectUri": "https://tuapp.com/oauth/callback",
  "state": "optional_security_state"
}
```

**Respuesta:**
```json
{
  "authorizationUrl": "https://auth.mercadopago.com/authorization?client_id=...",
  "state": "user_123_1629123456789",
  "vinculation_id": "user-uuid-123"
}
```

### 2. **Completar Vinculación**
```bash
POST /payments/oauth/callback
Content-Type: application/json

{
  "authorizationCode": "AUTH_CODE_FROM_MP",
  "redirectUri": "https://tuapp.com/oauth/callback",
  "vinculation_id": "user-uuid-123"
}
```

### 3. **Verificar Estado de Vinculación**
```bash
GET /payments/oauth/status
Authorization: Bearer {JWT_TOKEN}
```

**Respuesta:**
```json
{
  "isLinked": true,
  "account": {
    "id": "uuid",
    "collectorId": "123456789",
    "email": "vendor@example.com",
    "nickname": "VENDOR123",
    "country": "AR",
    "status": "active",
    "createdAt": "2025-08-21T10:30:00Z"
  }
}
```

### 4. **Desvincular Cuenta**
```bash
POST /payments/oauth/unlink
Authorization: Bearer {JWT_TOKEN}
```

### 5. **Refrescar Token**
```bash
POST /payments/oauth/refresh-token
Authorization: Bearer {JWT_TOKEN}
```

---

## 🔄 **Flujo de Integración**

### Frontend Flow (Recomendado)

```javascript
// 1. Iniciar OAuth
const initiateResponse = await fetch('/api/payments/oauth/initiate', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${userToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    redirectUri: 'https://tuapp.com/oauth/callback'
  })
});

const { authorizationUrl, vinculation_id } = await initiateResponse.json();

// 2. Guardar vinculation_id para usar en el callback
localStorage.setItem('oauth_vinculation_id', vinculation_id);

// 3. Redirigir al usuario a MP
window.location.href = authorizationUrl;

// 4. En tu callback page (después de que MP redirija de vuelta)
const urlParams = new URLSearchParams(window.location.search);
const code = urlParams.get('code');
const state = urlParams.get('state');
const vinculationId = localStorage.getItem('oauth_vinculation_id');

if (code && vinculationId) {
  // 5. Completar vinculación (SIN JWT en este endpoint)
  const linkResponse = await fetch('/api/payments/oauth/callback', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      authorizationCode: code,
      redirectUri: 'https://tuapp.com/oauth/callback',
      vinculation_id: vinculationId
    })
  });
  
  if (linkResponse.ok) {
    console.log('¡Cuenta vinculada exitosamente!');
    localStorage.removeItem('oauth_vinculation_id');
    // Redirigir al dashboard o mostrar confirmación
  }
}
```

---

## 🛠 **Uso Programático**

### En tus Servicios

```typescript
import { Injectable } from '@nestjs/common';
import { MercadoPagoOAuthService } from 'src/payments/services/mercado-pago-oauth.service';

@Injectable()
export class VendasService {
  constructor(
    private readonly mpOAuthService: MercadoPagoOAuthService,
  ) {}

  async createPaymentForVendor(vendorUserId: string, amount: number) {
    // Obtener token válido del vendedor
    const accessToken = await this.mpOAuthService.getValidAccessToken(vendorUserId);
    
    // Crear preferencia de pago usando el token del vendedor
    const preference = await this.createPaymentPreference(accessToken, amount);
    
    return preference;
  }

  async getVendorInfo(vendorUserId: string) {
    const account = await this.mpOAuthService.getUserMercadoPagoAccount(vendorUserId);
    
    if (!account) {
      throw new Error('Vendor has no linked Mercado Pago account');
    }
    
    return {
      collectorId: account.collectorId,
      email: account.email,
      nickname: account.nickname,
      isActive: account.isActive
    };
  }
}
```

---

## 🔍 **Verificación de Configuración**

### Comprobar Variables de Entorno
```bash
# Verificar que las variables estén configuradas
curl -X GET "http://localhost:3001/payments/oauth/status" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Estados de Respuesta
- **200**: Todo configurado correctamente
- **400**: OAuth not configured - Revisar variables de entorno
- **401**: Token JWT inválido
- **404**: Usuario no tiene cuenta vinculada

---

## 🔒 **Seguridad**

### Consideraciones Importantes

1. **Tokens Sensibles**: Los access tokens nunca se exponen en las APIs públicas
2. **Refresh Automático**: Los tokens se refrescan automáticamente cuando están por expirar
3. **Estado de Validación**: Usar el parámetro `state` para prevenir ataques CSRF
4. **HTTPS**: Siempre usar HTTPS en producción para las redirect URIs

### Estructura de la Base de Datos

```sql
-- La tabla mercado_pago_accounts almacena:
CREATE TABLE mercado_pago_accounts (
  id UUID PRIMARY KEY,
  user_id VARCHAR(255) UNIQUE,
  access_token VARCHAR(255),
  refresh_token VARCHAR(255),
  collector_id VARCHAR(255),
  public_key VARCHAR(255),
  country VARCHAR(100),
  email VARCHAR(255),
  nickname VARCHAR(255),
  status VARCHAR(50) DEFAULT 'active',
  token_expires_at TIMESTAMP,
  metadata JSON,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## 🧪 **Testing**

### Probar la Vinculación

1. **Sandbox de MP**: Usar cuenta de prueba de Mercado Pago
2. **Redirect URI**: Configurar `http://localhost:3000/oauth/callback` para desarrollo
3. **Logs**: Revisar logs del servidor para debugging

### Ejemplo de Test
```bash
# 1. Iniciar OAuth
curl -X POST "http://localhost:3001/payments/oauth/initiate" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "redirectUri": "http://localhost:3000/oauth/callback"
  }'

# 2. Copiar authorizationUrl y abrir en browser
# 3. Autorizar en MP y copiar el código del callback
# 4. Completar vinculación (SIN JWT en este endpoint)

curl -X POST "http://localhost:3001/payments/oauth/callback" \
  -H "Content-Type: application/json" \
  -d '{
    "authorizationCode": "CODIGO_DEL_CALLBACK",
    "redirectUri": "http://localhost:3000/oauth/callback",
    "vinculation_id": "USER_UUID_FROM_INITIATE"
  }'
```

---

## ✅ **Próximos Pasos**

1. ✅ **Configurar variables de entorno**
2. ✅ **Probar vinculación en sandbox**
3. 🔄 **Integrar en frontend**
4. 🔄 **Usar collector_id en pagos**
5. 🔄 **Implementar notificaciones de estado**

¡Ya tienes OAuth2 de Mercado Pago completamente integrado! 🎉
