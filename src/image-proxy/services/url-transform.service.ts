import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class UrlTransformService {
  private readonly logger = new Logger(UrlTransformService.name);
  private baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl =
      this.configService.get<string>('BASE_URL') || 'http://localhost:3000';
  }

  /**
   * Transforma una URL de Cloudinary (o cualquier imagen externa)
   * a una URL de nuestro proxy
   */
  transformToProxy(originalUrl: string): string {
    if (!originalUrl) {
      return originalUrl;
    }

    // Si ya es una URL de nuestro proxy, no hacer nada
    if (originalUrl.includes('/api/image-proxy/')) {
      return originalUrl;
    }

    // Si no parece una URL de imagen, retornar original
    if (!this.isImageUrl(originalUrl)) {
      return originalUrl;
    }

    try {
      const encodedUrl = encodeURIComponent(originalUrl);
      const proxiedUrl = `${this.baseUrl}/api/image-proxy/image?url=${encodedUrl}`;

      this.logger.debug(`Transformed URL: ${originalUrl} -> ${proxiedUrl}`);
      return proxiedUrl;
    } catch (error) {
      this.logger.warn(
        `Failed to transform URL ${originalUrl}:`,
        error.message,
      );
      return originalUrl;
    }
  }

  /**
   * Transforma todas las URLs de imagen en un objeto o array de datos
   */
  transformDataUrls(data: any): any {
    if (!data) return data;

    if (typeof data === 'string') {
      return this.isImageUrl(data) ? this.transformToProxy(data) : data;
    }

    if (Array.isArray(data)) {
      return data.map((item) => this.transformDataUrls(item));
    }

    if (typeof data === 'object' && data !== null) {
      const transformed = { ...data };

      for (const key in transformed) {
        if (transformed.hasOwnProperty(key)) {
          // Campos que sabemos que contienen URLs de imágenes
          if (this.isImageField(key)) {
            transformed[key] = this.transformToProxy(transformed[key]);
          } else if (typeof transformed[key] === 'object') {
            // Recursivamente transformar objetos anidados
            transformed[key] = this.transformDataUrls(transformed[key]);
          }
        }
      }
      return transformed;
    }

    return data;
  }

  /**
   * Determina si una URL parece ser una imagen
   */
  private isImageUrl(url: string): boolean {
    if (!url || typeof url !== 'string') return false;

    // Verificar patrones comunes de URLs de imágenes
    return (
      // URLs de Cloudinary
      url.includes('cloudinary.com') ||
      url.includes('res.cloudinary.com') ||
      // Extensiones de imagen
      /\.(jpg|jpeg|png|gif|webp|svg|bmp|tiff?)(\?.*)?$/i.test(url) ||
      // Patrones en el path que sugieren imágenes
      /\/(image|photo|picture|img|avatar|thumbnail|cover|banner)\//i.test(
        url,
      ) ||
      // Query parameters que sugieren imágenes
      /[?&](image|photo|picture|img)=/i.test(url)
    );
  }

  /**
   * Determina si un campo contiene URLs de imágenes basado en el nombre
   */
  private isImageField(fieldName: string): boolean {
    if (!fieldName || typeof fieldName !== 'string') return false;

    const imageFields = [
      'photourl',
      'photo_url',
      'imageurl',
      'image_url',
      'pictureurl',
      'picture_url',
      'avatarurl',
      'avatar_url',
      'thumbnailurl',
      'thumbnail_url',
      'coverurl',
      'cover_url',
      'bannerurl',
      'banner_url',
      'photo',
      'image',
      'picture',
      'avatar',
      'thumbnail',
      'cover',
      'banner',
      'img',
      'pic',
    ];

    const normalizedFieldName = fieldName.toLowerCase().replace(/[-_\s]/g, '');

    return imageFields.some(
      (field) =>
        normalizedFieldName.includes(field) ||
        field.includes(normalizedFieldName),
    );
  }

  /**
   * Configurar la URL base dinámicamente
   */
  setBaseUrl(baseUrl: string): void {
    if (baseUrl && typeof baseUrl === 'string') {
      this.baseUrl = baseUrl.replace(/\/$/, ''); // Eliminar slash final
      this.logger.debug(`Base URL updated to: ${this.baseUrl}`);
    }
  }

  /**
   * Obtener la URL base actual
   */
  getBaseUrl(): string {
    return this.baseUrl;
  }
}
