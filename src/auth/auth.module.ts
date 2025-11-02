import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from './services/auth.service';
import { AuthController } from './contollers/auth.controller';
import { JwtModule } from '@nestjs/jwt';
import { UserModule } from 'src/user/user.module';
import config from 'src/config';
import { ConfigType } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import { LocalStrategy } from './local.strategy';
import { GoogleIdTokenStrategy } from './strategies/google-id.strategy';
import { FirebaseAdmin } from './firebase-admin';
import { UserRole } from './entities/user-role.entity';
import { UserRoleService } from './services/user-role.service';
import { PermissionsGuard } from './guards/permissions.guard';

@Module({
  imports: [
    UserModule,
    TypeOrmModule.forFeature([UserRole]),
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
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    LocalStrategy,
    GoogleIdTokenStrategy,
    UserRoleService,
    PermissionsGuard,
    {
      provide: 'FIREBASE_ADMIN_INIT',
      useFactory: (configService: ConfigService) => {
        return FirebaseAdmin.initialize(configService);
      },
      inject: [ConfigService],
    },
  ],
  exports: [AuthService, UserRoleService, PermissionsGuard],
})
export class AuthModule {}
