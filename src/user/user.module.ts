import { Global, Module, forwardRef } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { AuthModule } from '../auth/auth.module';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { RecoveryPassword } from './entities/recovery-password.entity';
import { Membership } from '../membership/entities/membership.entity';
import { UserRole } from '../auth/entities/user-role.entity';
import { ImageProxyModule } from 'src/image-proxy/image-proxy.module';
import { CloudinaryModule } from 'src/cloudinary/cloudinary.module';
import { UserAuthService } from './services/user-auth.service';
import { UserProfileService } from './services/user-profile.service';
import { UserRecoveryService } from './services/user-recovery.service';
import { UserQueryService } from './services/user-query.service';
import { UserRoleService } from '../auth/services/user-role.service';

@Global()
@Module({
  imports: [
    forwardRef(() => AuthModule),
    TypeOrmModule.forFeature([User, RecoveryPassword, Membership, UserRole]),
    ImageProxyModule,
    CloudinaryModule,
    CatalogModule,
  ],
  controllers: [UserController],
  providers: [
    UserService,
    UserAuthService,
    UserProfileService,
    UserRecoveryService,
    UserQueryService,
    UserRoleService,
  ],
  exports: [
    UserService,
    UserAuthService,
    UserProfileService,
    UserRecoveryService,
    UserQueryService,
    UserRoleService,
  ],
})
export class UserModule {}
