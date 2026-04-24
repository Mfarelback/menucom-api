# Módulo de Autenticación (Auth) - MenuCom API

## 🎯 Descripción General

El módulo de autenticación es el núcleo del sistema de seguridad de la aplicación MenuCom. Proporciona funcionalidades completas para el registro, autenticación y autorización de usuarios, incluyendo autenticación tradicional (email/password) y **autenticación social con Firebase/Google**.

## ✨ Nuevas Funcionalidades (v2.0)

- 🔥 **Autenticación social con Firebase**: Integración completa con Google Sign-in
- 🛡️ **Validación de tokens Firebase**: Verificación segura con Firebase Admin SDK
- 👥 **Registro automático**: Creación automática de usuarios en primer login social
- 📱 **Soporte multiplataforma**: Compatible con web y aplicaciones móviles
- 🔄 **Migración automática**: Vinculación de cuentas existentes con tokens sociales

## 🏗️ Arquitectura del Módulo

```
src/auth/
├── auth.module.ts                    # Configuración del módulo con Firebase
├── constants.ts                      # Constantes de configuración
├── firebase-admin.ts                 # Configuración de Firebase Admin SDK
├── jwt.strategy.ts                   # Estrategia JWT para Passport
├── local.strategy.ts                 # Estrategia local para Passport
├── controllers/
│   └── auth.controller.ts            # Controlador con endpoints sociales
├── decorators/
│   ├── public.decorator.ts           # Decorador para rutas públicas
│   └── role.decorator.ts             # Decorador para control de roles
├── guards/
│   ├── jwt.auth.guards.ts            # Guard para autenticación JWT
│   ├── local-auth.guards.ts          # Guard para autenticación local
│   ├── membership.guard.ts           # Guard para verificación de membresías
│   └── role.guards.ts                # Guard para control de acceso por roles
├── models/
│   └── roles.model.ts                # Definición de roles del sistema
├── services/
│   └── auth.service.ts               # Lógica de negocio con métodos sociales
└── strategies/
    ├── google-id.strategy.ts         # 🆕 Estrategia para Google ID Token
    └── passport-custom.d.ts          # Tipos para passport-custom
```

## 🔐 Sistemas de Autenticación

### 1. Autenticación Local (Email/Password)

**Estrategia**: `LocalStrategy`  
**Guard**: `AuthGuard('local')`  
**Endpoint**: `POST /auth/login`

#### Flujo de Autenticación:
1. Usuario envía credenciales (email/password)
2. `LocalStrategy` valida las credenciales con bcrypt
3. Se genera un JWT con payload específico
4. Retorna token de acceso y metadata del usuario

#### Ejemplo de Request:
```http
POST /auth/login
Content-Type: application/json

{
  "email": "usuario@ejemplo.com",
  "password": "password123"
}
```

#### Respuesta:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "needToChangePassword": false
}
```

### 2. 🆕 Autenticación Social (Google/Firebase)

**Estrategia**: `GoogleIdTokenStrategy`  
**Guard**: `AuthGuard('google-id')`  
**Endpoint**: `POST /auth/social/login`  
**Integración**: Firebase Authentication + Admin SDK

#### Flujo de Autenticación Social:
1. Cliente obtiene ID Token de Google/Firebase
2. Token se envía en el header `Authorization: Bearer <token>`
3. `GoogleIdTokenStrategy` valida el token con Firebase Admin SDK
4. Si el usuario existe, se genera JWT
5. Si no existe, se crea automáticamente con rol `customer`
6. Si existe pero sin token social, se vincula la cuenta

#### Ejemplo de Request:
```http
POST /auth/social/login
Authorization: Bearer <google_id_token>
Content-Type: application/json
```

#### Respuesta:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "needToChangePassword": false,
  "user": {
    "id": "uuid",
    "email": "usuario@gmail.com",
    "name": "Usuario",
    "photoURL": "https://...",
    "phone": "+1234567890",
    "role": "customer",
    "socialToken": "firebase_uid"
  }
}
```

### 3. Registro de Usuarios

#### Registro Local
```http
POST /auth/register
Content-Type: application/json

{
  "email": "nuevo@ejemplo.com",
  "name": "Nuevo Usuario",
  "password": "password123",
  "role": "customer",
  "phone": "+1234567890",
  "photoURL": "https://..."
}
```

#### 🆕 Registro Social con Datos Adicionales
```http
POST /auth/social/register
Authorization: Bearer <google_id_token>
Content-Type: application/json

{
  "email": "social@ejemplo.com",
  "name": "Usuario Social",
  "role": "customer",
  "phone": "+1234567890",
  "photoURL": "https://..."
}
```

## 📊 Endpoints de la API

| Método | Ruta | Descripción | Guard | Autenticación |
|--------|------|-------------|-------|---------------|
| POST | `/auth/login` | Login tradicional | LocalAuthGuard | Email/Password |
| POST | `/auth/register` | Registro tradicional | Ninguno | Formulario |
| POST | `/auth/social/login` | 🆕 Login social | GoogleIdStrategy | Firebase Token |
| POST | `/auth/social/register` | 🆕 Registro social | GoogleIdStrategy | Firebase Token + Datos |
| POST | `/auth/social` | Login social legacy | Ninguno | ⚠️ Deprecated |

### 🆕 Nuevos Endpoints Firebase

#### Autenticación Social
- **URL**: `POST /auth/social/login`
- **Headers**: `Authorization: Bearer <firebase_id_token>`
- **Descripción**: Autentica usuarios con token de Google/Firebase
- **Funcionalidad**: Registro automático en primer login

#### Registro Social con Datos
- **URL**: `POST /auth/social/register`
- **Headers**: `Authorization: Bearer <firebase_id_token>`
- **Body**: Datos adicionales del usuario
- **Descripción**: Registro social con información personalizada

## 🔧 Configuración de Firebase

### Variables de Entorno Requeridas

```env
# JWT Configuration (existente)
JWT_SECRET=your_super_secret_jwt_key_here

# 🆕 Firebase Configuration
FIREBASE_PROJECT_ID=tu-proyecto-firebase
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@tu-proyecto.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\ntu_clave_privada_aqui\n-----END PRIVATE KEY-----\n"
```

### Inicialización de Firebase Admin

```typescript
// firebase-admin.ts
const serviceAccount: admin.ServiceAccount = {
  projectId: configService.get<string>('FIREBASE_PROJECT_ID'),
  privateKey: configService.get<string>('FIREBASE_PRIVATE_KEY')?.replace(/\\n/g, '\n'),
  clientEmail: configService.get<string>('FIREBASE_CLIENT_EMAIL'),
};

FirebaseAdmin.instance = admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
```

### Verificación de Tokens

```typescript
async validate(req: Request): Promise<any> {
  const idToken = req.headers['authorization']?.replace('Bearer ', '');
  const decodedToken = await FirebaseAdmin.verifyIdToken(idToken);
  
  return {
    uid: decodedToken.uid,
    email: decodedToken.email,
    name: decodedToken.name,
    picture: decodedToken.picture,
    email_verified: decodedToken.email_verified,
    firebaseProvider: decodedToken.firebase?.sign_in_provider,
  };
}
```

## 📈 Entidad de Usuario Actualizada

### 🆕 Nuevos Campos para Autenticación Social

```typescript
@Entity()
export class User {
  @PrimaryColumn()
  id: string;

  @Column({ type: 'varchar', length: 255 })
  photoURL: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 255 })
  email: string;

  @Column({ type: 'varchar', length: 255 })
  phone: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  password: string; // nullable para usuarios sociales

  @Column({ type: 'boolean', default: true })
  needToChangepassword: boolean;

  @Column({ type: 'varchar', length: 100 })
  role: string;

  // 🆕 Campos para autenticación social
  @Column({ type: 'varchar', length: 255, nullable: true })
  socialToken: string; // Firebase UID

  @Column({ type: 'varchar', length: 255, nullable: true })
  firebaseProvider: string; // google.com, facebook.com, etc.

  @Column({ type: 'boolean', default: false })
  isEmailVerified: boolean;

  @Column({ type: 'timestamp', nullable: true })
  lastLoginAt: Date;

  @OneToOne(() => Membership, (membership) => membership.user)
  membership: Membership;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

### 🆕 DTOs para Autenticación Social

```typescript
// social-user.dto.ts
export class SocialUserDto {
  readonly email: string;
  readonly name: string;
  readonly socialToken: string; // Firebase UID
  readonly photoURL?: string;
  readonly phone?: string;
  readonly role?: string;
  readonly firebaseProvider?: string;
  readonly isEmailVerified?: boolean;
  readonly lastLoginAt?: Date;
}

export class SocialRegistrationDto {
  readonly email: string;
  readonly name: string;
  readonly phone?: string;
  readonly role?: string;
  readonly photoURL?: string;
}
```

### AuthController (`controllers/auth.controller.ts`)

**Responsabilidad**: Exposición de endpoints HTTP para autenticación.

#### Endpoints Disponibles:

| Método | Ruta | Descripción | Guard |
|--------|------|-------------|-------|
| POST | `/auth/login` | Autenticación tradicional | LocalAuthGuard |
| POST | `/auth/register` | Registro de nuevos usuarios | Ninguno |
| POST | `/auth/social` | Autenticación social | Ninguno |

**Características**:
- Documentación automática con Swagger (`@ApiTags('auth')`)
- Validación de entrada con DTOs
- Manejo de errores centralizado

### Estrategias de Passport

#### JwtStrategy (`jwt.strategy.ts`)
- **Propósito**: Validar tokens JWT en requests autenticados
- **Configuración**: Extrae token del header Authorization
- **Validación**: Decodifica payload y estructura datos del usuario
- **Retorno**: Objeto usuario con `{ userId, username, role }`

#### LocalStrategy (`local.strategy.ts`)
- **Propósito**: Validar credenciales email/password
- **Configuración**: Utiliza campos 'email' y 'password'
- **Validación**: Delega en AuthService.validateUser()
- **Manejo de errores**: Convierte excepciones de negocio en HTTP

### Sistema de Guards

#### JwtAuthGuard (`guards/jwt.auth.guards.ts`)
- **Función**: Protege rutas que requieren autenticación
- **Características**: 
  - Respeta decorador `@Public()` para rutas abiertas
  - Extiende AuthGuard de Passport con estrategia JWT

#### RoleGuard (`guards/role.guards.ts`)
- **Función**: Control de acceso basado en roles
- **Lógica**:
  - Permite acceso si no hay roles definidos
  - Verifica que el usuario tenga al menos uno de los roles requeridos
  - Maneja tanto roles individuales como arrays de roles
- **Excepciones**: Lanza ForbiddenException si no tiene permisos

#### MembershipGuard (`guards/membership.guard.ts`)
- **Función**: Verificación de membresías activas
- **Uso**: Protege funcionalidades premium

### Decoradores

#### @Public() (`decorators/public.decorator.ts`)
```typescript
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
```
- **Uso**: Marcar endpoints que no requieren autenticación
- **Ejemplo**: Páginas de login, registro, información pública

#### @Roles() (`decorators/role.decorator.ts`)
```typescript
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
```
- **Uso**: Especificar roles requeridos para acceder a un endpoint
- **Ejemplo**: `@Roles(Role.ADMIN, Role.PRO)`

### Modelo de Roles (`models/roles.model.ts`)

```typescript
export enum Role {
  CUSTOMER = 'customer',    // Usuario final
  ADMIN = 'admin',         // Administrador del sistema
  PRO = 'pro',            // Usuario profesional/premium
  OPERADOR = 'operador',   // Operador del sistema
}
```

## Flujos de Autenticación

### 1. Login Tradicional

```mermaid
sequenceDiagram
    participant C as Cliente
    participant AC as AuthController
    participant LS as LocalStrategy
    participant AS as AuthService
    participant US as UserService
    
    C->>AC: POST /auth/login {email, password}
    AC->>LS: validate(email, password)
    LS->>AS: validateUser(email, password)
    AS->>US: findByEmail(email)
    US-->>AS: userData
    AS->>AS: bcrypt.compare(password, hash)
    AS-->>LS: userValidated
    LS-->>AC: user
    AC->>AS: login(user)
    AS->>AS: generateJWT(payload)
    AS-->>AC: {access_token, needToChangePassword}
    AC-->>C: Response
```

### 2. Registro de Usuario

```mermaid
sequenceDiagram
    participant C as Cliente
    participant AC as AuthController
    participant AS as AuthService
    participant US as UserService
    
    C->>AC: POST /auth/register {userData}
    AC->>AS: registerUser(userData)
    AS->>US: create(userData)
    US-->>AS: newUser
    AS->>AS: generateJWT(payload)
    AS-->>AC: {access_token, needToChangePassword}
    AC-->>C: Response
```

### 3. Autenticación Social

```mermaid
sequenceDiagram
    participant C as Cliente
    participant AC as AuthController
    participant AS as AuthService
    participant US as UserService
    
    C->>AC: POST /auth/social {socialData}
    AC->>AS: loginSocial(socialData)
    AS->>US: findOne(userId)
    alt Usuario existe
        US-->>AS: existingUser
        AS->>AS: generateJWT(payload)
    else Usuario no existe
        US-->>AS: 404 Not Found
        AS->>AS: registerUserSocial(socialData)
        AS->>US: createOfSocial(socialData)
        US-->>AS: newUser
        AS->>AS: generateJWT(payload)
    end
    AS-->>AC: {access_token}
    AC-->>C: Response
```

## Configuración

### Variables de Entorno

```env
# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-here
JWT_EXPIRES_IN=1d

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=menucom
DB_PASSWORD=password
DB_NAME=menucom_db
```

### Configuración de Seguridad

```typescript
// config.ts
export default {
  jwtsecret: process.env.JWT_SECRET || 'default-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',
  // ... otras configuraciones
}
```

## Uso en Otros Módulos

### Proteger un Endpoint

```typescript
@Controller('protected')
export class ProtectedController {
  
  // Endpoint que requiere autenticación
  @UseGuards(JwtAuthGuard)
  @Get('/profile')
  getProfile(@Req() req: Request) {
    return req.user; // Usuario extraído del token
  }

  // Endpoint que requiere rol específico
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles(Role.ADMIN)
  @Get('/admin-only')
  adminOnly() {
    return { message: 'Solo administradores' };
  }

  // Endpoint público (sin autenticación)
  @Public()
  @Get('/public')
  publicEndpoint() {
    return { message: 'Acceso público' };
  }
}
```

### Configuración Global de Guards

```typescript
// app.module.ts o main.ts
app.useGlobalGuards(
  new JwtAuthGuard(reflector),
  new RoleGuard(reflector)
);
```

## Seguridad y Mejores Prácticas

### Implementadas

1. **Hashing de Contraseñas**: Uso de bcrypt con salt automático
2. **Tokens JWT**: Firmados con secreto seguro
3. **Expiración de Tokens**: Configurada en 1 día
4. **Validación de Entrada**: DTOs para validar datos de entrada
5. **Manejo de Errores**: Excepciones específicas y contextuales
6. **Separación de Responsabilidades**: Servicios especializados

### Recomendaciones Adicionales

1. **Rotación de Secretos**: Implementar rotación periódica de JWT_SECRET
2. **Rate Limiting**: Añadir límites de intentos de login
3. **2FA**: Considerar autenticación de dos factores
4. **Refresh Tokens**: Implementar tokens de refreso para sesiones largas
5. **Logging de Seguridad**: Registrar intentos de acceso y fallos
6. **HTTPS**: Asegurar que toda comunicación sea encriptada

## Testing

### Estructura de Tests

```typescript
// auth.service.spec.ts
describe('AuthService', () => {
  let service: AuthService;
  let userService: UserService;
  let jwtService: JwtService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UserService,
          useValue: mockUserService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should validate user with correct credentials', async () => {
    // Test implementation
  });
});
```

### Tests de Integración

```typescript
// auth.controller.e2e-spec.ts
describe('AuthController (e2e)', () => {
  it('/auth/login (POST)', () => {
    return request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'test@test.com', password: 'password' })
      .expect(201)
      .expect((res) => {
        expect(res.body.access_token).toBeDefined();
      });
  });
});
```

## Mantenimiento y Monitoreo

### Métricas Importantes

1. **Intentos de Login**: Exitosos vs fallidos
2. **Tokens Generados**: Frecuencia de autenticación
3. **Errores de Autorización**: Accesos denegados
4. **Tiempo de Respuesta**: Performance de endpoints de auth

### Logs de Seguridad

```typescript
// Ejemplo de logging en AuthService
async validateUser(email: string, pass: string) {
  this.logger.log(`Login attempt for email: ${email}`);
  
  try {
    const user = await this.usersService.findByEmail(email);
    const isMatch = await bcrypt.compare(pass, user.password);
    
    if (isMatch) {
      this.logger.log(`Successful login for user ID: ${user.id}`);
      return user;
    } else {
      this.logger.warn(`Failed login attempt for email: ${email} - Invalid password`);
      throw new UnauthorizedException('Contraseña no válida');
    }
  } catch (error) {
    this.logger.error(`Login error for email: ${email}`, error.stack);
    throw error;
  }
}
```

## Extensiones Futuras

1. **OAuth 2.0**: Implementar flujos OAuth estándar
2. **SAML**: Soporte para Single Sign-On empresarial
3. **Multi-tenancy**: Autenticación por organizaciones
4. **Session Management**: Control granular de sesiones activas
5. **API Keys**: Autenticación para APIs externas

---

## Conclusión

El módulo de autenticación de MenuCom proporciona una base sólida y segura para el manejo de usuarios y permisos en la aplicación. Su diseño modular y siguiendo las mejores prácticas de NestJS permite una fácil extensión y mantenimiento, mientras garantiza la seguridad y integridad de los datos de los usuarios.

## 📚 Documentación Adicional

- **[📖 Guía de Testing](./TESTING-GUIDE.md)** - Cómo probar la implementación de Firebase
- **[🔧 Health Check de Firebase](http://localhost:3000/auth/firebase/health)** - Verificar estado de Firebase
- **[📋 Documentación de NestJS Auth](https://docs.nestjs.com/security/authentication)** - Documentación oficial

## 🔧 Comandos Útiles

```bash
# Verificar estado de Firebase
curl -X GET http://localhost:3000/auth/firebase/health

# Ejecutar tests específicos del módulo auth
npm run test src/auth

# Tests con cobertura
npm run test:cov src/auth

# Tests E2E
npm run test:e2e auth

# Linting y formato
npm run lint
npm run format

# Build del proyecto
npm run build

# Ejecutar en modo desarrollo
npm run start:dev
```

## 🚀 Próximas Mejoras

### Funcionalidades Planificadas

- [ ] **Apple Sign-In Integration** - Soporte para autenticación con Apple ID
- [ ] **Microsoft Azure AD** - Integración con Active Directory corporativo
- [ ] **Refresh Token Automático** - Renovación transparente de tokens
- [ ] **Rate Limiting** - Protección contra ataques de fuerza bruta
- [ ] **Logs de Auditoría** - Seguimiento detallado de eventos de autenticación
- [ ] **2FA/MFA Integration** - Autenticación de múltiples factores
- [ ] **Session Management Avanzado** - Control granular de sesiones activas
- [ ] **Password Recovery** - Sistema de recuperación de contraseñas
- [ ] **Account Verification** - Verificación de email obligatoria
- [ ] **Device Management** - Control de dispositivos autorizados

### Mejoras Técnicas

- [ ] **GraphQL Support** - Soporte para consultas GraphQL
- [ ] **WebSocket Authentication** - Autenticación para conexiones en tiempo real
- [ ] **API Rate Limiting** - Límites por endpoint y usuario
- [ ] **Metrics Dashboard** - Panel de métricas de autenticación
- [ ] **Security Headers** - Headers de seguridad automáticos
- [ ] **CORS Configuration** - Configuración avanzada de CORS
- [ ] **Helmet Integration** - Protección adicional con Helmet.js

### Optimizaciones

- [ ] **Caching Strategy** - Cache de tokens y usuarios frecuentes
- [ ] **Database Optimization** - Índices y consultas optimizadas
- [ ] **Memory Management** - Gestión eficiente de memoria
- [ ] **Performance Monitoring** - Monitoreo de rendimiento en tiempo real
