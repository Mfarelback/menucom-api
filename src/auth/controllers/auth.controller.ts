import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { CreateUserDto } from '../../user/dto/create-user.dto';
import { SocialRegistrationDto } from '../../user/dto/social-user.dto';
import { AuthService } from '../services/auth.service';
import { SwitchContextDto } from '../dto/switch-context.dto';
import { FirebaseAdminService } from '../firebase-admin.service';
import { LoggerService } from '../../core/logger/logger.service';
import { SkipResponseTransform } from '../../core/decorators/skip-transform.decorator';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { AuthenticatedRequest } from '../types/request.types';
import { CommerceService } from '../../commerce/services/commerce.service';

@SkipResponseTransform()
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly logger: LoggerService,
    private readonly firebaseAdminService: FirebaseAdminService,
    private readonly commerceService: CommerceService,
  ) {
    this.logger.setContext('AuthController');
  }

  @Get('firebase/health')
  @ApiOperation({ summary: 'Check Firebase configuration health' })
  @ApiResponse({ status: 200, description: 'Firebase is properly configured' })
  @ApiResponse({ status: 500, description: 'Firebase configuration error' })
  async checkFirebaseHealth() {
    try {
      const isInitialized = this.firebaseAdminService.isInitialized();
      return {
        status: isInitialized ? 'healthy' : 'warning',
        firebase: {
          configured: isInitialized,
          projectId: isInitialized
            ? this.firebaseAdminService.getApp().options.projectId
            : 'not-initialized',
          initialized: isInitialized,
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
  @HttpCode(HttpStatus.OK)
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
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Datos de registro con foto opcional',
    type: CreateUserDto,
  })
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
  async register(
    @Body() payload: CreateUserDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    this.logger.debug('Registro de usuario tradicional iniciado');
    return this.authService.registerUser(payload, file);
  }

  // Nuevos endpoints para autenticación social con Firebase

  @UseGuards(AuthGuard('google-id'))
  @Post('/social/login')
  @HttpCode(HttpStatus.OK)
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
  async loginSocial(@Req() req: Request) {
    this.logger.log('Iniciando proceso de login social');
    this.logger.debug(
      `Headers - Authorization: ${req.headers.authorization ? 'PRESENTE' : 'AUSENTE'}`,
    );

    const firebaseUserData = req.user as any;
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
    @Req() req: Request,
    @Body() socialData: SocialRegistrationDto,
  ) {
    this.logger.log('Iniciando registro social con datos adicionales');
    this.logger.debug(
      `Headers - Authorization: ${req.headers.authorization ? 'PRESENTE' : 'AUSENTE'}`,
    );

    const firebaseUserData = req.user as any;
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

  @UseGuards(AuthGuard('jwt'))
  @Post('/refresh')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Refrescar el token JWT',
    description:
      'Genera un nuevo access_token basado en el token actual válido.',
  })
  @ApiResponse({
    status: 201,
    description: 'Token refrescado exitosamente',
    schema: {
      type: 'object',
      properties: {
        access_token: { type: 'string' },
        user: { type: 'object' },
      },
    },
  })
  async refresh(@Req() req: AuthenticatedRequest) {
    this.logger.debug('Petición de refresco de token recibida');
    const userId = req.user.userId;
    return this.authService.refresh(userId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('switch-context')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Cambiar el contexto de comercio activo',
    description:
      'Genera un nuevo JWT con el commerceId especificado. El usuario debe tener un rol en el comercio.',
  })
  @ApiResponse({
    status: 200,
    description: 'Contexto cambiado exitosamente',
    schema: {
      type: 'object',
      properties: {
        access_token: { type: 'string' },
        commerceId: { type: 'string' },
        context: { type: 'string' },
        availableContexts: { type: 'array' },
      },
    },
  })
  async switchContext(
    @Req() req: AuthenticatedRequest,
    @Body() dto: SwitchContextDto,
  ) {
    const userId = req.user.userId;
    return this.authService.switchContext(userId, dto.commerceId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('my-contexts')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Obtener los comercios donde el usuario tiene rol',
    description:
      'Retorna la lista de comercios donde el usuario autenticado tiene algún rol asignado.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de comercios',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          businessName: { type: 'string' },
          slug: { type: 'string' },
          context: { type: 'string' },
          businessType: { type: 'string' },
          logoUrl: { type: 'string', nullable: true },
          coverImageUrl: { type: 'string', nullable: true },
          isCurrent: { type: 'boolean', description: 'Indica si este es el comercio actualmente seleccionado' },
        },
      },
    },
  })
  async getMyContexts(@Req() req: AuthenticatedRequest) {
    const userId = req.user.userId;
    const currentCommerceId = req.user.commerceId;
    const commerces = await this.commerceService.getUserContexts(userId);
    return commerces.map((c) => ({
      id: c.id,
      businessName: c.businessName,
      slug: c.slug,
      context: c.context,
      businessType: c.businessType,
      logoUrl: c.logoUrl,
      coverImageUrl: c.coverImageUrl,
      isCurrent: c.id === currentCommerceId,
    }));
  }
}
