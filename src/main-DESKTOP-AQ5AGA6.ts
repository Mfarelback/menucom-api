import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { GlobalExceptionFilter } from './core/interceptors/global-exception.filter';
import { LoggerService } from './core/logger/logger.service';

async function bootstrap() {
  try {
    const app = await NestFactory.create(AppModule);

    // Obtener instancia del LoggerService para el filtro de excepciones
    const loggerService = app.get(LoggerService);

    // Registrar filtro global de excepciones
    app.useGlobalFilters(new GlobalExceptionFilter(loggerService));

    const config = new DocumentBuilder()
      .setTitle('Menu Com')
      .setDescription('Control de comedores y menú')
      .setVersion('1.0')
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document);
    app.enableCors();

    // Habilitar validación y transformación global
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
        whitelist: true,
      }),
    );

    await app.listen(process.env.PORT || 3001);
  } catch (error) {
    console.error('Error al iniciar la aplicación:', error);
  }
}
bootstrap();
