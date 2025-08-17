import { Injectable, Logger } from '@nestjs/common';
import {
  ImageProvider,
  ImageResponse,
} from '../interfaces/image-proxy.interface';
import axios, { AxiosResponse } from 'axios';

@Injectable()
export class CloudinaryImageProvider implements ImageProvider {
  private readonly logger = new Logger(CloudinaryImageProvider.name);

  async fetchImage(imageUrl: string): Promise<ImageResponse> {
    try {
      this.logger.debug(`Fetching image from Cloudinary: ${imageUrl}`);

      const response: AxiosResponse<ArrayBuffer> = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 10000, // 10 segundos timeout
        headers: {
          'User-Agent': 'MenuCom-ImageProxy/1.0',
        },
      });

      const buffer = Buffer.from(response.data);
      const contentType = response.headers['content-type'] || 'image/jpeg';
      const contentLength = parseInt(
        response.headers['content-length'] || '0',
        10,
      );
      const lastModified = response.headers['last-modified']
        ? new Date(response.headers['last-modified'])
        : undefined;
      const etag = response.headers['etag'];

      this.logger.debug(
        `Successfully fetched image: ${contentLength} bytes, ${contentType}`,
      );

      return {
        buffer,
        contentType,
        contentLength,
        lastModified,
        etag,
      };
    } catch (error) {
      this.logger.error(
        `Failed to fetch image from ${imageUrl}:`,
        error.message,
      );
      throw new Error(`Unable to fetch image: ${error.message}`);
    }
  }

  isValidUrl(imageUrl: string): boolean {
    try {
      const url = new URL(imageUrl);
      // Verificar si es una URL de Cloudinary
      return (
        url.hostname.includes('cloudinary.com') ||
        url.hostname.includes('res.cloudinary.com')
      );
    } catch {
      return false;
    }
  }

  async getContentType(imageUrl: string): Promise<string> {
    try {
      const response = await axios.head(imageUrl, { timeout: 5000 });
      return response.headers['content-type'] || 'image/jpeg';
    } catch (error) {
      this.logger.warn(
        `Could not get content type for ${imageUrl}:`,
        error.message,
      );
      return 'image/jpeg'; // fallback
    }
  }
}
