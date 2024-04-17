import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';


async function bootstrap() {
  try {
    const app = await NestFactory.create(AppModule);
    const config = new DocumentBuilder()
      .setTitle('Pickme Up API')
      .setDescription('Control de comedores y menú')
      .setVersion('1.0')
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document);
    app.enableCors();
    await app.listen(process.env.PORT || 3001);
  } catch (error) {
    console.error('Error al iniciar la aplicación:', error);
  }
}
bootstrap();
