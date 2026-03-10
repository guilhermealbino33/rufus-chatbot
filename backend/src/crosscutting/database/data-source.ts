import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import * as path from 'path';

config();

const isUrlMode = !!process.env.DATABASE_URL;

const baseOptions = {
  type: 'postgres' as const,
  entities: [path.join(__dirname, '/../../**/*.entity{.ts,.js}')],
  migrations: [path.join(__dirname, '/migrations/*{.ts,.js}')],
  synchronize: false,
  logging: true,
  migrationsRun: true,
};

export const AppDataSource = new DataSource(
  isUrlMode
    ? {
        ...baseOptions,
        url: process.env.DATABASE_URL!,
        ssl: { rejectUnauthorized: false },
      }
    : {
        ...baseOptions,
        host: process.env.DATABASE_HOST || 'localhost',
        port: parseInt(process.env.DATABASE_PORT || '5432', 10),
        username: process.env.DATABASE_USERNAME || 'postgres',
        password: process.env.DATABASE_PASSWORD || 'postgres',
        database: process.env.DATABASE_NAME || 'rufus_chatbot',
      },
);
