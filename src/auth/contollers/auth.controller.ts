import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { CreateUserDto } from 'src/user/dto/create-user.dto';
import { SocialRegistrationDto } from 'src/user/dto/social-user.dto';
import { AuthService } from '../services/auth.service';
import { FirebaseAdmin } from '../firebase-admin';
import { LoggerService } from 'src/core/logger/logger.service';
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
  constructor(
    private readonly authService: AuthService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext('AuthController');
  }

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
    this.logger.debug('Registro de usuario tradicional iniciado');
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
    this.logger.log('Iniciando proceso de login social');
    this.logger.debug(
      `Headers - Authorization: ${req.headers.authorization ? 'PRESENTE' : 'AUSENTE'}`,
    );

    // Los datos del usuario ya vienen validados por GoogleIdTokenStrategy
    const firebaseUserData = req.user;
    this.logger.logObject('Datos de Firebase validados', {
      uid: firebaseUserData?.uid,
      email: firebaseUserData?.email,
      name: firebaseUserData?.name,
      email_verified: firebaseUserData?.email_verified,
      firebaseProvider: firebaseUserData?.firebaseProvider,
    });

    this.logger.debug('Enviando datos al AuthService...');
    const result = await this.authService.loginSocial(firebaseUserData);
    this.logger.log('Login social completado exitosamente');

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
    this.logger.log('Iniciando registro social con datos adicionales');
    this.logger.debug(
      `Headers - Authorization: ${req.headers.authorization ? 'PRESENTE' : 'AUSENTE'}`,
    );

    const firebaseUserData = req.user;
    this.logger.logObject('Datos de Firebase para registro', {
      uid: firebaseUserData?.uid,
      email: firebaseUserData?.email,
      name: firebaseUserData?.name,
      email_verified: firebaseUserData?.email_verified,
    });

    this.logger.debug('Datos adicionales del formulario recibidos');

    this.logger.debug('Enviando al AuthService para registro...');
    const result = await this.authService.registerSocialWithData(
      socialData,
      firebaseUserData,
    );
    this.logger.log('Registro social completado exitosamente');

    return result;
  }
}
