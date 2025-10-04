import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
// import { FirebaseAdminModule } from '../auth/firebase-admin.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../user/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
