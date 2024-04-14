import { Module, Global, UnauthorizedException } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import config from '../config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Client } from 'pg';
@Global()
@Module({
  imports: [

    TypeOrmModule.forRootAsync({
      inject: [config.KEY],
      useFactory: (configService: ConfigType<typeof config>) => {
        try {
          console.info(`IMPORT`);
          console.info(`DBHOST: ${configService.mysql.host}`);
          console.info(`DBNAME: ${configService.mysql.dbName}`);
          console.info(`USER: ${configService.mysql.user}`);
          console.info(`PASS: ${configService.mysql.password}`);
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
    // {
    //   provide: 'DATABASE_CONNECTION',
    //   useFactory: (configService: ConfigType<typeof config>) => {
    //     try {
    //       console.info(`PROVIDERS`);
    //       console.info(`DBHOST: ${configService.mysql.host}`);
    //       console.info(`DBNAME: ${configService.mysql.dbName}`);
    //       console.info(`USER: ${configService.mysql.user}`);
    //       console.info(`PASS: ${configService.mysql.password}`);
    //       const client = new Client({
    //         database: configService.postgres.dbName,
    //         port: configService.postgres.port,
    //         password: configService.postgres.password,
    //         user: configService.postgres.user,
    //         host: configService.postgres.host,
    //         ssl: false,
    //       });
    //       client.connect();
    //       return client;

    //     } catch (e) {
    //       console.error(`Falló ${e}`);
    //       throw new UnauthorizedException({
    //         message: 'DB config error',
    //       });
    //     }
    //   },
    //   inject: [config.KEY],
    // },
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule { }
