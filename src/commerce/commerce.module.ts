import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Commerce } from './entities/commerce.entity';
import { ActivityLog } from './entities/activity-log.entity';
import { CommerceService } from './services/commerce.service';
import { ActivityLogService } from './services/activity-log.service';
import { CommerceController } from './controllers/commerce.controller';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { AuthModule } from '../auth/auth.module';
import { MembershipModule } from '../membership/membership.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Commerce, ActivityLog]),
    CloudinaryModule,
    forwardRef(() => AuthModule),
    forwardRef(() => MembershipModule),
    NotificationsModule,
  ],
  controllers: [CommerceController],
  providers: [CommerceService, ActivityLogService],
  exports: [CommerceService, ActivityLogService],
})
export class CommerceModule {}
