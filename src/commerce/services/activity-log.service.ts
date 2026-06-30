import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActivityLog, ActivityAction } from '../entities/activity-log.entity';

@Injectable()
export class ActivityLogService {
  private readonly logger = new Logger(ActivityLogService.name);

  constructor(
    @InjectRepository(ActivityLog)
    private readonly activityLogRepository: Repository<ActivityLog>,
  ) {}

  async log(params: {
    commerceId: string;
    userId: string;
    userRole: string;
    action: ActivityAction;
    entityType: string;
    entityId?: string;
    changes?: Record<string, { from: any; to: any }>;
    summary?: string;
  }): Promise<void> {
    try {
      const entry = this.activityLogRepository.create(params);
      await this.activityLogRepository.save(entry);
    } catch (err: any) {
      this.logger.warn(`Error guardando activity log: ${err?.message}`);
    }
  }

  async getActivity(commerceId: string, limit = 50): Promise<ActivityLog[]> {
    return this.activityLogRepository.find({
      where: { commerceId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }
}
