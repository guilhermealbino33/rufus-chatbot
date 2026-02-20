import { IsString, IsNumber, IsOptional, IsIn, Min, Max, validateSync } from 'class-validator';
import { plainToInstance } from 'class-transformer';

/**
 * Classe de validação das variáveis de ambiente.
 * Usada no boot para impedir que a aplicação suba com config inválida ou faltando.
 *
 * Normaliza variáveis do Railway (PGHOST, PGPORT, etc.) para os nomes internos
 * (DATABASE_HOST, DATABASE_PORT, etc.) antes da validação, garantindo que o
 * código seja agnóstico à plataforma de hospedagem.
 */
export class EnvironmentVariables {
  @IsIn(['development', 'production', 'test'])
  NODE_ENV: string = 'development';

  @IsNumber()
  @Min(1)
  @Max(65535)
  PORT: number = 3000;

  @IsString()
  DATABASE_HOST: string = 'localhost';

  @IsNumber()
  @Min(1)
  @Max(65535)
  DATABASE_PORT: number = 5432;

  @IsString()
  DATABASE_USERNAME: string = 'postgres';

  @IsString()
  DATABASE_PASSWORD: string = 'postgres';

  @IsString()
  DATABASE_NAME: string = 'rufus_chatbot';

  @IsOptional()
  @IsString()
  CORS_ORIGIN?: string;

  @IsOptional()
  @IsString()
  WHATSAPP_TEST_PHONE_NUMBER?: string;

  @IsOptional()
  @IsString()
  WA_SESSION_TOKEN?: string;

  @IsOptional()
  @IsString()
  JWT_SECRET?: string;

  @IsOptional()
  @IsString()
  CHROMIUM_EXECUTABLE_PATH?: string;
}

/**
 * Remove aspas envolventes simples ou duplas e aplica trim.
 */
function cleanEnvString(value: string | undefined): string | undefined {
  if (value === undefined) return value;

  const trimmed = value.trim();
  if (trimmed.length >= 2) {
    const first = trimmed[0];
    const last = trimmed[trimmed.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return trimmed.slice(1, -1).trim();
    }
  }

  return trimmed;
}

/**
 * Resolve variáveis de banco de dados aceitando tanto os nomes
 * internos (DATABASE_*) quanto os nomes padrão Railway (PG*).
 * Prioridade: DATABASE_* > PG* > default.
 */
function resolveDbVars(env: NodeJS.ProcessEnv) {
  return {
    DATABASE_HOST: cleanEnvString(env.DATABASE_HOST ?? env.PGHOST) ?? 'localhost',
    DATABASE_PORT: cleanEnvString(env.DATABASE_PORT ?? env.PGPORT) ?? '5432',
    DATABASE_USERNAME: cleanEnvString(env.DATABASE_USERNAME ?? env.PGUSER) ?? 'postgres',
    DATABASE_PASSWORD: cleanEnvString(env.DATABASE_PASSWORD ?? env.PGPASSWORD) ?? 'postgres',
    DATABASE_NAME: cleanEnvString(env.DATABASE_NAME ?? env.PGDATABASE) ?? 'rufus_chatbot',
  };
}

/**
 * Callback de validação compatível com a opção `validate` do ConfigModule.
 * Recebe o objeto de configuração bruto (process.env mesclado com .env)
 * e retorna a instância validada ou lança exceção.
 */
export function validateEnv(env: Record<string, unknown>): EnvironmentVariables {
  const nodeEnv = cleanEnvString(env.NODE_ENV as string | undefined) ?? 'development';
  const isProduction = nodeEnv === 'production';

  const db = resolveDbVars(env as NodeJS.ProcessEnv);

  // Log de debug: mostra as variáveis resolvidas no boot
  console.log('[EnvDebug] Resolved database vars:', {
    DATABASE_HOST: db.DATABASE_HOST,
    DATABASE_PORT: db.DATABASE_PORT,
    DATABASE_USERNAME: db.DATABASE_USERNAME,
    DATABASE_NAME: db.DATABASE_NAME,
    NODE_ENV: nodeEnv,
  });

  // Em produção: verifica se as variáveis essenciais foram resolvidas
  if (isProduction) {
    const missingVars: string[] = [];
    if (!db.DATABASE_HOST || db.DATABASE_HOST === 'localhost')
      missingVars.push('DATABASE_HOST (ou PGHOST)');
    if (!db.DATABASE_USERNAME || db.DATABASE_USERNAME === 'postgres')
      missingVars.push('DATABASE_USERNAME (ou PGUSER)');
    if (!db.DATABASE_PASSWORD || db.DATABASE_PASSWORD === 'postgres')
      missingVars.push('DATABASE_PASSWORD (ou PGPASSWORD)');
    if (!db.DATABASE_NAME || db.DATABASE_NAME === 'rufus_chatbot')
      missingVars.push('DATABASE_NAME (ou PGDATABASE)');

    if (missingVars.length > 0) {
      throw new Error(
        `❌ Variáveis de ambiente obrigatórias não encontradas em produção:\n` +
          `   ${missingVars.join(', ')}\n\n` +
          `   Configure via Railway Variables (DATABASE_*) ou Service Link (PGHOST, PGUSER, etc.).\n` +
          `   Consulte: https://docs.railway.app/guides/variables`,
      );
    }
  }

  const portRaw = cleanEnvString(env.PORT as string | undefined);

  const raw = {
    NODE_ENV: nodeEnv,
    PORT: portRaw ? parseInt(portRaw, 10) : 3000,
    DATABASE_HOST: db.DATABASE_HOST,
    DATABASE_PORT: parseInt(db.DATABASE_PORT, 10),
    DATABASE_USERNAME: db.DATABASE_USERNAME,
    DATABASE_PASSWORD: db.DATABASE_PASSWORD,
    DATABASE_NAME: db.DATABASE_NAME,
    CORS_ORIGIN: cleanEnvString(env.CORS_ORIGIN as string | undefined),
    WHATSAPP_TEST_PHONE_NUMBER: cleanEnvString(
      env.WHATSAPP_TEST_PHONE_NUMBER as string | undefined,
    ),
    WA_SESSION_TOKEN: cleanEnvString(env.WA_SESSION_TOKEN as string | undefined),
    JWT_SECRET: cleanEnvString(env.JWT_SECRET as string | undefined),
    CHROMIUM_EXECUTABLE_PATH: cleanEnvString(env.CHROMIUM_EXECUTABLE_PATH as string | undefined),
  };

  const validated = plainToInstance(EnvironmentVariables, raw, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validated, {
    whitelist: true,
    forbidNonWhitelisted: false,
  });

  if (errors.length > 0) {
    const messages = errors.flatMap((e) =>
      Object.values(e.constraints ?? {}).map((m) => `${e.property}: ${m}`),
    );
    throw new Error(`Configuração de ambiente inválida:\n${messages.join('\n')}`);
  }

  return validated;
}
