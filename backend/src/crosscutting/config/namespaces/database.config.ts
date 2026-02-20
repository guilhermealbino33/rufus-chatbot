import { registerAs } from '@nestjs/config';

export const databaseConfig = registerAs('database', () => {
  /**
   * @todo
   * - Remover logs após ajuste de configuração
   */
  console.log('Database Configuration:', {
    host: process.env.DATABASE_HOST,
    port: process.env.DATABASE_PORT,
    username: process.env.DATABASE_USERNAME,
    password: process.env.DATABASE_PASSWORD,
    name: process.env.DATABASE_NAME,
  });

  return {
    host: process.env.DATABASE_HOST ?? 'localhost',
    port: parseInt(process.env.DATABASE_PORT ?? '5432', 10),
    username: process.env.DATABASE_USERNAME ?? 'postgres',
    password: process.env.DATABASE_PASSWORD ?? 'postgres',
    name: process.env.DATABASE_NAME ?? 'rufus_chatbot',
    url: process.env.DATABASE_URL,
  };
});
