import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { MercadoPagoAccount } from '../entities/mercado-pago-account.entity';
import { Commerce } from '../../commerce/entities/commerce.entity';

@Injectable()
export class MercadoPagoOAuthService {
  private readonly logger = new Logger(MercadoPagoOAuthService.name);
  private readonly baseUrl: string;
  private readonly clientId: string;
  private readonly clientSecret: string;

  constructor(
    @InjectRepository(MercadoPagoAccount)
    private readonly mpAccountRepository: Repository<MercadoPagoAccount>,
    @InjectRepository(Commerce)
    private readonly commerceRepository: Repository<Commerce>,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl = 'https://api.mercadopago.com';
    this.clientId = this.configService.get<string>('MERCADO_PAGO_CLIENT_ID');
    this.clientSecret = this.configService.get<string>(
      'MERCADO_PAGO_CLIENT_SECRET',
    );

    if (!this.clientId || !this.clientSecret) {
      this.logger.warn('Mercado Pago OAuth credentials not configured');
    }
  }

  /**
   * Genera la URL de autorización OAuth para Mercado Pago
   */
  generateAuthorizationUrl(
    userId: string,
    redirectUri: string,
    state?: string,
    commerceId?: string,
  ): string {
    if (!this.clientId) {
      throw new BadRequestException('OAuth not configured');
    }

    const defaultState = commerceId
      ? `user_${userId}_commerce_${commerceId}_${Date.now()}`
      : `user_${userId}_${Date.now()}`;

    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'code',
      platform_id: 'mp',
      redirect_uri: redirectUri,
      state: state || defaultState,
    });

    const authUrl = `https://auth.mercadopago.com/authorization?${params.toString()}`;

    this.logger.log(`Generated OAuth URL for user ${userId}: ${authUrl}`);

    return authUrl;
  }

  /**
   * Intercambia el código de autorización por tokens de acceso
   */
  async exchangeCodeForTokens(code: string, redirectUri: string): Promise<any> {
    try {
      this.logger.log(
        `Exchanging code for tokens - Code: ${code.substring(
          0,
          10,
        )}..., RedirectUri: ${redirectUri}`,
      );

      const payload = {
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri,
      };

      this.logger.log(
        `Token exchange payload: ${JSON.stringify({
          ...payload,
          client_secret: '***HIDDEN***',
        })}`,
      );

      const response = await axios.post(`${this.baseUrl}/oauth/token`, payload);

      this.logger.log('Successfully exchanged code for tokens');
      return response.data;
    } catch (error) {
      this.logger.error(
        'Error exchanging code for tokens:',
        JSON.stringify({
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          message: error.message,
        }),
      );
      throw new BadRequestException(
        `Failed to exchange authorization code: ${
          error.response?.data?.message || error.message
        }`,
      );
    }
  }

  /**
   * Obtiene información del usuario usando el access token
   */
  async getUserInfo(accessToken: string): Promise<any> {
    try {
      const response = await axios.get(`${this.baseUrl}/users/me`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      return response.data;
    } catch (error) {
      this.logger.error(
        'Error fetching user info:',
        error.response?.data || error.message,
      );
      throw new BadRequestException('Failed to fetch user information');
    }
  }

  /**
   * Vincula una cuenta de Mercado Pago con un usuario
   */
  async linkAccount(
    userId: string,
    authorizationCode: string,
    redirectUri: string,
    commerceId?: string,
  ): Promise<MercadoPagoAccount> {
    this.logger.log(
      `Starting OAuth account linking for user: ${userId}, commerce: ${commerceId || 'none'}, redirectUri: ${redirectUri}`,
    );

    // Verificar configuración OAuth
    if (!this.clientId || !this.clientSecret) {
      throw new BadRequestException(
        'OAuth not configured. Missing CLIENT_ID or CLIENT_SECRET',
      );
    }

    // Verificar si ya existe una cuenta vinculada para este commerce o usuario
    let existingAccount: MercadoPagoAccount | null = null;

    if (commerceId) {
      existingAccount = await this.mpAccountRepository.findOne({
        where: { commerceId },
      });
    }

    if (!existingAccount) {
      existingAccount = await this.mpAccountRepository.findOne({
        where: { userId },
      });
    }

    if (existingAccount && existingAccount.isActive) {
      this.logger.warn(
        `User ${userId} already has a linked MP account for commerce ${commerceId}`,
      );
      throw new ConflictException(
        'User already has a linked Mercado Pago account for this commerce',
      );
    }

    try {
      this.logger.log(`Exchanging authorization code for user ${userId}`);

      // Intercambiar código por tokens
      const tokenData = await this.exchangeCodeForTokens(
        authorizationCode,
        redirectUri,
      );

      this.logger.log(`Token exchange successful for user ${userId}`);

      // Obtener información del usuario de MP
      const userInfo = await this.getUserInfo(tokenData.access_token);

      // Calcular fecha de expiración del token
      const tokenExpiresAt = new Date();
      tokenExpiresAt.setSeconds(
        tokenExpiresAt.getSeconds() + tokenData.expires_in,
      );

      // Crear o actualizar la cuenta
      const accountData: Partial<MercadoPagoAccount> = {
        userId,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        collectorId: userInfo.id.toString(),
        publicKey: tokenData.public_key,
        country: userInfo.country_id,
        email: userInfo.email,
        nickname: userInfo.nickname,
        status: 'active',
        tokenExpiresAt,
        metadata: {
          siteId: userInfo.site_id,
          firstName: userInfo.first_name,
          lastName: userInfo.last_name,
          identification: userInfo.identification,
        },
        isActive: true,
      };

      if (commerceId) {
        accountData.commerceId = commerceId;
      }

      let mpAccount: MercadoPagoAccount;

      if (existingAccount) {
        // Actualizar cuenta existente
        Object.assign(existingAccount, accountData);
        mpAccount = await this.mpAccountRepository.save(existingAccount);
        this.logger.log(`Updated MP account for user ${userId}`);
      } else {
        // Crear nueva cuenta
        mpAccount = this.mpAccountRepository.create(accountData);
        mpAccount = await this.mpAccountRepository.save(mpAccount);
        this.logger.log(`Created new MP account for user ${userId}`);
      }

      return mpAccount;
    } catch (error) {
      this.logger.error(`Error linking MP account for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Refresca el token de acceso usando el refresh token
   */
  async refreshAccessToken(
    identifier: string,
    byCommerceId: boolean = false,
  ): Promise<MercadoPagoAccount> {
    const account = await this.getUserMercadoPagoAccount(
      identifier,
      byCommerceId,
    );

    if (!account || !account.refreshToken) {
      throw new NotFoundException(
        'No active Mercado Pago account found',
      );
    }

    try {
      const response = await axios.post(`${this.baseUrl}/oauth/token`, {
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: 'refresh_token',
        refresh_token: account.refreshToken,
      });

      const tokenData = response.data;

      account.accessToken = tokenData.access_token;
      if (tokenData.refresh_token) {
        account.refreshToken = tokenData.refresh_token;
      }

      const tokenExpiresAt = new Date();
      tokenExpiresAt.setSeconds(
        tokenExpiresAt.getSeconds() + tokenData.expires_in,
      );
      account.tokenExpiresAt = tokenExpiresAt;

      const updatedAccount = await this.mpAccountRepository.save(account);

      this.logger.log(
        `Refreshed access token for ${byCommerceId ? 'commerce' : 'user'} ${identifier}`,
      );

      return updatedAccount;
    } catch (error) {
      this.logger.error(
        `Error refreshing token for ${identifier}:`,
        error.response?.data || error.message,
      );
      throw new BadRequestException('Failed to refresh access token');
    }
  }

  /**
   * Obtiene la cuenta de Mercado Pago de un usuario o commerce
   */
  async getUserMercadoPagoAccount(
    identifier: string,
    byCommerceId: boolean = false,
  ): Promise<MercadoPagoAccount | null> {
    if (byCommerceId) {
      return this.getAccountByCommerce(identifier);
    }
    return this.mpAccountRepository.findOne({
      where: { userId: identifier, isActive: true },
    });
  }

  /**
   * Desvincula la cuenta de Mercado Pago de un usuario o commerce
   */
  async unlinkAccount(
    identifier: string,
    byCommerceId: boolean = false,
  ): Promise<void> {
    const where = byCommerceId
      ? { commerceId: identifier, isActive: true }
      : { userId: identifier, isActive: true };

    const account = await this.mpAccountRepository.findOne({ where });

    if (!account) {
      throw new NotFoundException(
        'No active Mercado Pago account found',
      );
    }

    account.isActive = false;
    account.status = 'inactive';
    await this.mpAccountRepository.save(account);

    this.logger.log(
      `Unlinked MP account for ${byCommerceId ? 'commerce' : 'user'} ${identifier}`,
    );
  }

  /**
   * Verifica si el token está próximo a expirar
   */
  async isTokenExpiringSoon(
    identifier: string,
    minutesThreshold: number = 30,
    byCommerceId: boolean = false,
  ): Promise<boolean> {
    const account = await this.getUserMercadoPagoAccount(
      identifier,
      byCommerceId,
    );

    if (!account || !account.tokenExpiresAt) {
      return false;
    }

    const now = new Date();
    const expirationTime = account.tokenExpiresAt;
    const timeDifference = expirationTime.getTime() - now.getTime();
    const minutesUntilExpiration = timeDifference / (1000 * 60);

    return minutesUntilExpiration <= minutesThreshold;
  }

  /**
   * Obtiene el access token válido para un usuario o commerce (renovándolo si es necesario)
   */
  async getValidAccessToken(
    identifier: string,
    byCommerceId: boolean = false,
  ): Promise<string> {
    let account = await this.getUserMercadoPagoAccount(
      identifier,
      byCommerceId,
    );

    if (!account) {
      throw new NotFoundException(
        'No Mercado Pago account linked',
      );
    }

    if (await this.isTokenExpiringSoon(identifier, 30, byCommerceId)) {
      this.logger.log(`Token expiring soon for ${identifier}, refreshing...`);
      account = await this.refreshAccessToken(identifier, byCommerceId);
    }

    return account.accessToken;
  }

  /**
   * Obtiene el collector_id de la cuenta de MercadoPago vinculada para un usuario
   * @param userId ID del usuario
   * @returns collector_id como número o null si no tiene cuenta vinculada
   */
  async getCollectorIdByUserId(userId: string): Promise<number | null> {
    try {
      const account = await this.mpAccountRepository.findOne({
        where: { userId, isActive: true },
      });

      if (!account) {
        this.logger.warn(
          `No active MercadoPago account found for user ${userId}`,
        );
        return null;
      }

      this.logger.log(
        `Found collector_id ${account.collectorId} for user ${userId}`,
      );
      // Convertir a número ya que MercadoPago lo espera como number
      return parseInt(account.collectorId, 10);
    } catch (error) {
      this.logger.error(
        `Error getting collector_id for user ${userId}:`,
        error,
      );
      throw new BadRequestException('Error getting collector ID');
    }
  }

  /**
   * Obtiene los datos completos de la cuenta para crear preferencias
   * @param userId ID del usuario
   * @returns Datos de la cuenta o null si no existe
   */
  async getAccountDataForPreference(userId: string): Promise<{
    collectorId: number;
    accessToken: string;
  } | null> {
    try {
      const account = await this.mpAccountRepository.findOne({
        where: { userId, isActive: true },
      });

      if (!account) {
        this.logger.warn(
          `No active MercadoPago account found for user ${userId}`,
        );
        return null;
      }

      this.logger.log(
        `Found account data for user ${userId}: collector_id=${account.collectorId}`,
      );

      return {
        collectorId: parseInt(account.collectorId, 10),
        accessToken: account.accessToken,
      };
    } catch (error) {
      this.logger.error(
        `Error getting account data for user ${userId}:`,
        error,
      );
      throw new BadRequestException('Error getting account data');
    }
  }

  async getAccountByCommerce(
    commerceId: string,
  ): Promise<MercadoPagoAccount | null> {
    let account = await this.mpAccountRepository.findOne({
      where: { commerceId, isActive: true },
    });

    if (!account) {
      const commerce = await this.commerceRepository.findOne({
        where: { id: commerceId },
      });
      if (commerce?.ownerId) {
        account = await this.mpAccountRepository.findOne({
          where: { userId: commerce.ownerId, isActive: true },
        });
      }
    }

    return account;
  }

  async getAccountDataForPreferenceByCommerce(commerceId: string): Promise<{
    collectorId: number;
    accessToken: string;
  } | null> {
    const account = await this.getAccountByCommerce(commerceId);
    if (!account) {
      this.logger.warn(
        `No active MercadoPago account found for commerce ${commerceId}`,
      );
      return null;
    }

    this.logger.log(
      `Found account data for commerce ${commerceId}: collector_id=${account.collectorId}`,
    );

    return {
      collectorId: parseInt(account.collectorId, 10),
      accessToken: account.accessToken,
    };
  }

  async getCollectorIdByCommerce(commerceId: string): Promise<number | null> {
    const account = await this.getAccountByCommerce(commerceId);
    if (!account) return null;
    return parseInt(account.collectorId, 10);
  }
}
