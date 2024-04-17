import { Module } from '@nestjs/common';
import { CloudinaryService } from './services/cloudinary.service';
import { CloudinaryController } from './controllers/cloudinary.controller';
import { CloudinaryProvider } from './providers/cloudinary';

@Module({
  imports: [CloudinaryModule],
  controllers: [CloudinaryController],
  providers: [CloudinaryService, CloudinaryProvider],
  exports: [CloudinaryService],
})
export class CloudinaryModule {}
