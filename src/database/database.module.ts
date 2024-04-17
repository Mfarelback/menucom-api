import { Module, Global, UnauthorizedException } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import config from '../config';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as mysql from 'mysql2/promise';
@Global()
@Module({
  imports: [

    TypeOrmModule.forRootAsync({
      inject: [config.KEY],
      useFactory: (configService: ConfigType<typeof config>) => {
        try {

          return {
            type: 'mysql',
            database: configService.mysql.dbName,
            port: configService.mysql.port,
            password: configService.mysql.password,
            user: configService.mysql.user,
            host: configService.mysql.host,
            synchronize: true,
            autoLoadEntities: true,
            ssl: false,
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
      useFactory: (configService: ConfigType<typeof config>) => {
        try {

          const connection = mysql.createConnection({
            host: configService.mysql.host,
            user: configService.mysql.user,
            password: configService.mysql.password,
            database: configService.mysql.dbName,
          });

          return connection;

        } catch (e) {
          console.error(`Falló ${e}`);
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
export class DatabaseModule { }
