import { Module, Global, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import config from '../config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Global()
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [config.KEY],
      useFactory: (configService: ConfigType<typeof config>) => {
        try {
          const isDev = configService.env === 'dev';
          return {
            type: 'postgres',
            url: configService.postgresql.dev,
            synchronize: isDev,
            autoLoadEntities: true,
            ssl: isDev
              ? false
              : {
                  rejectUnauthorized: false,
                },
          };
        } catch (e) {
          throw new UnauthorizedException({
            message: 'Hubo un error de integración de datos',
          });
        }
      },
    }),
  ],
  providers: [
    {
      provide: 'DATABASE_CONNECTION',
      useFactory: async (configService: ConfigType<typeof config>) => {
        try {
          const connection = new DataSource({
            type: 'postgres',
            url: configService.postgresql.dev,
            ssl:
              configService.env === 'dev'
                ? false
                : {
                    rejectUnauthorized: false,
                  },
          });

          return connection;
        } catch (e) {
          Logger.error(`Falló conexión a DB: ${e}`, DatabaseModule.name);
          throw new UnauthorizedException({
            message: 'DB config error',
          });
        }
      },
      inject: [config.KEY],
    },
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
