import { Global, Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { RecoveryPassword } from './entities/recovery-password.entity';
import { Membership } from '../membership/entities/membership.entity';
import { ImageProxyModule } from 'src/image-proxy/image-proxy.module';
import { CloudinaryModule } from 'src/cloudinary/cloudinary.module';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([User, RecoveryPassword, Membership]),
    ImageProxyModule,
    CloudinaryModule,
    CatalogModule,
  ],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
