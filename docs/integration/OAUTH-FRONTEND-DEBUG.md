# 🔍 Debug OAuth Frontend - Paso a Paso

## 🚨 **Problema Identificado**

Según los logs:
```
OAuth callback received: {
  hasAuthCode: false,           ❌ No está llegando
  authCodeLength: undefined,    ❌ No está llegando  
  redirectUri: undefined,       ❌ No está llegando
  vinculationId: 'f6894e2e-...' ✅ Está llegando
}
```

**El frontend solo está enviando `vinculation_id` pero no `authorizationCode` ni `redirectUri`**

---

## 🔧 **Implementación Frontend Correcta**

### 1. **Página de Inicio OAuth** (`/oauth-start`)

```html
<!DOCTYPE html>
<html>
<head>
    <title>Vincular Cuenta MercadoPago</title>
</head>
<body>
    <h1>Vincular Cuenta de MercadoPago</h1>
    <button onclick="iniciarOAuth()">Conectar MercadoPago</button>
    
    <script>
        const JWT_TOKEN = 'tu_jwt_token_aqui'; // Obtener del login
        
        async function iniciarOAuth() {
            try {
                const response = await fetch('/api/payments/oauth/initiate', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${JWT_TOKEN}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        redirectUri: 'https://tuapp.com/oauth-callback.html', // URL de tu página callback
                        state: 'optional-security-state'
                    })
                });
                
                const data = await response.json();
                console.log('Initiate response:', data);
                
                // 🔑 IMPORTANTE: Guardar para usar en el callback
                localStorage.setItem('oauth_vinculation_id', data.vinculation_id);
                localStorage.setItem('oauth_redirect_uri', 'https://tuapp.com/oauth-callback.html');
                
                // Redirigir a MercadoPago
                window.location.href = data.authorizationUrl;
                
            } catch (error) {
                console.error('Error iniciando OAuth:', error);
            }
        }
    </script>
</body>
</html>
```

### 2. **Página de Callback** (`/oauth-callback.html`)

```html
<!DOCTYPE html>
<html>
<head>
    <title>Procesando Vinculación...</title>
</head>
<body>
    <h1>Procesando vinculación...</h1>
    <div id="status">Conectando con MercadoPago...</div>
    
    <script>
        async function procesarCallback() {
            try {
                // 1. Obtener parámetros de la URL
                const urlParams = new URLSearchParams(window.location.search);
                const authorizationCode = urlParams.get('code');
                const state = urlParams.get('state');
                const error = urlParams.get('error');
                
                console.log('Callback URL params:', {
                    code: authorizationCode ? authorizationCode.substring(0, 10) + '...' : null,
                    state: state,
                    error: error
                });
                
                if (error) {
                    document.getElementById('status').innerHTML = `❌ Error: ${error}`;
                    return;
                }
                
                if (!authorizationCode) {
                    document.getElementById('status').innerHTML = '❌ No se recibió código de autorización';
                    return;
                }
                
                // 2. Obtener datos guardados del localStorage
                const vinculationId = localStorage.getItem('oauth_vinculation_id');
                const redirectUri = localStorage.getItem('oauth_redirect_uri');
                
                console.log('Datos del localStorage:', {
                    vinculationId: vinculationId,
                    redirectUri: redirectUri
                });
                
                if (!vinculationId) {
                    document.getElementById('status').innerHTML = '❌ No se encontró vinculation_id. Reinicia el proceso.';
                    return;
                }
                
                if (!redirectUri) {
                    document.getElementById('status').innerHTML = '❌ No se encontró redirect_uri. Reinicia el proceso.';
                    return;
                }
                
                // 3. Enviar datos al backend
                console.log('Enviando al backend:', {
                    authorizationCode: authorizationCode.substring(0, 10) + '...',
                    redirectUri: redirectUri,
                    vinculation_id: vinculationId
                });
                
                const response = await fetch('/api/payments/oauth/callback', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        authorizationCode: authorizationCode,
                        redirectUri: redirectUri,
                        vinculation_id: vinculationId
                    })
                });
                
                const result = await response.json();
                console.log('Backend response:', result);
                
                if (response.ok) {
                    document.getElementById('status').innerHTML = '✅ ¡Cuenta vinculada exitosamente!';
                    // Limpiar localStorage
                    localStorage.removeItem('oauth_vinculation_id');
                    localStorage.removeItem('oauth_redirect_uri');
                    
                    // Redirigir al dashboard después de 2 segundos
                    setTimeout(() => {
                        window.location.href = '/dashboard';
                    }, 2000);
                } else {
                    document.getElementById('status').innerHTML = `❌ Error: ${result.message}`;
                }
                
            } catch (error) {
                console.error('Error procesando callback:', error);
                document.getElementById('status').innerHTML = `❌ Error procesando callback: ${error.message}`;
            }
        }
        
        // Ejecutar cuando carga la página
        procesarCallback();
    </script>
</body>
</html>
```

---

## 🧪 **Testing Manual**

### 1. **Probar Initiate**
```bash
curl -X POST "https://menucom-api.onrender.com/payments/oauth/initiate" \
  -H "Authorization: Bearer TU_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "redirectUri": "https://tuapp.com/oauth-callback.html"
  }'
```

**Respuesta esperada:**
```json
{
  "authorizationUrl": "https://auth.mercadopago.com/authorization?client_id=...",
  "state": "user_123_1629123456789",
  "vinculation_id": "f6894e2e-38e7-40e4-89d1-b05018b9fdf3"
}
```

### 2. **Simular Callback**
```bash
curl -X POST "https://menucom-api.onrender.com/payments/oauth/callback" \
  -H "Content-Type: application/json" \
  -d '{
    "authorizationCode": "CODIGO_DE_MERCADOPAGO",
    "redirectUri": "https://tuapp.com/oauth-callback.html",
    "vinculation_id": "f6894e2e-38e7-40e4-89d1-b05018b9fdf3"
  }'
```

---

## 🔍 **Debugging Checklist**

### ✅ **Verificar en el Frontend:**

1. **¿Se está guardando el `vinculation_id`?**
   ```javascript
   console.log('Vinculation ID guardado:', localStorage.getItem('oauth_vinculation_id'));
   ```

2. **¿Se está capturando el `code` de la URL?**
   ```javascript
   const urlParams = new URLSearchParams(window.location.search);
   console.log('Código de MercadoPago:', urlParams.get('code'));
   ```

3. **¿Se están enviando TODOS los campos?**
   ```javascript
   const payload = {
     authorizationCode: authorizationCode,
     redirectUri: redirectUri,
     vinculation_id: vinculationId
   };
   console.log('Payload completo:', payload);
   ```

### ❌ **Errores Comunes:**

1. **No guardar `vinculation_id`** en localStorage
2. **URL de callback incorrecta** en MercadoPago Developers
3. **No capturar el `code`** de los parámetros URL
4. **Enviar solo `vinculation_id`** sin los otros campos

---

## 🎯 **Solución Rápida**

Si quieres probar rápidamente, usa el **callback GET** que ya tienes implementado:

```
https://menucom-api.onrender.com/payments/oauth/callback?code=CODIGO&state=user_f6894e2e-38e7-40e4-89d1-b05018b9fdf3_123456789
```

Este endpoint extrae el `userId` del `state` automáticamente.

---

## 📋 **Próximos Pasos**

1. **Implementar las páginas frontend** según los ejemplos
2. **Configurar la redirect URI** en MercadoPago Developers
3. **Probar el flujo completo** con las URLs reales
4. **Verificar logs** para confirmar que lleguen todos los datos

¿En qué parte del frontend necesitas ayuda específicamente?
