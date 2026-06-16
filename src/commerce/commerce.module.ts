import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Commerce } from './entities/commerce.entity';
import { CommerceService } from './services/commerce.service';
import { CommerceController } from './controllers/commerce.controller';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { AuthModule } from '../auth/auth.module';
import { MembershipModule } from '../membership/membership.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Commerce]),
    CloudinaryModule,
    forwardRef(() => AuthModule),
    forwardRef(() => MembershipModule),
  ],
  controllers: [CommerceController],
  providers: [CommerceService],
  exports: [CommerceService],
})
export class CommerceModule {}
