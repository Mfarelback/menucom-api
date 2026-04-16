import * as admin from 'firebase-admin';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Configuración e inicialización de Firebase Admin SDK
 * Utiliza archivo de configuración local o variables de entorno
 */
export class FirebaseAdmin {
  private static instance: admin.app.App;

  /**
   * Inicializa Firebase Admin con archivo de configuración o variables de entorno
   * @param configService - Servicio de configuración de NestJS
   */
  static initialize(configService: ConfigService): admin.app.App {
    if (!FirebaseAdmin.instance) {
      try {
        let serviceAccount: admin.ServiceAccount;

        // Primero intentar cargar desde archivo local (desarrollo)
        const configPath = path.join(process.cwd(), 'menucom-gconfig.json');

        if (fs.existsSync(configPath)) {
          console.log(
            '🔥 Cargando configuración de Firebase desde archivo local',
          );
          const configFile = fs.readFileSync(configPath, 'utf8');
          serviceAccount = JSON.parse(configFile) as admin.ServiceAccount;
        } else {
          // Fallback a variables de entorno (producción)
          console.log(
            '🔥 Cargando configuración de Firebase desde variables de entorno',
          );
          serviceAccount = {
            projectId: configService.get<string>('FIREBASE_PROJECT_ID'),
            privateKey: configService
              .get<string>('FIREBASE_PRIVATE_KEY')
              ?.replace(/\\n/g, '\n'),
            clientEmail: configService.get<string>('FIREBASE_CLIENT_EMAIL'),
          };

          // Validar que todas las variables estén presentes
          const isDummy =
            serviceAccount.projectId === 'dummy' ||
            serviceAccount.privateKey === 'dummy' ||
            serviceAccount.clientEmail === 'dummy';

          if (isDummy) {
            console.log(
              '⚠️ Firebase configurado en modo dummy (omitiendo inicialización)',
            );
            return null;
          }

          if (
            !serviceAccount.projectId ||
            !serviceAccount.privateKey ||
            !serviceAccount.clientEmail
          ) {
            console.log('⚠️ Firebase no configurado (inicialización omitida)');
            return null;
          }

          return null;

          if (
            !serviceAccount.projectId ||
            !serviceAccount.privateKey ||
            !serviceAccount.clientEmail
          ) {
            console.log('⚠️ Firebase no configurado (inicialización omitida)');
            return null;
          }
        }

        FirebaseAdmin.instance = admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId: serviceAccount.projectId,
        });

        console.log(
          `🔥 Firebase Admin inicializado exitosamente para proyecto: ${serviceAccount.projectId}`,
        );
      } catch (error) {
        console.error('❌ Error al inicializar Firebase Admin:', error);
        throw new Error(
          `Firebase Admin initialization failed: ${error.message}`,
        );
      }
    }

    return FirebaseAdmin.instance;
  }

  /**
   * Obtiene la instancia de Firebase Admin
   * @returns Instancia de Firebase Admin
   */
  static getInstance(): admin.app.App {
    if (!FirebaseAdmin.instance) {
      throw new Error(
        'Firebase Admin not initialized. Call initialize() first.',
      );
    }
    return FirebaseAdmin.instance;
  }

  /**
   * Verifica un ID Token de Firebase
   * @param idToken - Token ID de Firebase
   * @returns Promise con los datos decodificados del token
   */
  static async verifyIdToken(
    idToken: string,
  ): Promise<admin.auth.DecodedIdToken> {
    console.log('🔥 [FIREBASE ADMIN] Iniciando verificación de ID Token');
    console.log(
      '📏 [FIREBASE ADMIN] Longitud del token:',
      idToken?.length || 0,
    );

    try {
      const startTime = Date.now();
      console.log(
        '⏳ [FIREBASE ADMIN] Enviando token a Firebase para verificación...',
      );

      const decodedToken = await FirebaseAdmin.getInstance()
        .auth()
        .verifyIdToken(idToken);

      const endTime = Date.now();
      console.log(
        `✅ [FIREBASE ADMIN] Token verificado en ${endTime - startTime}ms`,
      );
      console.log('🔓 [FIREBASE ADMIN] Token decodificado exitosamente:', {
        uid: decodedToken.uid,
        email: decodedToken.email,
        email_verified: decodedToken.email_verified,
        provider: decodedToken.firebase?.sign_in_provider,
        iss: decodedToken.iss,
        aud: decodedToken.aud,
        exp: new Date(decodedToken.exp * 1000).toISOString(),
        iat: new Date(decodedToken.iat * 1000).toISOString(),
      });

      return decodedToken;
    } catch (error) {
      console.error('❌ [FIREBASE ADMIN] Error verifying Firebase ID token:', {
        message: error.message,
        code: error.code,
        tokenLength: idToken?.length || 0,
        tokenPreview: idToken?.substring(0, 20) + '...',
      });

      // Proporcionar errores más específicos
      if (error.code === 'auth/id-token-expired') {
        console.error('⏰ [FIREBASE ADMIN] Token expirado');
        throw new Error('Firebase ID token expired');
      }
      if (error.code === 'auth/id-token-revoked') {
        console.error('🚫 [FIREBASE ADMIN] Token revocado');
        throw new Error('Firebase ID token revoked');
      }
      if (error.code === 'auth/invalid-id-token') {
        console.error('🔴 [FIREBASE ADMIN] Token inválido');
        throw new Error('Invalid Firebase ID token');
      }
      if (error.code === 'auth/project-not-found') {
        console.error('🏗️ [FIREBASE ADMIN] Proyecto no encontrado');
        throw new Error('Firebase project not found');
      }

      console.error('💥 [FIREBASE ADMIN] Error genérico en verificación');
      throw new Error(`Firebase token verification failed: ${error.message}`);
    }
  }

  /**
   * Obtiene información del proyecto Firebase
   * @returns Información básica del proyecto
   */
  static getProjectInfo(): { projectId: string; initialized: boolean } {
    try {
      const app = FirebaseAdmin.getInstance();
      return {
        projectId: app.options.projectId || 'unknown',
        initialized: true,
      };
    } catch (error) {
      return {
        projectId: 'not-initialized',
        initialized: false,
      };
    }
  }
}
