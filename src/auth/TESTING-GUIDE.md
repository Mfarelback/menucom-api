# 🧪 Testing Guide - Firebase Social Authentication

## Configuración de Testing

### 1. Preparación del Entorno
```bash
# Instalar dependencias de testing adicionales
npm install --save-dev @types/supertest supertest

# Verificar que Firebase esté configurado
npm run build
npm run start:dev
```

### 2. Verificar Firebase Health Check
```bash
# GET http://localhost:3000/auth/firebase/health
curl -X GET http://localhost:3000/auth/firebase/health
```

**Respuesta Esperada:**
```json
{
  "status": "healthy",
  "firebase": {
    "configured": true,
    "projectId": "menucom-ff087",
    "timestamp": "2024-01-20T10:30:00.000Z"
  }
}
```

## Testing de Autenticación Social

### 1. Obtener Google ID Token

Para testing, necesitas un token real de Google/Firebase:

**Opción A: Usando Firebase SDK en el Frontend**
```javascript
// En tu app Flutter/React/JS
import { getAuth, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';

const auth = getAuth();
const provider = new GoogleAuthProvider();

signInWithPopup(auth, provider)
  .then((result) => {
    const user = result.user;
    const idToken = user.accessToken; // Este es el token que necesitas
    console.log('ID Token:', idToken);
  });
```

**Opción B: Usando Firebase Admin para Testing**
```typescript
// Crear un token personalizado para testing
const customToken = await admin.auth().createCustomToken('test-user-uid', {
  email: 'test@example.com',
  name: 'Test User'
});
```

### 2. Testing de Endpoints

#### Test 1: Login Social Exitoso
```bash
curl -X POST http://localhost:3000/auth/social/login \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_FIREBASE_ID_TOKEN"
```

**Respuesta Esperada:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "needToChangePassword": false,
  "user": {
    "id": "uuid-here",
    "email": "user@gmail.com",
    "name": "User Name",
    "photoURL": "https://lh3.googleusercontent.com/...",
    "role": "CLIENT",
    "socialToken": "firebase-uid-here"
  }
}
```

#### Test 2: Registro Social con Datos Adicionales
```bash
curl -X POST http://localhost:3000/auth/social/register \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_FIREBASE_ID_TOKEN" \
  -d '{
    "phone": "+57 300 123 4567",
    "address": "Calle 123 #45-67",
    "birthday": "1990-05-15"
  }'
```

#### Test 3: Token Inválido
```bash
curl -X POST http://localhost:3000/auth/social/login \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer invalid-token"
```

**Respuesta Esperada:**
```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "error": "Invalid Firebase token"
}
```

## Tests Unitarios

### 1. Test para FirebaseAdmin Service
```typescript
// src/auth/firebase-admin.spec.ts
import { Test } from '@nestjs/testing';
import { FirebaseAdmin } from './firebase-admin';

describe('FirebaseAdmin', () => {
  let service: FirebaseAdmin;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [FirebaseAdmin],
    }).compile();

    service = module.get<FirebaseAdmin>(FirebaseAdmin);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should verify valid token', async () => {
    // Aquí necesitarías un token válido para testing
    const mockToken = 'valid-firebase-token';
    const result = await service.verifyIdToken(mockToken);
    expect(result).toHaveProperty('uid');
    expect(result).toHaveProperty('email');
  });

  it('should get project info', async () => {
    const projectInfo = await service.getProjectInfo();
    expect(projectInfo).toHaveProperty('projectId');
    expect(projectInfo.projectId).toBe('menucom-ff087');
  });
});
```

### 2. Test para GoogleIdStrategy
```typescript
// src/auth/strategies/google-id.strategy.spec.ts
import { Test } from '@nestjs/testing';
import { GoogleIdStrategy } from './google-id.strategy';
import { FirebaseAdmin } from '../firebase-admin';

describe('GoogleIdStrategy', () => {
  let strategy: GoogleIdStrategy;
  let firebaseAdmin: FirebaseAdmin;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        GoogleIdStrategy,
        {
          provide: FirebaseAdmin,
          useValue: {
            verifyIdToken: jest.fn(),
          },
        },
      ],
    }).compile();

    strategy = module.get<GoogleIdStrategy>(GoogleIdStrategy);
    firebaseAdmin = module.get<FirebaseAdmin>(FirebaseAdmin);
  });

  it('should validate Firebase token', async () => {
    const mockDecodedToken = {
      uid: 'firebase-uid',
      email: 'test@gmail.com',
      name: 'Test User',
      picture: 'https://lh3.googleusercontent.com/photo.jpg',
      phone_number: '+57300123456',
      email_verified: true,
    };

    jest.spyOn(firebaseAdmin, 'verifyIdToken').mockResolvedValue(mockDecodedToken);

    const result = await strategy.validate('valid-token');
    
    expect(result).toEqual({
      uid: 'firebase-uid',
      email: 'test@gmail.com',
      name: 'Test User',
      photoURL: 'https://lh3.googleusercontent.com/photo.jpg',
      phone: '+57300123456',
      isEmailVerified: true,
    });
  });
});
```

### 3. Test de Integración para AuthController
```typescript
// src/auth/auth.controller.spec.ts
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AuthModule } from './auth.module';

describe('AuthController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AuthModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/auth/firebase/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/auth/firebase/health')
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveProperty('status');
        expect(res.body).toHaveProperty('firebase');
        expect(res.body.firebase).toHaveProperty('configured');
      });
  });

  it('/auth/social/login (POST) - should fail without token', () => {
    return request(app.getHttpServer())
      .post('/auth/social/login')
      .expect(401);
  });

  afterAll(async () => {
    await app.close();
  });
});
```

## Testing en Diferentes Ambientes

### Development
```bash
# Variables de entorno para testing local
FIREBASE_PROJECT_ID=menucom-ff087
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@menucom-ff087.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CONFIG_PATH=./menucom-gconfig.json
```

### Production/Staging
```bash
# Solo variables de entorno (sin archivo local)
FIREBASE_PROJECT_ID=menucom-ff087
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@menucom-ff087.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
# No incluir FIREBASE_CONFIG_PATH
```

## Troubleshooting

### Problemas Comunes

1. **Firebase no inicializado**
   ```json
   {
     "status": "error",
     "firebase": {
       "configured": false,
       "error": "Firebase configuration not found"
     }
   }
   ```
   **Solución:** Verificar que `menucom-gconfig.json` existe o que las variables de entorno están configuradas.

2. **Token inválido**
   ```json
   {
     "statusCode": 401,
     "message": "Unauthorized"
   }
   ```
   **Solución:** Verificar que el token de Firebase es válido y no ha expirado.

3. **Usuario ya existe**
   ```json
   {
     "statusCode": 400,
     "message": "User already exists"
   }
   ```
   **Solución:** Usar `/auth/social/login` en lugar de `/auth/social/register`.

### Logs de Debug

Para activar logs detallados:
```typescript
// En firebase-admin.ts, agregar:
console.log('Firebase config loaded:', {
  projectId: this.app.options.projectId,
  hasPrivateKey: !!this.app.options.credential
});
```

## Métricas de Testing

### Cobertura Mínima Esperada
- **Unit Tests:** 80% de cobertura
- **Integration Tests:** Todos los endpoints principales
- **E2E Tests:** Flujos críticos de autenticación

### Comandos de Testing
```bash
# Ejecutar todos los tests
npm run test

# Tests con cobertura
npm run test:cov

# Tests E2E
npm run test:e2e

# Tests en modo watch
npm run test:watch
```
