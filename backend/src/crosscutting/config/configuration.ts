import { validateEnv } from './env.validation';

/**
 * Função de load do ConfigModule.
 * Valida variáveis de ambiente com class-validator e retorna objeto de config tipado.
 * Falha o boot da aplicação se a validação falhar.
 */
export function configuration(): Record<string, unknown> {
  const env = validateEnv();

  const corsOrigin = env.CORS_ORIGIN?.trim();
  const corsParsed =
    corsOrigin === '' || !corsOrigin
      ? true
      : corsOrigin.includes(',')
        ? corsOrigin.split(',').map((o) => o.trim())
        : corsOrigin;

  return {
    port: env.PORT,
    corsOrigin: corsParsed,
    nodeEnv: env.NODE_ENV,
    database: {
      host: env.DATABASE_HOST,
      port: env.DATABASE_PORT,
      username: env.DATABASE_USERNAME,
      password: env.DATABASE_PASSWORD,
      name: env.DATABASE_NAME,
    },
    server: {
      port: env.PORT,
      env: env.NODE_ENV,
    },
    whatsapp: {
      testPhoneNumber: env.WHATSAPP_TEST_PHONE_NUMBER ?? '5511999999999',
    },
    ...(env.WA_SESSION_TOKEN && { waSessionToken: env.WA_SESSION_TOKEN }),
    ...(env.JWT_SECRET && { jwtSecret: env.JWT_SECRET }),
    ...(env.CHROMIUM_EXECUTABLE_PATH && {
      chromiumExecutablePath: env.CHROMIUM_EXECUTABLE_PATH,
    }),
  };
}
