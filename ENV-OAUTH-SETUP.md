# 🔧 Variables de Entorno para OAuth2

## Configuración Requerida

Agrega estas variables a tu archivo `.env`:

```env
# =============================================================================
# 🔗 OAUTH2 - MERCADO PAGO
# =============================================================================
# Cliente ID de tu aplicación en MercadoPago Developers
MERCADO_PAGO_CLIENT_ID=APP_USR-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

# Cliente Secret de tu aplicación en MercadoPago Developers  
MERCADO_PAGO_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# URL donde MP redirigirá después de la autorización
# Para desarrollo local:
MERCADO_PAGO_REDIRECT_URI=http://localhost:3000/oauth/callback

# Para producción:
# MERCADO_PAGO_REDIRECT_URI=https://tudominio.com/oauth/callback

# =============================================================================
# 🔐 OTRAS CONFIGURACIONES OAUTH (Opcional)
# =============================================================================
# Tiempo en minutos antes de expirar para refrescar token automáticamente
OAUTH_REFRESH_THRESHOLD_MINUTES=60

# Horas de duración por defecto de tokens
OAUTH_DEFAULT_EXPIRATION_HOURS=6
```

## ¿Cómo Obtener las Credenciales?

### 1. Ve a MercadoPago Developers
- URL: https://www.mercadopago.com/developers
- Inicia sesión con tu cuenta de MercadoPago

### 2. Crea una Aplicación
1. Haz click en "Crear aplicación"
2. Selecciona "Marketplace" como tipo de integración
3. Completa el formulario con los datos de tu aplicación

### 3. Configura OAuth
1. Ve a la sección "OAuth" de tu aplicación
2. Agrega estas Redirect URIs:
   - `http://localhost:3000/oauth/callback` (desarrollo)
   - `https://tudominio.com/oauth/callback` (producción)
3. Copia el CLIENT_ID y CLIENT_SECRET

### 4. Configura Scopes
Selecciona los permisos que necesitas:
- ✅ `read` - Leer información de la cuenta
- ✅ `write` - Crear pagos y preferencas
- ✅ `offline_access` - Acceso sin usuario presente

## 🧪 Testing

### Sandbox vs Producción

```env
# Para testing (Sandbox)
MERCADO_PAGO_CLIENT_ID=TEST-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
MERCADO_PAGO_CLIENT_SECRET=TEST-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Para producción
MERCADO_PAGO_CLIENT_ID=APP_USR-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
MERCADO_PAGO_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Cuentas de Prueba

1. Ve a: https://www.mercadopago.com/developers/tools/test-users
2. Crea usuarios de prueba (vendedor y comprador)
3. Usa las credenciales de prueba para testing

## ✅ Validación

Una vez configurado, puedes verificar que todo esté bien:

```bash
# Verificar configuración OAuth
curl -X GET "http://localhost:3001/payments/oauth/status" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Respuesta esperada si está bien configurado:**
```json
{
  "isLinked": false,
  "message": "No MercadoPago account linked"
}
```

**Si hay error de configuración:**
```json
{
  "statusCode": 400,
  "message": "OAuth not configured. Missing CLIENT_ID or CLIENT_SECRET"
}
```

## 🚨 Troubleshooting

### Error: "OAuth not configured"
- ✅ Verifica que `MERCADO_PAGO_CLIENT_ID` esté en el .env
- ✅ Verifica que `MERCADO_PAGO_CLIENT_SECRET` esté en el .env
- ✅ Reinicia el servidor después de agregar las variables

### Error: "Invalid redirect_uri"
- ✅ Verifica que la `MERCADO_PAGO_REDIRECT_URI` coincida con la configurada en MP Developers
- ✅ Para desarrollo local usa `http://localhost:3000/oauth/callback`
- ✅ Para producción usa `https://` (obligatorio HTTPS)

### Error de CORS
- ✅ Configura CORS en tu frontend para el dominio de MercadoPago
- ✅ Agrega `https://auth.mercadopago.com` a los dominios permitidos
