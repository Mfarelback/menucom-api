import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Req,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt.auth.gards';
import { MercadoPagoOAuthService } from '../services/mercado-pago-oauth.service';
import { InitiateOAuthDto, TokenExchangeDto } from '../dto/oauth.dto';
import { MercadoPagoAccount } from '../entities/mercado-pago-account.entity';

@ApiTags('Mercado Pago OAuth')
@Controller('payments/oauth')
export class MercadoPagoOAuthController {
  constructor(private readonly mpOAuthService: MercadoPagoOAuthService) {}

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post('initiate')
  @ApiOperation({
    summary: 'Iniciar proceso de vinculación OAuth con Mercado Pago',
    description:
      'Genera la URL de autorización para vincular una cuenta de Mercado Pago',
  })
  @ApiBody({ type: InitiateOAuthDto })
  @ApiResponse({
    status: 200,
    description: 'URL de autorización generada exitosamente',
    schema: {
      type: 'object',
      properties: {
        authorizationUrl: {
          type: 'string',
          description: 'URL para redirigir al usuario para autorización',
        },
        state: {
          type: 'string',
          description: 'Estado para validación de seguridad',
        },
      },
    },
  })
  async initiateOAuth(
    @Req() req: any,
    @Body() initiateOAuthDto: InitiateOAuthDto,
  ) {
    const userId = req.user.userId;

    // Generar state correcto para el callback GET
    const actualState =
      initiateOAuthDto.state || `user_${userId}_${Date.now()}`;

    const authorizationUrl = this.mpOAuthService.generateAuthorizationUrl(
      userId,
      initiateOAuthDto.redirectUri,
      actualState,
    );

    return {
      authorizationUrl,
      state: actualState, // Devolver el state que realmente se usa
      vinculation_id: userId,
    };
  }

  // @UseGuards(JwtAuthGuard)
  @Post('callback')
  @ApiOperation({
    summary: 'Manejar callback de autorización OAuth',
    description:
      'Procesa el código de autorización recibido de Mercado Pago y vincula la cuenta',
  })
  @ApiBody({ type: TokenExchangeDto })
  @ApiResponse({
    status: 200,
    description: 'Cuenta vinculada exitosamente',
    type: MercadoPagoAccount,
  })
  @ApiResponse({
    status: 409,
    description: 'El usuario ya tiene una cuenta de Mercado Pago vinculada',
  })
  async handleCallback(
    @Body() tokenExchangeDto: TokenExchangeDto,
  ): Promise<MercadoPagoAccount> {
    console.log(
      'OAuth callback received - Full body:',
      JSON.stringify(tokenExchangeDto, null, 2),
    );
    console.log('OAuth callback received - Summary:', {
      hasAuthCode: !!tokenExchangeDto.authorizationCode,
      authCodeLength: tokenExchangeDto.authorizationCode?.length,
      redirectUri: tokenExchangeDto.redirectUri,
      vinculationId: tokenExchangeDto.vinculation_id,
    });

    const userId = tokenExchangeDto.vinculation_id;

    if (!userId) {
      throw new BadRequestException('vinculation_id is required');
    }

    if (!tokenExchangeDto.authorizationCode) {
      throw new BadRequestException('authorizationCode is required');
    }

    if (!tokenExchangeDto.redirectUri) {
      throw new BadRequestException('redirectUri is required');
    }

    return await this.mpOAuthService.linkAccount(
      userId,
      tokenExchangeDto.authorizationCode,
      tokenExchangeDto.redirectUri,
    );
  }

  @Get('config-check')
  @ApiOperation({
    summary: 'Verificar configuración OAuth (solo desarrollo)',
    description:
      'Endpoint para verificar que las variables de entorno estén configuradas',
  })
  @ApiResponse({
    status: 200,
    description: 'Estado de configuración OAuth',
  })
  async checkOAuthConfig() {
    const clientId = process.env.MERCADO_PAGO_CLIENT_ID;
    const clientSecret = process.env.MERCADO_PAGO_CLIENT_SECRET;
    const redirectUri = process.env.MERCADO_PAGO_REDIRECT_URI;

    return {
      configured: !!clientId && !!clientSecret,
      hasClientId: !!clientId,
      hasClientSecret: !!clientSecret,
      hasRedirectUri: !!redirectUri,
      clientIdLength: clientId?.length || 0,
      redirectUri: redirectUri || 'not_configured',
    };
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('status')
  @ApiOperation({
    summary: 'Obtener estado de vinculación de Mercado Pago',
    description:
      'Verifica si el usuario tiene una cuenta de Mercado Pago vinculada',
  })
  @ApiResponse({
    status: 200,
    description: 'Estado de vinculación obtenido exitosamente',
    schema: {
      type: 'object',
      properties: {
        isLinked: {
          type: 'boolean',
          description: 'Indica si el usuario tiene una cuenta vinculada',
        },
        account: {
          type: 'object',
          description: 'Información de la cuenta vinculada (si existe)',
          nullable: true,
        },
      },
    },
  })
  async getOAuthStatus(@Req() req: any) {
    const userId = req.user.userId;
    const account = await this.mpOAuthService.getUserMercadoPagoAccount(userId);

    return {
      isLinked: !!account,
      account: account
        ? {
            id: account.id,
            collectorId: account.collectorId,
            email: account.email,
            nickname: account.nickname,
            country: account.country,
            status: account.status,
            createdAt: account.createdAt,
            // No incluir tokens por seguridad
          }
        : null,
    };
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post('unlink')
  @ApiOperation({
    summary: 'Desvincular cuenta de Mercado Pago',
    description: 'Desvincula la cuenta de Mercado Pago del usuario',
  })
  @ApiResponse({
    status: 200,
    description: 'Cuenta desvinculada exitosamente',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'Mensaje de confirmación',
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'No se encontró una cuenta vinculada',
  })
  async unlinkAccount(@Req() req: any) {
    const userId = req.user.userId;
    await this.mpOAuthService.unlinkAccount(userId);

    return {
      message: 'Cuenta de Mercado Pago desvinculada exitosamente',
    };
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post('refresh-token')
  @ApiOperation({
    summary: 'Refrescar token de acceso',
    description:
      'Refresca el token de acceso de Mercado Pago usando el refresh token',
  })
  @ApiResponse({
    status: 200,
    description: 'Token refrescado exitosamente',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'Mensaje de confirmación',
        },
        tokenExpiresAt: {
          type: 'string',
          format: 'date-time',
          description: 'Nueva fecha de expiración del token',
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'No se encontró una cuenta vinculada',
  })
  async refreshToken(@Req() req: any) {
    const userId = req.user.userId;
    const updatedAccount = await this.mpOAuthService.refreshAccessToken(userId);

    return {
      message: 'Token refrescado exitosamente',
      tokenExpiresAt: updatedAccount.tokenExpiresAt,
    };
  }

  /**
   * Endpoint público para manejar el callback de OAuth directamente desde MP
   * (opcional, para casos donde el frontend no puede manejar el callback)
   */
  @Get('callback')
  @ApiOperation({
    summary: 'Callback directo de Mercado Pago (público)',
    description:
      'Maneja el callback directo de Mercado Pago cuando no se puede manejar desde el frontend',
  })
  @ApiQuery({
    name: 'code',
    description: 'Código de autorización de Mercado Pago',
  })
  @ApiQuery({
    name: 'state',
    description: 'Estado para identificar al usuario',
  })
  @ApiResponse({
    status: 200,
    description: 'Redirección o mensaje de éxito',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        redirectUrl: { type: 'string' },
      },
    },
  })
  async handleDirectCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error?: string,
  ) {
    console.log('=== OAUTH GET CALLBACK RECEIVED ===');
    console.log('Query parameters:', {
      code: code?.substring(0, 10) + '...',
      state,
      error,
    });

    if (error) {
      console.log('OAuth error received:', error);
      return {
        success: false,
        message: `OAuth error: ${error}`,
        redirectUrl: `/oauth/error?error=${error}`,
      };
    }

    if (!code || !state) {
      console.log('Missing required parameters:', {
        hasCode: !!code,
        hasState: !!state,
      });
      throw new BadRequestException('Missing authorization code or state');
    }

    try {
      console.log('Attempting to extract userId from state:', state);

      // Extraer userId del state - ahora soporta ambos formatos
      let userId: string;

      // Formato nuevo: user_{userId}_{timestamp}
      const userStateMatch = state.match(/^user_([^_]+)_/);
      if (userStateMatch) {
        userId = userStateMatch[1];
        console.log('Found userId in user_ format:', userId);
      } else {
        // Formato del initiate actual: oauth_{timestamp} - necesitamos obtener el userId de otra manera
        console.log(
          'State does not match user_ format, checking for oauth_ format',
        );

        // Para el formato oauth_, necesitamos revisar si tenemos alguna forma de obtener el userId
        // Por ahora, vamos a loggear el error y arreglar el generateAuthorizationUrl
        throw new BadRequestException(
          `Invalid state format: ${state}. Expected format: user_{userId}_{timestamp}`,
        );
      }

      console.log('Using userId for linking:', userId);

      // Usar la misma redirect URI que se configuró en MP
      const redirectUri =
        'https://menucom-api-60e608ae2f99.herokuapp.com/payments/oauth/callback';

      console.log('Calling linkAccount with:', { userId, redirectUri });

      const account = await this.mpOAuthService.linkAccount(
        userId,
        code,
        redirectUri,
      );

      console.log('Account linked successfully:', {
        accountId: account.id,
        collectorId: account.collectorId,
      });

      return {
        success: true,
        message: 'Cuenta vinculada exitosamente',
        redirectUrl: '/dashboard?oauth=success',
        account: {
          id: account.id,
          collectorId: account.collectorId,
        },
      };
    } catch (error) {
      console.error('Error in OAuth callback:', error.message);
      return {
        success: false,
        message: `Error linking account: ${error.message}`,
        redirectUrl: '/dashboard?oauth=error',
      };
    }
  }
}
