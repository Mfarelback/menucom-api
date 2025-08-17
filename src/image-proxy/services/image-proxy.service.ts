import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ImageProviderFactory } from '../providers/image-provider.factory';
import { ImageCacheService } from '../cache/image-cache.service';
import { ImageResponse } from '../interfaces/image-proxy.interface';
import { createHash } from 'crypto';

@Injectable()
export class ImageProxyService {
  private readonly logger = new Logger(ImageProxyService.name);

  constructor(
    private readonly providerFactory: ImageProviderFactory,
    private readonly cacheService: ImageCacheService,
  ) {}

  async getImage(imageUrl: string): Promise<ImageResponse> {
    try {
      // Validar URL
      if (!this.isValidImageUrl(imageUrl)) {
        throw new NotFoundException('Invalid image URL');
      }

      // Generar clave de cache
      const cacheKey = this.generateCacheKey(imageUrl);

      // Intentar obtener desde cache
      const cachedImage = await this.cacheService.get(cacheKey);
      if (cachedImage) {
        this.logger.debug(`Cache hit for image: ${imageUrl}`);
        return cachedImage;
      }

      // Cache miss - obtener imagen desde provider
      this.logger.debug(`Cache miss for image: ${imageUrl}`);
      const provider = this.providerFactory.getProvider(imageUrl);
      const imageResponse = await provider.fetchImage(imageUrl);

      // Guardar en cache
      await this.cacheService.set(cacheKey, imageResponse);

      return imageResponse;
    } catch (error) {
      this.logger.error(`Failed to get image ${imageUrl}:`, error.message);
      throw error;
    }
  }

  async getProxiedUrl(originalUrl: string, baseUrl: string): Promise<string> {
    if (!originalUrl) {
      return originalUrl;
    }

    // Si ya es una URL de nuestro proxy, no hacer nada
    if (originalUrl.includes('/api/image-proxy/')) {
      return originalUrl;
    }

    // Codificar la URL original
    const encodedUrl = encodeURIComponent(originalUrl);
    return `${baseUrl}/api/image-proxy/image?url=${encodedUrl}`;
  }

  transformImageUrls(data: any, baseUrl: string): any {
    if (!data) return data;

    if (typeof data === 'string') {
      // Si es una URL de imagen, transformarla
      if (this.looksLikeImageUrl(data)) {
        return this.getProxiedUrl(data, baseUrl);
      }
      return data;
    }

    if (Array.isArray(data)) {
      return data.map((item) => this.transformImageUrls(item, baseUrl));
    }

    if (typeof data === 'object') {
      const transformed = { ...data };
      for (const key in transformed) {
        if (this.isImageField(key)) {
          transformed[key] = this.transformImageUrls(transformed[key], baseUrl);
        } else if (typeof transformed[key] === 'object') {
          transformed[key] = this.transformImageUrls(transformed[key], baseUrl);
        }
      }
      return transformed;
    }

    return data;
  }

  getCacheStats() {
    return this.cacheService.getCacheStats();
  }

  private generateCacheKey(imageUrl: string): string {
    return createHash('sha256').update(imageUrl).digest('hex');
  }

  private isValidImageUrl(url: string): boolean {
    try {
      const parsedUrl = new URL(url);
      return (
        (parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:') &&
        parsedUrl.hostname.length > 0
      );
    } catch {
      return false;
    }
  }

  private looksLikeImageUrl(url: string): boolean {
    if (!url || typeof url !== 'string') return false;

    // Verificar si es una URL de Cloudinary o contiene extensiones de imagen
    return (
      url.includes('cloudinary.com') ||
      url.includes('res.cloudinary.com') ||
      /\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i.test(url) ||
      url.includes('image') ||
      url.includes('photo')
    );
  }

  private isImageField(fieldName: string): boolean {
    const imageFields = [
      'photoURL',
      'imageUrl',
      'picture_url',
      'image',
      'photo',
      'avatar',
      'thumbnail',
      'cover',
      'banner',
    ];

    return imageFields.some((field) =>
      fieldName.toLowerCase().includes(field.toLowerCase()),
    );
  }
}
