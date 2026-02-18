import { IsString, IsNumber, IsOptional, IsIn, Min, Max, validateSync } from 'class-validator';
import { plainToInstance } from 'class-transformer';

/**
 * Classe de validação das variáveis de ambiente.
 * Usada no boot para impedir que a aplicação suba com config inválida ou faltando.
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
 * Valida as variáveis de ambiente e retorna instância validada.
 * Lança exceção com mensagens de erro se a validação falhar.
 */
export function validateEnv(): EnvironmentVariables {
  const raw = {
    NODE_ENV: process.env.NODE_ENV ?? 'development',
    PORT: process.env.PORT ? parseInt(process.env.PORT, 10) : 3000,
    DATABASE_HOST: process.env.DATABASE_HOST ?? 'localhost',
    DATABASE_PORT: process.env.DATABASE_PORT ? parseInt(process.env.DATABASE_PORT, 10) : 5432,
    DATABASE_USERNAME: process.env.DATABASE_USERNAME ?? 'postgres',
    DATABASE_PASSWORD: process.env.DATABASE_PASSWORD ?? 'postgres',
    DATABASE_NAME: process.env.DATABASE_NAME ?? 'rufus_chatbot',
    CORS_ORIGIN: process.env.CORS_ORIGIN,
    WHATSAPP_TEST_PHONE_NUMBER: process.env.WHATSAPP_TEST_PHONE_NUMBER,
    WA_SESSION_TOKEN: process.env.WA_SESSION_TOKEN,
    JWT_SECRET: process.env.JWT_SECRET,
    CHROMIUM_EXECUTABLE_PATH: process.env.CHROMIUM_EXECUTABLE_PATH ?? undefined,
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
