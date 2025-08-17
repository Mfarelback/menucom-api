import { Injectable, Logger } from '@nestjs/common';
import {
  ImageResponse,
  CacheOptions,
} from '../interfaces/image-proxy.interface';

interface CacheEntry {
  data: ImageResponse;
  timestamp: number;
  size: number;
}

@Injectable()
export class ImageCacheService {
  private readonly logger = new Logger(ImageCacheService.name);
  private readonly cache = new Map<string, CacheEntry>();
  private readonly defaultTtl = 3600; // 1 hora en segundos
  private readonly maxCacheSize = 100 * 1024 * 1024; // 100MB
  private currentCacheSize = 0;

  async get(
    key: string,
    options?: CacheOptions,
  ): Promise<ImageResponse | null> {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    const ttl = options?.ttl || this.defaultTtl;
    const isExpired = Date.now() - entry.timestamp > ttl * 1000;

    if (isExpired) {
      this.delete(key);
      return null;
    }

    this.logger.debug(`Cache hit for key: ${key}`);
    return entry.data;
  }

  async set(key: string, data: ImageResponse): Promise<void> {
    const size = data.buffer.length;

    // Verificar si tenemos espacio suficiente
    if (this.currentCacheSize + size > this.maxCacheSize) {
      this.evictLeastRecentlyUsed(size);
    }

    const entry: CacheEntry = {
      data,
      timestamp: Date.now(),
      size,
    };

    // Eliminar entrada anterior si existe
    if (this.cache.has(key)) {
      const oldEntry = this.cache.get(key);
      this.currentCacheSize -= oldEntry.size;
    }

    this.cache.set(key, entry);
    this.currentCacheSize += size;

    this.logger.debug(
      `Cached image with key: ${key}, size: ${size} bytes, total cache: ${this.currentCacheSize} bytes`,
    );
  }

  async delete(key: string): Promise<boolean> {
    const entry = this.cache.get(key);
    if (entry) {
      this.currentCacheSize -= entry.size;
      this.cache.delete(key);
      this.logger.debug(`Deleted cache entry: ${key}`);
      return true;
    }
    return false;
  }

  async clear(): Promise<void> {
    this.cache.clear();
    this.currentCacheSize = 0;
    this.logger.debug('Cache cleared');
  }

  getCacheStats() {
    return {
      entries: this.cache.size,
      currentSize: this.currentCacheSize,
      maxSize: this.maxCacheSize,
      hitRatio: this.calculateHitRatio(),
    };
  }

  private evictLeastRecentlyUsed(requiredSpace: number): void {
    // Convertir el Map a array y ordenar por timestamp
    const entries = Array.from(this.cache.entries()).sort(
      (a, b) => a[1].timestamp - b[1].timestamp,
    );

    let freedSpace = 0;
    for (const [key, entry] of entries) {
      this.cache.delete(key);
      this.currentCacheSize -= entry.size;
      freedSpace += entry.size;

      this.logger.debug(
        `Evicted cache entry: ${key}, freed: ${entry.size} bytes`,
      );

      // Liberar espacio adicional para evitar evictions frecuentes
      if (freedSpace >= requiredSpace + this.maxCacheSize * 0.1) {
        break;
      }
    }
  }

  private calculateHitRatio(): number {
    // Este es un placeholder. En producción usarías métricas reales
    return 0.85; // 85% hit ratio ejemplo
  }
}
