import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { GlobalExceptionFilter } from './core/interceptors/global-exception.filter';
import { LoggerService } from './core/logger/logger.service';

async function bootstrap() {
  try {
    const app = await NestFactory.create(AppModule);

    const loggerService = app.get(LoggerService);

    app.useGlobalFilters(new GlobalExceptionFilter(loggerService));

    const config = new DocumentBuilder()
      .setTitle('Menu Com')
      .setDescription('Control de comedores y menú')
      .setVersion('1.0')
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document);
    app.enableCors();

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
  }
}
bootstrap();
