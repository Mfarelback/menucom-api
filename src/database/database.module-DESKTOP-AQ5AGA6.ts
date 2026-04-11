import { Module, Global, UnauthorizedException } from '@nestjs/common';
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
          if (configService.env == 'dev') {
            return {
              type: 'postgres',
              url: configService.postgresql.dev, // Usando la URL completa de PostgreSQL
              synchronize: true,
              autoLoadEntities: true,
              ssl: false,
            };
          } else {
            return {
              type: 'postgres',
              url: configService.postgresql.qa, // Usando la URL completa de PostgreSQL
              synchronize: true,
              autoLoadEntities: true,
              ssl: {
                rejectUnauthorized: false,
              },
            };
          }
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
          if (configService.env == 'dev') {
            const connection = new DataSource({
              type: 'postgres',
              url: configService.postgresql.dev, // Usando la URL completa de PostgreSQL
              ssl: false,
            });

            return connection;
          } else {
            const connection = new DataSource({
              type: 'postgres',
              url: configService.postgresql.qa, // Usando la URL completa de PostgreSQL
              ssl: {
                rejectUnauthorized: false,
              },
            });

            return connection;
          }
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
export class DatabaseModule {}
