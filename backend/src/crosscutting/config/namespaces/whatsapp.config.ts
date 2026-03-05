import { registerAs, ConfigType } from '@nestjs/config';

/**
 * Namespace de configuração do WhatsApp / WPPConnect.
 */
export const whatsappConfig = registerAs('whatsapp', () => ({
  testPhoneNumber: process.env.WHATSAPP_TEST_PHONE_NUMBER ?? '5511999999999',
  chromiumExecutablePath: process.env.CHROMIUM_EXECUTABLE_PATH,
  partnerId: process.env.WHATSAPP_PARTNER_ID,
}));

export type WhatsappConfig = ConfigType<typeof whatsappConfig>;
