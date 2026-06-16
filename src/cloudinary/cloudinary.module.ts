import { Module } from '@nestjs/common';
import { CloudinaryService } from './services/cloudinary.service';
import { CloudinaryProvider } from './providers/cloudinary';

@Module({
  providers: [CloudinaryService, CloudinaryProvider],
  exports: [CloudinaryService],
})
export class CloudinaryModule {}
