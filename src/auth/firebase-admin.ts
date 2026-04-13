import * as admin from 'firebase-admin';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';
import * as fs from 'fs';

export class FirebaseAdmin {
  private static instance: admin.app.App;

  static initialize(configService: ConfigService): admin.app.App {
    if (!FirebaseAdmin.instance) {
      try {
        let serviceAccount: admin.ServiceAccount;

        const configPath = path.join(process.cwd(), 'menucom-gconfig.json');

        if (fs.existsSync(configPath)) {
          console.log('🔥 Cargando configuración de Firebase desde archivo local');
          const configFile = fs.readFileSync(configPath, 'utf8');
          serviceAccount = JSON.parse(configFile) as admin.ServiceAccount;
        } else {
          console.log('🔥 Cargando configuración de Firebase desde variables de entorno');
          serviceAccount = {
            projectId: configService.get<string>('FIREBASE_PROJECT_ID'),
            privateKey: configService
              .get<string>('FIREBASE_PRIVATE_KEY')
              ?.replace(/\\n/g, '\n'),
            clientEmail: configService.get<string>('FIREBASE_CLIENT_EMAIL'),
          };

          const isPlaceholder =
            serviceAccount.projectId === 'PLACEHOLDER' ||
            serviceAccount.privateKey === 'PLACEHOLDER' ||
            serviceAccount.privateKey === 'PLACEHOLDER_NEED_REAL_KEY';

          if (isPlaceholder) {
            console.log('⚠️ Firebase configurado con placeholder (omitiendo inicialización)');
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
        }

        FirebaseAdmin.instance = admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId: serviceAccount.projectId,
        });

        console.log(
          `🔥 Firebase Admin inicializado para proyecto: ${serviceAccount.projectId}`,
        );
      } catch (error) {
        console.error('❌ Error al inicializar Firebase Admin:', error);
        console.log('⚠️ Omitiendo Firebase (continuando sin él)');
        return null;
      }
    }

    return FirebaseAdmin.instance;
  }

  static getInstance(): admin.app.App {
    if (!FirebaseAdmin.instance) {
      throw new Error('Firebase Admin not initialized');
    }
    return FirebaseAdmin.instance;
  }

  static async verifyIdToken(
    idToken: string,
  ): Promise<admin.auth.DecodedIdToken> {
    if (!FirebaseAdmin.instance) {
      throw new Error('Firebase not initialized');
    }
    return FirebaseAdmin.getInstance().auth().verifyIdToken(idToken);
  }

  static getProjectInfo(): { projectId: string; initialized: boolean } {
    try {
      const app = FirebaseAdmin.getInstance();
      return { projectId: app.options.projectId || 'unknown', initialized: true };
    } catch {
      return { projectId: 'not-initialized', initialized: false };
    }
  }
}