import { Global, Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { RecoveryPassword } from './entities/recovery-password.entity';
import { Membership } from '../membership/entities/membership.entity';
import { ImageProxyModule } from 'src/image-proxy/image-proxy.module';
import { CloudinaryModule } from 'src/cloudinary/cloudinary.module';
import { MenuModule } from 'src/menu/menu.module';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([User, RecoveryPassword, Membership]),
    ImageProxyModule,
    CloudinaryModule,
    MenuModule,
  ],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
