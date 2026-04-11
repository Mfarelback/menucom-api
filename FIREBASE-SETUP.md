# 🔥 Configuración de Firebase para Autenticación Social

## 📋 Pasos para configurar Firebase

### 1. Crear proyecto en Firebase Console

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Haz clic en "Crear un proyecto"
3. Ingresa el nombre del proyecto (ej: menucom-app)
4. Configura Google Analytics (opcional)

### 2. Habilitar Authentication

1. En el menú lateral, ve a **Authentication**
2. Haz clic en **Get started**
3. Ve a la pestaña **Sign-in method**
4. Habilita los proveedores que necesites:
   - **Google** (recomendado)
   - **Facebook** (opcional)
   - **Apple** (opcional)

### 3. Configurar Google Sign-in

1. Haz clic en **Google** en la lista de proveedores
2. Activa el switch **Enable**
3. Configura el nombre público del proyecto
4. Agrega tu email de soporte
5. Guarda los cambios

### 4. Obtener credenciales del servidor

1. Ve a **Configuración del proyecto** (⚙️ > Project settings)
2. Selecciona la pestaña **Service accounts**
3. Haz clic en **Generate new private key**
4. Descarga el archivo JSON con las credenciales
5. **¡IMPORTANTE!** No subas este archivo al repositorio

### 5. Configurar variables de entorno

Del archivo JSON descargado, extrae estos valores para tu `.env`:

```env
FIREBASE_PROJECT_ID=tu-proyecto-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@tu-proyecto.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nTU_CLAVE_PRIVADA_AQUI\n-----END PRIVATE KEY-----\n"
```

**Nota importante sobre FIREBASE_PRIVATE_KEY:**
- Debe estar en una sola línea
- Los saltos de línea se representan como `\n`
- Debe estar entre comillas dobles
- Incluye el header y footer completos

### 6. Configurar tu aplicación web/móvil

#### Para aplicaciones web:
1. Ve a **Configuración del proyecto**
2. En la sección **Your apps**, haz clic en **Web** (</>) 
3. Registra tu app con un nickname
4. Copia la configuración de Firebase

#### Para aplicaciones móviles:
1. Haz clic en **Android** o **iOS** según corresponda
2. Sigue las instrucciones específicas de la plataforma
3. Descarga los archivos de configuración (`google-services.json` o `GoogleService-Info.plist`)

## 🔧 Configuración en el Frontend

### React/Next.js

```javascript
// firebase.config.js
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "tu-api-key",
  authDomain: "tu-proyecto.firebaseapp.com",
  projectId: "tu-proyecto-id",
  storageBucket: "tu-proyecto.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef123456"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
```

### Autenticación con Google

```javascript
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from './firebase.config';

const signInWithGoogle = async () => {
  const provider = new GoogleAuthProvider();
  try {
    const result = await signInWithPopup(auth, provider);
    const idToken = await result.user.getIdToken();
    
    // Enviar el token al backend
    const response = await fetch('/api/auth/social/login', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    // Guardar el JWT del backend
    localStorage.setItem('access_token', data.access_token);
    
  } catch (error) {
    console.error('Error durante el login:', error);
  }
};
```

## 🚨 Consideraciones de Seguridad

### Variables de Entorno
- ✅ Nunca subas las credenciales de Firebase al repositorio
- ✅ Usa `.env` local para desarrollo
- ✅ Configura variables de entorno seguras en producción
- ✅ Rota las claves periódicamente

### Configuración de Firebase
- ✅ Configura dominios autorizados en Firebase Console
- ✅ Habilita solo los proveedores que necesites
- ✅ Configura reglas de seguridad apropiadas
- ✅ Monitorea los logs de autenticación

### Backend
- ✅ Siempre valida los tokens en el servidor
- ✅ No confíes en datos del cliente
- ✅ Implementa rate limiting
- ✅ Registra intentos de autenticación

## 🔍 Testing

### Probar la configuración
```bash
# Verificar que las variables estén configuradas
echo $FIREBASE_PROJECT_ID
echo $FIREBASE_CLIENT_EMAIL

# Probar el endpoint
curl -X POST http://localhost:3000/auth/social/login \
  -H "Authorization: Bearer TU_FIREBASE_ID_TOKEN" \
  -H "Content-Type: application/json"
```

### Casos de prueba comunes
- ✅ Token válido de Google
- ❌ Token expirado
- ❌ Token de proyecto incorrecto
- ❌ Usuario sin email verificado
- ✅ Primer login (registro automático)
- ✅ Login de usuario existente

## 📚 Recursos Adicionales

- [Firebase Auth Documentation](https://firebase.google.com/docs/auth)
- [Google Sign-in for Web](https://developers.google.com/identity/sign-in/web)
- [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup)
- [Security Best Practices](https://firebase.google.com/docs/auth/admin/verify-id-tokens)

## 🐛 Troubleshooting

### Error: "Project not found"
- Verifica que `FIREBASE_PROJECT_ID` sea correcto
- Asegúrate de que el proyecto existe en Firebase Console

### Error: "Invalid private key"
- Verifica el formato de `FIREBASE_PRIVATE_KEY`
- Asegúrate de que incluya `\n` para saltos de línea
- Confirma que esté entre comillas dobles

### Error: "Token verification failed"
- Verifica que el token sea de Google/Firebase
- Confirma que no haya expirado
- Asegúrate de que sea del proyecto correcto

### Error: "Email not verified"
- En desarrollo, puedes permitir emails no verificados
- En producción, considera requerir verificación
- Implementa flujo de reverificación si es necesario
