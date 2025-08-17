import { Injectable, Logger } from '@nestjs/common';
import {
  ImageProvider,
  ImageResponse,
} from '../interfaces/image-proxy.interface';
import axios, { AxiosResponse } from 'axios';

@Injectable()
export class HttpImageProvider implements ImageProvider {
  private readonly logger = new Logger(HttpImageProvider.name);

  async fetchImage(imageUrl: string): Promise<ImageResponse> {
    try {
      this.logger.debug(`Fetching image from HTTP: ${imageUrl}`);

      const response: AxiosResponse<ArrayBuffer> = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 10000,
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
      return url.protocol === 'http:' || url.protocol === 'https:';
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
      return 'image/jpeg';
    }
  }
}
