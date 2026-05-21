import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-custom';
import { Request } from 'express';
import { FirebaseAdminService } from '../firebase-admin.service';

/**
 * Estrategia personalizada para autenticación con Google ID Token
 * Utiliza Firebase Admin SDK para verificar tokens de Google/Firebase
 */
@Injectable()
export class GoogleIdTokenStrategy extends PassportStrategy(
  Strategy,
  'google-id',
) {
  private readonly logger = new Logger(GoogleIdTokenStrategy.name);

  constructor(private firebaseAdminService: FirebaseAdminService) {
    super((req: Request, done: any) => {
      this.validate(req)
        .then((user) => done(null, user))
        .catch((error) => done(error, null));
    });
  }

  /**
   * Valida el Google ID Token enviado en el header Authorization
   * @param req - Request object de Express
   * @returns Promise con los datos del usuario extraídos del token
   */
  async validate(req: Request): Promise<any> {
    this.logger.log('Iniciando validación de token Google');

    try {
      const authHeader = req.headers['authorization'];
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        this.logger.warn('Token de autorización no encontrado o formato inválido');
        throw new UnauthorizedException(
          'Token de autorización no encontrado o formato inválido',
        );
      }

      const idToken = authHeader.replace('Bearer ', '').trim();
      if (!idToken) {
        this.logger.warn('Token ID vacío');
        throw new UnauthorizedException('Token ID vacío');
      }

      this.logger.log('Token extraído, verificando con Firebase...');

      const decodedToken =
        await this.firebaseAdminService.verifyIdToken(idToken);
      this.logger.log('Token verificado exitosamente');

      if (!decodedToken.email_verified && decodedToken.email) {
        this.logger.warn(
          `Usuario con email no verificado: ${decodedToken.email}`,
        );
      }

      const userData = {
        uid: decodedToken.uid,
        email: decodedToken.email,
        name: decodedToken.name || decodedToken.email?.split('@')[0],
        picture: decodedToken.picture,
        phone: decodedToken.phone_number,
        email_verified: decodedToken.email_verified,
        firebaseProvider: decodedToken.firebase?.sign_in_provider,
        auth_time: decodedToken.auth_time,
        exp: decodedToken.exp,
        iat: decodedToken.iat,
      };

      this.logger.log(
        `Token de Google verificado exitosamente para: ${userData.email}`,
      );

      return userData;
    } catch (error) {
      this.logger.error(
        'Error en GoogleIdTokenStrategy',
        error instanceof Error ? error.stack : undefined,
      );

      if (error.code === 'auth/id-token-expired') {
        throw new UnauthorizedException('Token ID expirado');
      }

      if (error.code === 'auth/id-token-revoked') {
        throw new UnauthorizedException('Token ID revocado');
      }

      if (error.code === 'auth/invalid-id-token') {
        throw new UnauthorizedException('Token ID inválido');
      }

      throw new UnauthorizedException(
        'Error al verificar el token de autenticación',
      );
    }
  }
}
