import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppDataService } from './services/app-data.service';
import { AppConfigService } from './services/app-config.service';
import { AppDataController } from './controllers/app-data.controller';
import { AppData } from './entities/app-data.entity';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([AppData])],
  controllers: [AppDataController],
  providers: [AppDataService, AppConfigService],
  exports: [AppDataService, AppConfigService],
})
export class AppDataModule {}
