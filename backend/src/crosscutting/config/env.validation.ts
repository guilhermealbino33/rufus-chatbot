export class EnvironmentVariables {
  NODE_ENV?: string;
  PORT?: number;
  DATABASE_HOST?: string;
  DATABASE_PORT?: number;
  DATABASE_USERNAME?: string;
  DATABASE_PASSWORD?: string;
  DATABASE_NAME?: string;
  CORS_ORIGIN?: string;
  WHATSAPP_TEST_PHONE_NUMBER?: string;
  WA_SESSION_TOKEN?: string;
  JWT_SECRET?: string;
  CHROMIUM_EXECUTABLE_PATH?: string;
}

export function validateEnv(env: Record<string, unknown>): EnvironmentVariables {
  const variables = new EnvironmentVariables();

  variables.NODE_ENV = env.NODE_ENV as string | undefined;
  variables.PORT = env.PORT ? parseInt(env.PORT as string, 10) : undefined;
  variables.DATABASE_HOST = env.DATABASE_HOST as string | undefined;
  variables.DATABASE_PORT = env.DATABASE_PORT
    ? parseInt(env.DATABASE_PORT as string, 10)
    : undefined;
  variables.DATABASE_USERNAME = env.DATABASE_USERNAME as string | undefined;
  variables.DATABASE_PASSWORD = env.DATABASE_PASSWORD as string | undefined;
  variables.DATABASE_NAME = env.DATABASE_NAME as string | undefined;
  variables.CORS_ORIGIN = env.CORS_ORIGIN as string | undefined;
  variables.WHATSAPP_TEST_PHONE_NUMBER = env.WHATSAPP_TEST_PHONE_NUMBER as string | undefined;
  variables.WA_SESSION_TOKEN = env.WA_SESSION_TOKEN as string | undefined;
  variables.JWT_SECRET = env.JWT_SECRET as string | undefined;
  variables.CHROMIUM_EXECUTABLE_PATH = env.CHROMIUM_EXECUTABLE_PATH as string | undefined;

  // Log de debug: mostra as variáveis resolvidas
  console.log('[EnvDebug] Resolved environment variables:', variables);

  return variables;
}
