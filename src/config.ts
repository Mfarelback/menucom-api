import { registerAs } from '@nestjs/config';

export default registerAs('config', () => {
  return {
    mysql: {
      dbName: process.env.MYSQL_DATABASE,
      port: parseInt(process.env.MYSQL_PORT, 10),
      password: process.env.MYSQL_PASSWORD,
      user: process.env.MYSQL_USER,
      host: process.env.MYSQL_HOST,
    },
    postgresql: {
      qa: process.env.POSTGRESQL_URL,
      dev: process.env.POSTGRESQL_URL,
    },
    jwtsecret: process.env.JWT_SECRET,
    env: process.env.ENV,
  };
});
