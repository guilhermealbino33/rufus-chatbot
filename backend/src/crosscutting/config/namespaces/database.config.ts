import { registerAs, ConfigType } from '@nestjs/config';

/**
 * Namespace de configuração do banco de dados.
 *
 * Resolve automaticamente os nomes de variáveis do Railway (PGHOST, PGPORT, etc.)
 * com fallback para os nomes internos da aplicação (DATABASE_HOST, etc.),
 * garantindo que o código seja agnóstico à plataforma de hospedagem.
 */
export const databaseConfig = registerAs('database', () => ({
  host: process.env.DATABASE_HOST ?? process.env.PGHOST ?? 'localhost',
  port: parseInt(process.env.DATABASE_PORT ?? process.env.PGPORT ?? '5432', 10),
  username: process.env.DATABASE_USERNAME ?? process.env.PGUSER ?? 'postgres',
  password: process.env.DATABASE_PASSWORD ?? process.env.PGPASSWORD ?? 'postgres',
  name: process.env.DATABASE_NAME ?? process.env.PGDATABASE ?? 'rufus_chatbot',
}));

export type DatabaseConfig = ConfigType<typeof databaseConfig>;
