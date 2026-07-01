import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BusinessProfile } from './entities/business-profile.entity';
import { BusinessProfileController } from './controllers/business-profile.controller';
import { BusinessProfileService } from './services/business-profile.service';
import { Commerce } from '../commerce/entities/commerce.entity';

@Module({
  imports: [TypeOrmModule.forFeature([BusinessProfile, Commerce])],
  controllers: [BusinessProfileController],
  providers: [BusinessProfileService],
  exports: [BusinessProfileService],
})
export class BusinessProfileModule {}
