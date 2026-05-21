import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { IdempotencyRecord } from './idempotency.entity';
import { LoggerService } from '../logger';

@Injectable()
export class IdempotencyService {
  private readonly defaultTtlMs = 24 * 60 * 60 * 1000;

  constructor(
    @InjectRepository(IdempotencyRecord)
    private readonly repository: Repository<IdempotencyRecord>,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext('IdempotencyService');
  }

  async isProcessed(key: string): Promise<boolean> {
    const record = await this.repository.findOne({
      where: { key, expiresAt: MoreThan(new Date()) },
    });
    return !!record;
  }

  async tryProcess<T>(
    key: string,
    processor: () => Promise<T>,
    ttlMs?: number,
  ): Promise<{ processed: boolean; result?: T }> {
    const ttl = ttlMs ?? this.defaultTtlMs;

    try {
      await this.repository.insert({
        key,
        expiresAt: new Date(Date.now() + ttl),
      });
    } catch (err: any) {
      if (err?.code === '23505') {
        this.logger.warn(`Idempotency key already processed: ${key}`);
        return { processed: false };
      }
      throw err;
    }

    try {
      const result = await processor();
      await this.repository.update({ key }, { response: result as any });
      return { processed: true, result };
    } catch (err) {
      await this.repository.delete({ key });
      throw err;
    }
  }

  async cleanupExpired(): Promise<number> {
    const result = await this.repository.delete({
      expiresAt: MoreThan(new Date()),
    });
    return result.affected ?? 0;
  }
}
