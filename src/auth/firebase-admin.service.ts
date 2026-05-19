import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class FirebaseAdminService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseAdminService.name);
  private firebaseApp: admin.app.App | null = null;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    this.initialize();
  }

  private initialize(): admin.app.App | null {
    if (this.firebaseApp) return this.firebaseApp;

    try {
      let serviceAccount: admin.ServiceAccount;

      // Intentar cargar desde archivo local primero (útil para desarrollo)
      const configPath =
        this.configService.get<string>('FIREBASE_CONFIG_PATH') ||
        path.join(process.cwd(), 'menucom-gconfig.json');

      if (fs.existsSync(configPath)) {
        this.logger.log(
          `🔥 Cargando configuración de Firebase desde: ${configPath}`,
        );
        const configFile = fs.readFileSync(configPath, 'utf8');
        serviceAccount = JSON.parse(configFile) as admin.ServiceAccount;
      } else {
        this.logger.log(
          '🔥 Cargando configuración de Firebase desde variables de entorno',
        );
        serviceAccount = {
          projectId: this.configService.get<string>('FIREBASE_PROJECT_ID'),
          privateKey: this.configService
            .get<string>('FIREBASE_PRIVATE_KEY')
            ?.replace(/\\n/g, '\n'),
          clientEmail: this.configService.get<string>('FIREBASE_CLIENT_EMAIL'),
        };

        const isPlaceholder =
          !serviceAccount.projectId ||
          serviceAccount.projectId === 'PLACEHOLDER' ||
          serviceAccount.projectId === 'dummy' ||
          !serviceAccount.privateKey ||
          serviceAccount.privateKey === 'PLACEHOLDER' ||
          serviceAccount.privateKey === 'dummy' ||
          serviceAccount.privateKey === 'PLACEHOLDER_NEED_REAL_KEY' ||
          !serviceAccount.clientEmail ||
          serviceAccount.clientEmail === 'PLACEHOLDER' ||
          serviceAccount.clientEmail === 'dummy';

        if (isPlaceholder) {
          this.logger.warn(
            '⚠️ Firebase configurado con placeholder o incompleto (omitiendo inicialización)',
          );
          return null;
        }
      }

      // Evitar inicializar múltiples veces con el mismo nombre
      const apps = admin.apps;
      const existingApp = apps.find((app) => app.name === '[DEFAULT]');

      if (existingApp) {
        this.firebaseApp = existingApp;
      } else {
        this.firebaseApp = admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId: serviceAccount.projectId,
        });
      }

      this.logger.log(
        `🔥 Firebase Admin inicializado para proyecto: ${serviceAccount.projectId}`,
      );
      return this.firebaseApp;
    } catch (error) {
      this.logger.error(
        '❌ Error al inicializar Firebase Admin:',
        error instanceof Error ? error.message : String(error),
      );
      this.logger.warn('⚠️ Omitiendo Firebase (continuando sin él)');
      return null;
    }
  }

  getApp(): admin.app.App {
    if (!this.firebaseApp) {
      throw new Error(
        'Firebase Admin not initialized. Check your configuration.',
      );
    }
    return this.firebaseApp;
  }

  isInitialized(): boolean {
    return this.firebaseApp !== null;
  }

  async verifyIdToken(idToken: string): Promise<admin.auth.DecodedIdToken> {
    return this.getApp().auth().verifyIdToken(idToken);
  }

  get messaging() {
    return this.getApp().messaging();
  }

  get auth() {
    return this.getApp().auth();
  }
}
