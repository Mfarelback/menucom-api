# 🧪 Guía de Pruebas - Autenticación Social con Firebase

## 📋 Configuración Previa

### 1. Variables de Entorno
Asegúrate de tener configuradas las variables de Firebase en tu archivo `.env`:

```env
FIREBASE_PROJECT_ID=tu-proyecto-firebase
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@tu-proyecto.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\ntu_clave_privada_aqui\n-----END PRIVATE KEY-----\n"
```

### 2. Dependencias
Verifica que estén instaladas:
```bash
npm install firebase-admin passport-custom
```

## 🚀 Iniciar el Servidor

```bash
npm run start:dev
```

Verifica que veas el mensaje: `🔥 Firebase Admin initialized successfully`

## 🔍 Casos de Prueba

### 1. Obtener Token de Firebase (Frontend)

#### Usando JavaScript en el navegador:
```javascript
// En la consola del navegador después de autenticarte con Google
firebase.auth().currentUser.getIdToken(true).then(token => {
  console.log('Token:', token);
  // Copia este token para las pruebas
});
```

#### Usando Firebase CLI (para testing):
```bash
# Instalar Firebase CLI
npm install -g firebase-tools

# Login y obtener token
firebase auth:export users.json --project tu-proyecto-id
```

### 2. Probar Login Social - Usuario Nuevo

#### Request:
```bash
curl -X POST http://localhost:3000/auth/social/login \
  -H "Authorization: Bearer TU_FIREBASE_ID_TOKEN" \
  -H "Content-Type: application/json"
```

#### Respuesta Esperada (201):
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "needToChangePassword": false,
  "user": {
    "id": "generated-uuid",
    "email": "usuario@gmail.com",
    "name": "Usuario Prueba",
    "photoURL": "https://lh3.googleusercontent.com/...",
    "phone": null,
    "role": "customer",
    "socialToken": "firebase_uid_aqui"
  }
}
```

### 3. Probar Login Social - Usuario Existente

#### Request:
```bash
# Mismo request que el anterior
curl -X POST http://localhost:3000/auth/social/login \
  -H "Authorization: Bearer TU_FIREBASE_ID_TOKEN" \
  -H "Content-Type: application/json"
```

#### Respuesta Esperada (201):
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "needToChangePassword": false,
  "user": {
    "id": "same-uuid-as-before",
    "email": "usuario@gmail.com",
    "name": "Usuario Prueba",
    "photoURL": "https://lh3.googleusercontent.com/...",
    "phone": null,
    "role": "customer",
    "socialToken": "firebase_uid_aqui"
  }
}
```

### 4. Probar Registro Social con Datos Adicionales

#### Request:
```bash
curl -X POST http://localhost:3000/auth/social/register \
  -H "Authorization: Bearer TU_FIREBASE_ID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+1234567890",
    "role": "pro"
  }'
```

#### Respuesta Esperada (201):
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "needToChangePassword": false,
  "user": {
    "id": "generated-uuid",
    "email": "usuario@gmail.com",
    "name": "Usuario Prueba",
    "photoURL": "https://lh3.googleusercontent.com/...",
    "phone": "+1234567890",
    "role": "pro",
    "socialToken": "firebase_uid_aqui"
  }
}
```

## ❌ Casos de Error

### 1. Token Inválido

#### Request:
```bash
curl -X POST http://localhost:3000/auth/social/login \
  -H "Authorization: Bearer token_invalido" \
  -H "Content-Type: application/json"
```

#### Respuesta Esperada (401):
```json
{
  "statusCode": 401,
  "message": "Error al verificar el token de autenticación"
}
```

### 2. Token Expirado

#### Respuesta Esperada (401):
```json
{
  "statusCode": 401,
  "message": "Token ID expirado"
}
```

### 3. Sin Header Authorization

#### Request:
```bash
curl -X POST http://localhost:3000/auth/social/login \
  -H "Content-Type: application/json"
```

#### Respuesta Esperada (401):
```json
{
  "statusCode": 401,
  "message": "Token de autorización no encontrado o formato inválido"
}
```

## 📊 Verificar Base de Datos

### 1. Consultar usuario creado
```sql
SELECT 
  id, 
  email, 
  name, 
  role, 
  socialToken, 
  firebaseProvider, 
  isEmailVerified,
  lastLoginAt,
  createAt
FROM "user" 
WHERE socialToken IS NOT NULL;
```

### 2. Verificar campos de autenticación social
```sql
-- Usuarios con autenticación social
SELECT COUNT(*) as social_users 
FROM "user" 
WHERE socialToken IS NOT NULL;

-- Usuarios con email verificado
SELECT COUNT(*) as verified_emails 
FROM "user" 
WHERE isEmailVerified = true;
```

## 🔧 Debugging

### 1. Logs del Servidor
Busca estos mensajes en la consola:

```bash
# Inicialización exitosa
🔥 Firebase Admin initialized successfully

# Token verificado
✅ Token de Google verificado exitosamente para: usuario@gmail.com

# Errores
❌ Error en GoogleIdTokenStrategy: [error details]
❌ Error en loginSocial: [error details]
```

### 2. Verificar Configuración de Firebase

#### Test de configuración:
```bash
curl -X GET http://localhost:3000/health \
  -H "Content-Type: application/json"
```

#### En el código, agregar endpoint de health check:
```typescript
@Get('/health/firebase')
async checkFirebase() {
  try {
    const app = FirebaseAdmin.getInstance();
    return { 
      status: 'ok', 
      projectId: app.options.projectId 
    };
  } catch (error) {
    return { 
      status: 'error', 
      message: error.message 
    };
  }
}
```

## 🧑‍💻 Testing con Frontend

### React/Next.js Example:
```javascript
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';

const handleGoogleLogin = async () => {
  try {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    const idToken = await result.user.getIdToken();
    
    // Probar con tu API
    const response = await fetch('http://localhost:3000/auth/social/login', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('Login exitoso:', data);
      localStorage.setItem('access_token', data.access_token);
    } else {
      console.error('Error en login:', await response.text());
    }
  } catch (error) {
    console.error('Error:', error);
  }
};
```

## 📝 Checklist de Pruebas

- [ ] Firebase Admin inicializa correctamente
- [ ] Variables de entorno configuradas
- [ ] Primer login social crea usuario automáticamente
- [ ] Segundo login reutiliza usuario existente
- [ ] Token inválido retorna error 401
- [ ] Token expirado retorna error 401
- [ ] Campos de usuario se guardan correctamente
- [ ] Role por defecto es 'customer'
- [ ] Email verificado se marca correctamente
- [ ] LastLoginAt se actualiza en cada login
- [ ] JWT generado es válido
- [ ] Registro social con datos adicionales funciona
- [ ] Vinculación de cuentas existentes funciona

## 🚨 Problemas Comunes

### "Project not found"
- Verifica `FIREBASE_PROJECT_ID`
- Confirma que el proyecto existe en Firebase Console

### "Invalid private key"
- Revisa el formato de `FIREBASE_PRIVATE_KEY`
- Asegúrate de que tenga `\n` para saltos de línea
- Confirma que esté entre comillas dobles

### "Module not found: passport-custom"
- Ejecuta: `npm install passport-custom`
- Reinicia el servidor

### "Cannot find module firebase-admin"
- Ejecuta: `npm install firebase-admin`
- Verifica que esté en dependencies del package.json
