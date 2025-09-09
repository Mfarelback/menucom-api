import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { CreateUserDto } from 'src/user/dto/create-user.dto';
import { SocialRegistrationDto } from 'src/user/dto/social-user.dto';
import { AuthService } from '../services/auth.service';
import { FirebaseAdmin } from '../firebase-admin';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';

// Extender el tipo Request para incluir user
interface AuthenticatedRequest extends Request {
  user: any;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('firebase/health')
  @ApiOperation({ summary: 'Check Firebase configuration health' })
  @ApiResponse({ status: 200, description: 'Firebase is properly configured' })
  @ApiResponse({ status: 500, description: 'Firebase configuration error' })
  async checkFirebaseHealth() {
    try {
      const projectInfo = FirebaseAdmin.getProjectInfo();
      return {
        status: 'healthy',
        firebase: {
          configured: true,
          projectId: projectInfo.projectId,
          initialized: projectInfo.initialized,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        status: 'error',
        firebase: {
          configured: false,
          error: error.message,
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  @UseGuards(AuthGuard('local'))
  @Post('/login')
  @ApiOperation({
    summary: 'Autenticación tradicional con email y contraseña',
  })
  @ApiResponse({
    status: 201,
    description: 'Login exitoso',
    schema: {
      type: 'object',
      properties: {
        access_token: { type: 'string' },
        needToChangePassword: { type: 'boolean' },
      },
    },
  })
  async login(@Req() payload: AuthenticatedRequest) {
    return this.authService.login(payload);
  }

  @Post('/register')
  @ApiOperation({ summary: 'Registro de nuevo usuario tradicional' })
  @ApiResponse({
    status: 201,
    description: 'Usuario registrado exitosamente',
    schema: {
      type: 'object',
      properties: {
        access_token: { type: 'string' },
        needToChangePassword: { type: 'boolean' },
      },
    },
  })
  async register(@Body() payload: CreateUserDto) {
    console.log(payload);
    return this.authService.registerUser(payload);
  }

  // Nuevos endpoints para autenticación social con Firebase

  @UseGuards(AuthGuard('google-id'))
  @Post('/social/login')
  @ApiBearerAuth('Firebase ID Token')
  @ApiOperation({
    summary: 'Autenticación social con Google/Firebase',
    description:
      'Autentica usuarios usando Google ID Token de Firebase. El token debe enviarse en el header Authorization como Bearer token.',
  })
  @ApiResponse({
    status: 201,
    description: 'Autenticación social exitosa',
    schema: {
      type: 'object',
      properties: {
        access_token: { type: 'string' },
        needToChangePassword: { type: 'boolean' },
        user: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            email: { type: 'string' },
            name: { type: 'string' },
            photoURL: { type: 'string' },
            phone: { type: 'string' },
            role: { type: 'string' },
            socialToken: { type: 'string' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Token inválido o expirado' })
  async loginSocial(@Req() req: AuthenticatedRequest) {
    console.log('🔐 [AUTH CONTROLLER] Iniciando proceso de login social');
    console.log('📋 [AUTH CONTROLLER] Headers recibidos:', {
      authorization: req.headers.authorization
        ? '***TOKEN_PRESENTE***'
        : 'NO_TOKEN',
      'user-agent': req.headers['user-agent'],
      'content-type': req.headers['content-type'],
    });

    // Los datos del usuario ya vienen validados por GoogleIdTokenStrategy
    const firebaseUserData = req.user;
    console.log('👤 [AUTH CONTROLLER] Datos de Firebase validados:', {
      uid: firebaseUserData?.uid,
      email: firebaseUserData?.email,
      name: firebaseUserData?.name,
      email_verified: firebaseUserData?.email_verified,
      firebaseProvider: firebaseUserData?.firebaseProvider,
    });

    console.log('🚀 [AUTH CONTROLLER] Enviando datos al AuthService...');
    const result = await this.authService.loginSocial(firebaseUserData);
    console.log('✅ [AUTH CONTROLLER] Login social completado exitosamente');

    return result;
  }

  @UseGuards(AuthGuard('google-id'))
  @Post('/social/register')
  @ApiBearerAuth('Firebase ID Token')
  @ApiOperation({
    summary: 'Registro social con datos adicionales',
    description:
      'Registra un usuario social con datos adicionales del formulario. Requiere Google ID Token en el header y datos adicionales en el body.',
  })
  @ApiResponse({
    status: 201,
    description: 'Usuario social registrado exitosamente',
    schema: {
      type: 'object',
      properties: {
        access_token: { type: 'string' },
        needToChangePassword: { type: 'boolean' },
        user: { type: 'object' },
      },
    },
  })
  async registerSocial(
    @Req() req: AuthenticatedRequest,
    @Body() socialData: SocialRegistrationDto,
  ) {
    console.log(
      '🔐 [AUTH CONTROLLER] Iniciando registro social con datos adicionales',
    );
    console.log('📋 [AUTH CONTROLLER] Headers recibidos:', {
      authorization: req.headers.authorization
        ? '***TOKEN_PRESENTE***'
        : 'NO_TOKEN',
      'content-type': req.headers['content-type'],
    });

    const firebaseUserData = req.user;
    console.log('👤 [AUTH CONTROLLER] Datos de Firebase para registro:', {
      uid: firebaseUserData?.uid,
      email: firebaseUserData?.email,
      name: firebaseUserData?.name,
      email_verified: firebaseUserData?.email_verified,
    });

    console.log('📝 [AUTH CONTROLLER] Datos adicionales del formulario:', {
      ...socialData,
      // No loggear datos sensibles si los hay
    });

    console.log(
      '🚀 [AUTH CONTROLLER] Enviando al AuthService para registro...',
    );
    const result = await this.authService.registerSocialWithData(
      socialData,
      firebaseUserData,
    );
    console.log('✅ [AUTH CONTROLLER] Registro social completado exitosamente');

    return result;
  }

  // Mantener el endpoint anterior por compatibilidad
  @Post('/social')
  @ApiOperation({
    summary: '[DEPRECATED] Autenticación social legacy',
    description:
      'Endpoint legacy para autenticación social. Usar /social/login en su lugar.',
  })
  async loginSocialLegacy(@Body() payload: CreateUserDto) {
    return this.authService.loginSocial_OLD(payload);
  }
}
