import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { GlobalExceptionFilter } from './core/interceptors/global-exception.filter';
import { LoggerService } from './core/logger/logger.service';
import helmet from 'helmet';
import * as express from 'express';

function validateEnvVars(): void {
  const requiredSecrets: { name: string; validation?: (val: string) => boolean; hint: string }[] = [
    {
      name: 'MP_WEBHOOK_SECRET',
      hint: 'Configúralo en el archivo .env con el secreto del webhook de MercadoPago',
    },
    {
      name: 'TICKET_QR_SECRET',
      validation: (val) => val !== 'default-secret-change-in-production',
      hint: 'Configúralo en el archivo .env con un valor seguro (diferente del default)',
    },
    {
      name: 'ALLOWED_ORIGINS',
      hint: 'Configúralo en el archivo .env con los orígenes permitidos separados por coma (ej: http://localhost:3000,https://midominio.com)',
    },
  ];

  for (const secret of requiredSecrets) {
    const value = process.env[secret.name];
    if (!value) {
      throw new Error(
        `ERROR FATAL: ${secret.name} no está configurado. ${secret.hint}`,
      );
    }
    if (secret.validation && !secret.validation(value)) {
      throw new Error(
        `ERROR FATAL: ${secret.name} tiene un valor inseguro (default). ${secret.hint}`,
      );
    }
  }
}

async function bootstrap() {
  try {
    validateEnvVars();

    const app = await NestFactory.create(AppModule, { bodyParser: false });
    app.getHttpAdapter().getInstance().use(express.json({ limit: '1mb' }));
    app.getHttpAdapter().getInstance().use(express.urlencoded({ extended: true, limit: '1mb' }));

    const loggerService = app.get(LoggerService);

    app.useGlobalFilters(new GlobalExceptionFilter(loggerService));

    const config = new DocumentBuilder()
      .setTitle('Menu Com')
      .setDescription('Control de comedores y menú')
      .setVersion('1.0')
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document);
    const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(',');
    app.enableCors({ origin: allowedOrigins, credentials: true });

    app.use(helmet());

    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
        whitelist: true,
      }),
    );

    const expressInstance = app.getHttpAdapter().getInstance();

    expressInstance.use((req: any, res: any, next: any) => {
      if (req.url === '/' || req.url === '/favicon.ico') {
        return res.redirect(302, '/docs');
      }
      next();
    });

    await app.listen(process.env.PORT || 3001);
  } catch (error) {
    console.error('Error al iniciar la aplicación:', error);
    process.exit(1);
  }
}
bootstrap();
