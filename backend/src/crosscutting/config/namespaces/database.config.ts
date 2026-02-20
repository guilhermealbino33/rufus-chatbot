import { registerAs, ConfigType } from '@nestjs/config';

/**
 * Extrai componentes de uma DATABASE_URL completa.
 * Formato: postgresql://user:password@host:port/database
 * Railway injeta esta variável automaticamente via Service Link.
 */
function parseDatabaseUrl(url: string | undefined): Partial<Record<string, string>> {
  if (!url) return {};
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: parsed.port || '5432',
      username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
      password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
      name: parsed.pathname.replace(/^\//, ''),
    };
  } catch {
    return {};
  }
}

/**
 * Namespace de configuração do banco de dados.
 *
 * Resolve variáveis na seguinte ordem de prioridade:
 *   1. DATABASE_* (nomes internos, configurados manualmente no Railway Variables)
 *   2. PG* (variáveis nativas do PostgreSQL, injetadas pelo Railway Service Link)
 *   3. DATABASE_URL (connection string completa, também injetada pelo Service Link)
 *   4. Defaults para desenvolvimento local
 */
export const databaseConfig = registerAs('database', () => {
  const fromUrl = parseDatabaseUrl(process.env.DATABASE_URL);

  return {
    host: process.env.DATABASE_HOST ?? process.env.PGHOST ?? fromUrl.host ?? 'localhost',
    port: parseInt(process.env.DATABASE_PORT ?? process.env.PGPORT ?? fromUrl.port ?? '5432', 10),
    username: process.env.DATABASE_USERNAME ?? process.env.PGUSER ?? fromUrl.username ?? 'postgres',
    password:
      process.env.DATABASE_PASSWORD ?? process.env.PGPASSWORD ?? fromUrl.password ?? 'postgres',
    name: process.env.DATABASE_NAME ?? process.env.PGDATABASE ?? fromUrl.name ?? 'rufus_chatbot',
    url: process.env.DATABASE_URL,
  };
});

export type DatabaseConfig = ConfigType<typeof databaseConfig>;
