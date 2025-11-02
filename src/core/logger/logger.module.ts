import { Global, Module } from '@nestjs/common';
import { LoggerService } from './logger.service';

/**
 * Módulo global de logging
 * Se marca como @Global() para estar disponible en toda la aplicación
 * sin necesidad de importarlo explícitamente en cada módulo
 */
@Global()
@Module({
  providers: [LoggerService],
  exports: [LoggerService],
})
export class LoggerModule {}
