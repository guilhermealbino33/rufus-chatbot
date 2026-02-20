import { registerAs, ConfigType } from '@nestjs/config';

/**
 * Parseia o valor de CORS_ORIGIN:
 * - Vazio / ausente → true (permite tudo, útil para dev)
 * - Lista separada por vírgula → string[]
 * - Valor único → string
 */
function parseCorsOrigin(value: string | undefined): string | string[] | true {
  const trimmed = value?.trim();
  if (!trimmed) return true;
  if (trimmed.includes(',')) return trimmed.split(',').map((o) => o.trim());
  return trimmed;
}

/**
 * Namespace de configuração do servidor HTTP.
 */
export const serverConfig = registerAs('server', () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  env: process.env.NODE_ENV ?? 'development',
  corsOrigin: parseCorsOrigin(process.env.CORS_ORIGIN),
}));

export type ServerConfig = ConfigType<typeof serverConfig>;
