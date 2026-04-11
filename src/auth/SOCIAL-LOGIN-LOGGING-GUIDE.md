# 🔐 Guía de Logging para Autenticación Social

Se ha agregado logging detallado en todo el flujo de autenticación social para facilitar el debugging y monitoreo. Este documento explica qué logs buscar y cómo interpretarlos.

## 📊 Componentes con Logging

### 1. **AUTH CONTROLLER** (`auth.controller.ts`)
- **Login Social** (`POST /auth/social/login`)
- **Registro Social** (`POST /auth/social/register`)

### 2. **GOOGLE STRATEGY** (`google-id.strategy.ts`)
- Validación de tokens de Google/Firebase
- Extracción de datos del token

### 3. **FIREBASE ADMIN** (`firebase-admin.ts`)
- Verificación de tokens con Firebase Admin SDK
- Decodificación de tokens

### 4. **AUTH SERVICE** (`auth.service.ts`)
- Lógica de autenticación y registro social
- Gestión de usuarios existentes vs nuevos

### 5. **USER SERVICE** (`user.service.ts`)
- Búsqueda de usuarios por email y socialToken
- Creación y actualización de usuarios sociales

## 🔍 Flujo de Logs para Login Social

```
🔐 [AUTH CONTROLLER] Iniciando proceso de login social
📋 [AUTH CONTROLLER] Headers recibidos: {...}
🔐 [GOOGLE STRATEGY] Iniciando validación de token
📋 [GOOGLE STRATEGY] Headers disponibles: {...}
🔍 [GOOGLE STRATEGY] Token extraído, verificando con Firebase...
🔥 [FIREBASE ADMIN] Iniciando verificación de ID Token
⏳ [FIREBASE ADMIN] Enviando token a Firebase para verificación...
✅ [FIREBASE ADMIN] Token verificado en XXXms
🔓 [FIREBASE ADMIN] Token decodificado exitosamente: {...}
✅ [GOOGLE STRATEGY] Token de Google verificado exitosamente para: usuario@email.com
👤 [AUTH CONTROLLER] Datos de Firebase validados: {...}
🚀 [AUTH CONTROLLER] Enviando datos al AuthService...
🔄 [AUTH SERVICE] Iniciando loginSocial
🔍 [AUTH SERVICE] Buscando usuario por socialToken (uid): firebase_uid
🔍 [USER SERVICE] Buscando usuario por socialToken: firebase_uid
✅ [USER SERVICE] Usuario encontrado por socialToken: user_id (email)
🎫 [AUTH SERVICE] Generando JWT token...
✅ [AUTH SERVICE] JWT token generado exitosamente
🎉 [AUTH SERVICE] LoginSocial completado exitosamente para usuario: email
✅ [AUTH CONTROLLER] Login social completado exitosamente
```

## 🆕 Flujo de Logs para Nuevo Usuario (Registro)

```
🔄 [AUTH SERVICE] Iniciando loginSocial
🔍 [USER SERVICE] Buscando usuario por socialToken: firebase_uid
❌ [USER SERVICE] Usuario no encontrado por socialToken
🔍 [USER SERVICE] Buscando usuario por email: usuario@email.com
❌ [USER SERVICE] Usuario no encontrado por email
🆕 [AUTH SERVICE] Creando nuevo usuario social...
🆕 [USER SERVICE] Iniciando creación de usuario social
📋 [USER SERVICE] Datos recibidos para createOfSocial: {...}
🔍 [USER SERVICE] Verificando si existe usuario con email: usuario@email.com
💾 [USER SERVICE] Creando nuevo usuario social en base de datos...
✅ [USER SERVICE] Nuevo usuario social creado exitosamente: {...}
✅ [AUTH SERVICE] Nuevo usuario social creado con ID: user_id
🎫 [AUTH SERVICE] Generando JWT token...
🎉 [AUTH SERVICE] LoginSocial completado exitosamente para usuario: email
```

## 🔄 Flujo de Logs para Usuario Existente (Actualización)

```
🔍 [USER SERVICE] Buscando usuario por socialToken: firebase_uid
❌ [USER SERVICE] Usuario no encontrado por socialToken
🔍 [USER SERVICE] Buscando usuario por email: usuario@email.com
✅ [USER SERVICE] Usuario encontrado por email: user_id
✅ [AUTH SERVICE] Usuario encontrado por email, actualizando socialToken
🔄 [USER SERVICE] Actualizando socialToken para usuario: user_id
✅ [USER SERVICE] SocialToken actualizado exitosamente para usuario: email
🔄 [AUTH SERVICE] SocialToken actualizado exitosamente
```

## 🚨 Logs de Error

### Token Inválido:
```
❌ [GOOGLE STRATEGY] Token de autorización no encontrado o formato inválido
🔴 [GOOGLE STRATEGY] Token ID inválido
❌ [FIREBASE ADMIN] Token inválido
```

### Token Expirado:
```
⏰ [GOOGLE STRATEGY] Token ID expirado
⏰ [FIREBASE ADMIN] Token expirado
```

### Errores de Base de Datos:
```
❌ [USER SERVICE] Error buscando usuario por socialToken: {...}
❌ [AUTH SERVICE] Error en loginSocial: {...}
```

## 📋 Datos Sensibles

Los logs están configurados para **NO mostrar** información sensible:
- ✅ **Se muestra**: UIDs, emails, nombres, roles
- ❌ **NO se muestra**: Tokens completos (solo preview), contraseñas, datos personales sensibles
- 🔒 **Tokens**: Se muestran como "***TOKEN_PRESENTE***" o preview de 20 caracteres

## 🧪 Cómo Testear

### 1. Login Social Exitoso:
```bash
curl -X POST http://localhost:3000/auth/social/login \
  -H "Authorization: Bearer YOUR_FIREBASE_ID_TOKEN" \
  -H "Content-Type: application/json"
```

### 2. Registro Social con Datos:
```bash
curl -X POST http://localhost:3000/auth/social/register \
  -H "Authorization: Bearer YOUR_FIREBASE_ID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Usuario Test", "phone": "+1234567890"}'
```

## 📈 Métricas en los Logs

- **Tiempo de verificación Firebase**: `Token verificado en XXXms`
- **Longitud de tokens**: `Longitud del token: XXX`
- **Estados de usuario**: Nuevo, existente, actualizado
- **Tipos de provider**: Google, Facebook, etc.

## 🔧 Configuración

Para activar/desactivar logs específicos, modifica los `console.log` en:
- `src/auth/controllers/auth.controller.ts`
- `src/auth/strategies/google-id.strategy.ts`
- `src/auth/firebase-admin.ts`
- `src/auth/services/auth.service.ts`
- `src/user/user.service.ts`

## 🎯 Casos de Uso

1. **Debugging login fallido**: Buscar logs de error en orden cronológico
2. **Verificar tokens**: Revisar logs de Firebase Admin
3. **Auditar creación de usuarios**: Seguir logs de USER SERVICE
4. **Monitorear performance**: Revisar tiempos de verificación Firebase
5. **Detectar problemas de configuración**: Logs de inicialización Firebase

---

**Nota**: Los logs usan emojis para facilitar la identificación visual en los archivos de log. Cada componente tiene su propio prefijo distintivo.
