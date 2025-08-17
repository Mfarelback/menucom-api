export interface ImageProvider {
  /**
   * Obtiene una imagen desde la fuente externa
   * @param imageUrl URL de la imagen original
   * @returns Buffer de la imagen y metadata
   */
  fetchImage(imageUrl: string): Promise<ImageResponse>;

  /**
   * Valida si la URL es válida para este provider
   * @param imageUrl URL a validar
   */
  isValidUrl(imageUrl: string): boolean;

  /**
   * Obtiene el tipo de contenido de la imagen
   * @param imageUrl URL de la imagen
   */
  getContentType(imageUrl: string): Promise<string>;
}

export interface ImageResponse {
  buffer: Buffer;
  contentType: string;
  contentLength?: number;
  lastModified?: Date;
  etag?: string;
}

export interface CacheOptions {
  ttl?: number; // Time to live en segundos
  maxSize?: number; // Tamaño máximo del cache en MB
}

export interface ImageTransformOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'jpeg' | 'png' | 'webp';
}

export enum ImageProviderType {
  CLOUDINARY = 'cloudinary',
  S3 = 's3',
  CDN = 'cdn',
  HTTP = 'http',
}
