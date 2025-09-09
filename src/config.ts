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
    // Configuración de Firebase
    firebase: {
      projectId: process.env.FIREBASE_PROJECT_ID,
      privateKey: process.env.FIREBASE_PRIVATE_KEY,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    },
  };
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
enum OrderStatus {
  pending = 'pending',
  confirmed = 'confirmed',
  shipped = 'shipped',
  cancelled = 'cancelled',
}

export enum PaymentStatusType {
  PENDING = 'pending',
  APPROVED = 'approved',
  IN_PROCESS = 'in_process',
  REJECTED = 'rejected',
  REFUNDED = 'refunded',
  CANCELLED = 'cancelled',
}
