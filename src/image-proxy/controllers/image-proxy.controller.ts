import {
  Controller,
  Get,
  Query,
  Res,
  HttpException,
  HttpStatus,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { ImageProxyService } from '../services/image-proxy.service';
import { ImageProxyLoggingInterceptor } from '../interceptors/image-proxy-logging.interceptor';

@ApiTags('image-proxy')
@Controller('image-proxy')
@UseInterceptors(ImageProxyLoggingInterceptor)
export class ImageProxyController {
  constructor(private readonly imageProxyService: ImageProxyService) {}

  @Get('image')
  @ApiOperation({ summary: 'Proxy de imagen' })
  @ApiQuery({
    name: 'url',
    description: 'URL de la imagen a obtener',
    example:
      'https://res.cloudinary.com/example/image/upload/v1234567890/sample.jpg',
  })
  @ApiResponse({ status: 200, description: 'Imagen obtenida exitosamente' })
  @ApiResponse({ status: 400, description: 'URL inválida' })
  @ApiResponse({ status: 404, description: 'Imagen no encontrada' })
  @ApiResponse({ status: 500, description: 'Error interno del servidor' })
  async getImage(@Query('url') imageUrl: string, @Res() res: Response) {
    try {
      if (!imageUrl) {
        throw new BadRequestException('URL parameter is required');
      }

      const imageResponse = await this.imageProxyService.getImage(imageUrl);

      // Configurar headers de respuesta
      res.set({
        'Content-Type': imageResponse.contentType,
        'Content-Length': imageResponse.contentLength?.toString() || '',
        'Cache-Control': 'public, max-age=3600', // Cache por 1 hora
        ETag: imageResponse.etag || '',
        'Last-Modified': imageResponse.lastModified?.toUTCString() || '',
        // Headers CORS
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type',
      });

      // Si el cliente envía If-None-Match o If-Modified-Since, verificar cache
      const ifNoneMatch = res.req.headers['if-none-match'];
      const ifModifiedSince = res.req.headers['if-modified-since'];

      if (
        (ifNoneMatch && ifNoneMatch === imageResponse.etag) ||
        (ifModifiedSince &&
          imageResponse.lastModified &&
          new Date(ifModifiedSince) >= imageResponse.lastModified)
      ) {
        return res.status(304).end();
      }

      // Enviar la imagen
      return res.send(imageResponse.buffer);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new HttpException(
        error.message || 'Failed to fetch image',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('stats')
  @ApiOperation({ summary: 'Estadísticas del cache de imágenes' })
  @ApiResponse({ status: 200, description: 'Estadísticas del cache' })
  getCacheStats() {
    return this.imageProxyService.getCacheStats();
  }

  @Get('health')
  @ApiOperation({ summary: 'Health check del servicio de proxy' })
  @ApiResponse({
    status: 200,
    description: 'Servicio funcionando correctamente',
  })
  healthCheck() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'image-proxy',
    };
  }
}
