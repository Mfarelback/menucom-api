import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ImageProxyController } from './controllers/image-proxy.controller';
import { ImageProxyService } from './services/image-proxy.service';
import { UrlTransformService } from './services/url-transform.service';
import { ImageCacheService } from './cache/image-cache.service';
import { ImageProviderFactory } from './providers/image-provider.factory';
import { CloudinaryImageProvider } from './providers/cloudinary-image.provider';
import { HttpImageProvider } from './providers/http-image.provider';
import { ImageProxyLoggingInterceptor } from './interceptors/image-proxy-logging.interceptor';

@Module({
  imports: [ConfigModule],
  controllers: [ImageProxyController],
  providers: [
    ImageProxyService,
    UrlTransformService,
    ImageCacheService,
    ImageProviderFactory,
    CloudinaryImageProvider,
    HttpImageProvider,
    ImageProxyLoggingInterceptor,
  ],
  exports: [ImageProxyService, UrlTransformService, ImageCacheService],
})
export class ImageProxyModule {}
