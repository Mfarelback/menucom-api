import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from './services/auth.service';
import { AuthController } from './controllers/auth.controller';
import { UserRoleController } from './controllers/user-role.controller';
import { JwtModule } from '@nestjs/jwt';
import { UserModule } from '../user/user.module';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import config from '../config';
import { ConfigType } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import { LocalStrategy } from './local.strategy';
import { GoogleIdTokenStrategy } from './strategies/google-id.strategy';
import { UserRole } from './entities/user-role.entity';
import { User } from '../user/entities/user.entity';
import { Commerce } from '../commerce/entities/commerce.entity';
import { UserRoleService } from './services/user-role.service';
import { PermissionsGuard } from './guards/permissions.guard';
import { FirebaseAdminService } from './firebase-admin.service';
import { TenantInterceptor } from './interceptors/tenant.interceptor';
import { TenantResolutionService } from './services/tenant-resolution.service';
import { CommerceModule } from '../commerce/commerce.module';

@Module({
  imports: [
    forwardRef(() => UserModule),
    forwardRef(() => CloudinaryModule),
    forwardRef(() => CommerceModule),
    TypeOrmModule.forFeature([UserRole, User, Commerce]),
    JwtModule.registerAsync({
      inject: [config.KEY],
      useFactory: (configService: ConfigType<typeof config>) => {
        return {
          secret: configService.jwtsecret,
          signOptions: {
            expiresIn: '1d',
          },
        };
      },
    }),
  ],
  controllers: [AuthController, UserRoleController],
  providers: [
    AuthService,
    JwtStrategy,
    LocalStrategy,
    GoogleIdTokenStrategy,
    UserRoleService,
    PermissionsGuard,
    FirebaseAdminService,
    TenantInterceptor,
    TenantResolutionService,
  ],
  exports: [
    AuthService,
    UserRoleService,
    PermissionsGuard,
    FirebaseAdminService,
    JwtModule,
    TenantInterceptor,
    TenantResolutionService,
  ],
})
export class AuthModule {}
