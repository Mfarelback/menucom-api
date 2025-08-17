import { Injectable } from '@nestjs/common';
import {
  ImageProvider,
  ImageProviderType,
} from '../interfaces/image-proxy.interface';
import { CloudinaryImageProvider } from './cloudinary-image.provider';
import { HttpImageProvider } from './http-image.provider';

@Injectable()
export class ImageProviderFactory {
  constructor(
    private readonly cloudinaryProvider: CloudinaryImageProvider,
    private readonly httpProvider: HttpImageProvider,
  ) {}

  getProvider(imageUrl: string): ImageProvider {
    // Determinar el provider basado en la URL
    if (this.cloudinaryProvider.isValidUrl(imageUrl)) {
      return this.cloudinaryProvider;
    }

    // Fallback al provider HTTP genérico
    return this.httpProvider;
  }

  getProviderByType(type: ImageProviderType): ImageProvider {
    switch (type) {
      case ImageProviderType.CLOUDINARY:
        return this.cloudinaryProvider;
      case ImageProviderType.HTTP:
      default:
        return this.httpProvider;
    }
  }
}
