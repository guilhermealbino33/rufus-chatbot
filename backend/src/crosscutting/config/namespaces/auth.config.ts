import { registerAs, ConfigType } from '@nestjs/config';

/**
 * Namespace de configuração de autenticação.
 */
export const authConfig = registerAs('auth', () => ({
  jwtSecret: process.env.JWT_SECRET,
  waSessionToken: process.env.WA_SESSION_TOKEN,
}));

export type AuthConfig = ConfigType<typeof authConfig>;
