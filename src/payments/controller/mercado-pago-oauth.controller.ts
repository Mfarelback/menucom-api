import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Req,
  Res,
  UseGuards,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt.auth.gards';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { Permission } from '../../auth/models/permissions.model';
import { MercadoPagoOAuthService } from '../services/mercado-pago-oauth.service';
import { InitiateOAuthDto, TokenExchangeDto } from '../dto/oauth.dto';
import { MercadoPagoAccount } from '../entities/mercado-pago-account.entity';

@ApiTags('Mercado Pago OAuth')
@Controller('payments/oauth')
export class MercadoPagoOAuthController {
  private readonly logger = new Logger(MercadoPagoOAuthController.name);

  constructor(
    private readonly mpOAuthService: MercadoPagoOAuthService,
    private readonly configService: ConfigService,
  ) {}

  private resolveCommerceId(req: any): string | null {
    return req.tenantId || req.user?.commerceId || null;
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.MANAGE_PAYMENTS)
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
    const commerceId = this.resolveCommerceId(req);

    const coreState = commerceId
      ? `user_${userId}_commerce_${commerceId}_${Date.now()}`
      : `user_${userId}_${Date.now()}`;

    const redirectUri = initiateOAuthDto.redirectUri;
    const redirectB64 = Buffer.from(redirectUri).toString('base64url');
    const state = `${coreState}___${redirectB64}`;

    const actualState = initiateOAuthDto.state || state;

    const authorizationUrl = this.mpOAuthService.generateAuthorizationUrl(
      userId,
      redirectUri,
      actualState,
      commerceId || undefined,
    );

    return {
      authorizationUrl,
      state: actualState,
      vinculation_id: userId,
      ...(commerceId && { commerceId }),
    };
  }

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
    this.logger.log('OAuth callback received');

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
      tokenExchangeDto.commerceId,
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

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.MANAGE_PAYMENTS)
  @ApiBearerAuth('JWT-auth')
  @Get('status')
  @ApiOperation({
    summary: 'Obtener estado de vinculación de Mercado Pago',
    description:
      'Verifica si el commerce tiene una cuenta de Mercado Pago vinculada',
  })
  @ApiResponse({
    status: 200,
    description: 'Estado de vinculación obtenido exitosamente',
    schema: {
      type: 'object',
      properties: {
        isLinked: {
          type: 'boolean',
          description: 'Indica si el commerce tiene una cuenta vinculada',
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
    const commerceId = this.resolveCommerceId(req);
    const userId = req.user.userId;

    let account: MercadoPagoAccount | null = null;

    if (commerceId) {
      account = await this.mpOAuthService.getUserMercadoPagoAccount(
        commerceId,
        true,
      );
    }

    if (!account) {
      account = await this.mpOAuthService.getUserMercadoPagoAccount(userId);
    }

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
          }
        : null,
    };
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.MANAGE_PAYMENTS)
  @ApiBearerAuth('JWT-auth')
  @Post('unlink')
  @ApiOperation({
    summary: 'Desvincular cuenta de Mercado Pago',
    description: 'Desvincula la cuenta de Mercado Pago del commerce',
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
    const commerceId = this.resolveCommerceId(req);

    if (commerceId) {
      await this.mpOAuthService.unlinkAccount(commerceId, true);
    } else {
      await this.mpOAuthService.unlinkAccount(req.user.userId);
    }

    return {
      message: 'Cuenta de Mercado Pago desvinculada exitosamente',
    };
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.MANAGE_PAYMENTS)
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
    const commerceId = this.resolveCommerceId(req);

    const updatedAccount = commerceId
      ? await this.mpOAuthService.refreshAccessToken(commerceId, true)
      : await this.mpOAuthService.refreshAccessToken(req.user.userId);

    return {
      message: 'Token refrescado exitosamente',
      tokenExpiresAt: updatedAccount.tokenExpiresAt,
    };
  }

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
    description: 'Estado para identificar al usuario y commerce',
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
    @Res() res: Response,
    @Query('error') error?: string,
  ) {
    this.logger.log('OAuth GET callback received');

    if (error) {
      this.logger.warn(`OAuth error received: ${error}`);
      const backUrl = this.configService.get('MP_BACK_URL') || '';
      return res.redirect(`${backUrl}/dashboard?oauth=error&error=${error}`);
    }

    if (!code || !state) {
      this.logger.warn('Missing required OAuth parameters');
      throw new BadRequestException('Missing authorization code or state');
    }

    try {
      let userId: string;
      let commerceId: string | undefined;
      let redirectUri: string;

      const stateParts = state.split('___');
      const coreState = stateParts[0];
      const redirectB64 = stateParts[1];

      if (redirectB64) {
        redirectUri = Buffer.from(redirectB64, 'base64url').toString();
        this.logger.log('redirectUri extraído del state');
      } else {
        redirectUri =
          this.configService.get('MERCADO_PAGO_REDIRECT_URI') ||
          this.configService.get('MP_REDIRECT_URI') ||
          'https://menucom-api.onrender.com/payments/oauth/callback';
        this.logger.log('redirectUri obtenido de configuración (legacy)');
      }

      // Nuevo formato: user_{userId}_commerce_{commerceId}_{timestamp}
      const newMatch = coreState.match(/^user_([^_]+)_commerce_([^_]+)_/);
      if (newMatch) {
        userId = newMatch[1];
        commerceId = newMatch[2];
        this.logger.log('UserId y CommerceId extraídos del state (formato nuevo)');
      } else {
        // Fallback a formato legacy: user_{userId}_{timestamp}
        const legacyMatch = coreState.match(/^user_([^_]+)_/);
        if (legacyMatch) {
          userId = legacyMatch[1];
          this.logger.log('UserId extraído del state (formato legacy)');
        } else {
          throw new BadRequestException(
            `Invalid state format: ${state}. Expected format: user_{userId}_{timestamp} o user_{userId}_commerce_{commerceId}_{timestamp}`,
          );
        }
      }

      this.logger.log(
        `Vinculando cuenta OAuth para userId: ${userId}, commerceId: ${commerceId || 'none'}`,
      );

      const account = await this.mpOAuthService.linkAccount(
        userId,
        code,
        redirectUri,
        commerceId,
      );

      this.logger.log(`Cuenta vinculada exitosamente: ${account.id}`);

      const backUrl = this.configService.get('MP_BACK_URL') || '';
      return res.redirect(`${backUrl}/dashboard?oauth=success`);
    } catch (error) {
      this.logger.error(
        'Error en OAuth callback',
        error instanceof Error ? error.stack : undefined,
      );
      const backUrl = this.configService.get('MP_BACK_URL') || '';
      return res.redirect(
        `${backUrl}/dashboard?oauth=error&message=${encodeURIComponent(error.message)}`,
      );
    }
  }
}
