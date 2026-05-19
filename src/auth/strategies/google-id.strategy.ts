import { Injectable, UnauthorizedException } from '@nestjs/common';
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
    console.log('🔐 [GOOGLE STRATEGY] Iniciando validación de token');
    console.log('📋 [GOOGLE STRATEGY] Headers disponibles:', {
      authorization: req.headers['authorization']
        ? '***TOKEN_PRESENTE***'
        : 'NO_TOKEN',
      'user-agent': req.headers['user-agent']?.substring(0, 50) + '...',
      'content-type': req.headers['content-type'],
    });

    try {
      // Extraer el token del header Authorization
      const authHeader = req.headers['authorization'];
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.error(
          '❌ [GOOGLE STRATEGY] Token de autorización no encontrado o formato inválido',
        );
        throw new UnauthorizedException(
          'Token de autorización no encontrado o formato inválido',
        );
      }

      const idToken = authHeader.replace('Bearer ', '').trim();
      if (!idToken) {
        console.error('❌ [GOOGLE STRATEGY] Token ID vacío');
        throw new UnauthorizedException('Token ID vacío');
      }

      console.log(
        '🔍 [GOOGLE STRATEGY] Token extraído, verificando con Firebase...',
      );
      console.log('📏 [GOOGLE STRATEGY] Longitud del token:', idToken.length);

      // Verificar el token con Firebase Admin SDK
      const decodedToken =
        await this.firebaseAdminService.verifyIdToken(idToken);
      console.log('✅ [GOOGLE STRATEGY] Token verificado exitosamente');
      console.log('👤 [GOOGLE STRATEGY] Información del token decodificado:', {
        uid: decodedToken.uid,
        email: decodedToken.email,
        email_verified: decodedToken.email_verified,
        name: decodedToken.name,
        picture: decodedToken.picture ? 'FOTO_PRESENTE' : 'SIN_FOTO',
        firebase_provider: decodedToken.firebase?.sign_in_provider,
        auth_time: new Date(decodedToken.auth_time * 1000).toISOString(),
        exp: new Date(decodedToken.exp * 1000).toISOString(),
      });

      // Validar que el token tenga email verificado (opcional)
      if (!decodedToken.email_verified && decodedToken.email) {
        console.warn(
          `⚠️ [GOOGLE STRATEGY] Usuario con email no verificado: ${decodedToken.email}`,
        );
        // Nota: Puedes decidir si permitir o rechazar usuarios con email no verificado
      }

      // Estructurar los datos del usuario
      const userData = {
        uid: decodedToken.uid,
        email: decodedToken.email,
        name: decodedToken.name || decodedToken.email?.split('@')[0],
        picture: decodedToken.picture,
        phone: decodedToken.phone_number,
        email_verified: decodedToken.email_verified,
        firebaseProvider: decodedToken.firebase?.sign_in_provider,
        // Metadata adicional
        auth_time: decodedToken.auth_time,
        exp: decodedToken.exp,
        iat: decodedToken.iat,
      };

      console.log(
        `✅ [GOOGLE STRATEGY] Token de Google verificado exitosamente para: ${userData.email}`,
      );
      console.log(
        '🚀 [GOOGLE STRATEGY] Datos del usuario preparados para AuthService',
      );

      return userData;
    } catch (error) {
      console.error('❌ [GOOGLE STRATEGY] Error en GoogleIdTokenStrategy:', {
        message: error instanceof Error ? error.message : String(error),
        code: error instanceof Error ? (error as any).code : String(error),
        stack: (error instanceof Error ? error.stack : String(error))?.substring(0, 200) + '...',
      });

      if (error.code === 'auth/id-token-expired') {
        console.error('⏰ [GOOGLE STRATEGY] Token ID expirado');
        throw new UnauthorizedException('Token ID expirado');
      }

      if (error.code === 'auth/id-token-revoked') {
        console.error('🚫 [GOOGLE STRATEGY] Token ID revocado');
        throw new UnauthorizedException('Token ID revocado');
      }

      if (error.code === 'auth/invalid-id-token') {
        console.error('🔴 [GOOGLE STRATEGY] Token ID inválido');
        throw new UnauthorizedException('Token ID inválido');
      }

      // Error genérico para cualquier otro problema
      console.error(
        '💥 [GOOGLE STRATEGY] Error genérico en validación de token',
      );
      throw new UnauthorizedException(
        'Error al verificar el token de autenticación',
      );
    }
  }
}
