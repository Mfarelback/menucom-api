import { Module, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from './services/auth.service';
import { AuthController } from './contollers/auth.controller';
import { UserRoleController } from './contollers/user-role.controller';
import { JwtModule } from '@nestjs/jwt';
import { UserModule } from '../user/user.module';
import config from '../config';
import { ConfigType } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import { LocalStrategy } from './local.strategy';
import { GoogleIdTokenStrategy } from './strategies/google-id.strategy';
import { UserRole } from './entities/user-role.entity';
import { User } from '../user/entities/user.entity';
import { UserRoleService } from './services/user-role.service';
import { PermissionsGuard } from './guards/permissions.guard';
import { FirebaseAdminService } from './firebase-admin.service';

@Module({
  imports: [
    forwardRef(() => UserModule),
    TypeOrmModule.forFeature([UserRole, User]),
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
  ],
  exports: [
    AuthService,
    UserRoleService,
    PermissionsGuard,
    FirebaseAdminService,
    JwtModule,
  ],
})
export class AuthModule {}
