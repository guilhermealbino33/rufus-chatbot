import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import * as wppconnect from '@wppconnect-team/wppconnect';
import { WhatsappClientConfig, DEFAULT_WHATSAPP_CONFIG } from '../config/whatsapp-client.config';

/**
 * Factory responsável pela criação de instâncias do WPPConnect
 *
 * Seguindo o padrão Factory, esta classe encapsula toda a complexidade
 * de configuração e inicialização do cliente WPPConnect, permitindo:
 * - Configuração centralizada e tipada
 * - Facilidade de testes (mock do factory)
 * - Separação de responsabilidades (SRP)
 */
@Injectable()
export class WhatsappClientFactory {
  private readonly logger = new Logger(WhatsappClientFactory.name);

  /**
   * Cria uma nova instância do cliente WPPConnect
   *
   * @param config - Configuração tipada do cliente
   * @returns Promise com a instância do cliente WPPConnect
   * @throws InternalServerErrorException se a criação falhar
   */
  async create(config: WhatsappClientConfig): Promise<wppconnect.Whatsapp> {
    this.logger.log(`Creating WPPConnect client for session: ${config.sessionName}`);

    const options = this.buildWppConnectOptions(config);

    try {
      const client = await wppconnect.create(options);
      this.logger.log(`✅ Client created successfully for: ${config.sessionName}`);
      return client;
    } catch (error) {
      this.logger.error(`❌ Failed to create client for ${config.sessionName}:`, error);
      throw new InternalServerErrorException(`Failed to initialize WPPConnect: ${error.message}`);
    }
  }

  /**
   * Converte WhatsappClientConfig para o formato esperado pelo wppconnect.create()
   *
   * @private
   * @param config - Configuração tipada
   * @returns Objeto de opções no formato do WPPConnect
   */
  private buildWppConnectOptions(config: WhatsappClientConfig): wppconnect.CreateOptions {
    const options: wppconnect.CreateOptions = {
      session: config.sessionName,
      headless: config.headless ?? DEFAULT_WHATSAPP_CONFIG.headless,
      useChrome: config.useChrome ?? DEFAULT_WHATSAPP_CONFIG.useChrome,
      debug: config.debug ?? DEFAULT_WHATSAPP_CONFIG.debug,
      logQR: config.logQR ?? DEFAULT_WHATSAPP_CONFIG.logQR,
      autoClose: config.autoClose ?? DEFAULT_WHATSAPP_CONFIG.autoClose,
      browserArgs: config.browserArgs ?? DEFAULT_WHATSAPP_CONFIG.browserArgs,
      devtools: false,
    };

    // Adicionar callbacks opcionais apenas se fornecidos
    if (config.onQRCode) {
      options.catchQR = config.onQRCode;
    }

    if (config.onStatusChange) {
      options.statusFind = config.onStatusChange;
    }

    return options;
  }
}
