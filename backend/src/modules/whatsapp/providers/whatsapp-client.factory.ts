import { Inject, Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import * as wppconnect from '@wppconnect-team/wppconnect';
import { WhatsappClientConfig, DEFAULT_WHATSAPP_CONFIG } from '../config/whatsapp-client.config';
import { BrowserAlreadyRunningException } from '../exceptions/browser-already-running.exception';
import { whatsappConfig } from '@/crosscutting/config';

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

  constructor(
    @Inject(whatsappConfig.KEY)
    private readonly whatsappCfg: ConfigType<typeof whatsappConfig>,
  ) {}

  /**
   * Cria uma nova instância do cliente WPPConnect
   *
   * @param config - Configuração tipada do cliente
   * @returns Promise com a instância do cliente WPPConnect
   * @throws InternalServerErrorException se a criação falhar
   */
  async create(config: WhatsappClientConfig): Promise<wppconnect.Whatsapp> {
    this.logger.log(`Creating WPPConnect client for session: ${config.sessionName}`);

    const executablePath = config.executablePath ?? this.whatsappCfg.chromiumExecutablePath;

    // [DIAG] Pré-diagnóstico do ambiente antes de lançar o Chromium
    this.logger.log(
      `[DIAG] wppconnect.create() PRE-LAUNCH | session=${config.sessionName} | executablePath=${executablePath ?? 'auto-detect'} | hasPhoneNumber=${!!config.phoneNumber}`,
    );
    this.logger.log(
      `[DIAG] Browser config | headless=${DEFAULT_WHATSAPP_CONFIG.headless} | useChrome=${DEFAULT_WHATSAPP_CONFIG.useChrome} | browserArgs.count=${DEFAULT_WHATSAPP_CONFIG.browserArgs?.length ?? 0}`,
    );

    const options = this.buildWppConnectOptions(config);

    try {
      this.logger.log(`[DIAG] Launching Chromium for session=${config.sessionName}...`);
      const client = await wppconnect.create(options);
      this.logger.log(
        `[DIAG] wppconnect.create() returned (login complete) for session=${config.sessionName}`,
      );
      return client;
    } catch (error) {
      // [DIAG] Stack trace completo — expõe falhas silenciosas do Puppeteer/Chromium
      this.logger.error(
        `[DIAG] wppconnect.create() THREW for session=${config.sessionName}: ${error.message}`,
        error.stack,
      );

      // Detecta erro específico de browser já rodando
      if (
        error.message &&
        (error.message.includes('browser is already running') ||
          error.message.includes('Browser is already running'))
      ) {
        throw new BrowserAlreadyRunningException(config.sessionName);
      }

      // Outros erros mantêm comportamento original
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
    const executablePath = config.executablePath ?? this.whatsappCfg.chromiumExecutablePath;

    const options: wppconnect.CreateOptions = {
      session: config.sessionName,
      headless: config.headless ?? DEFAULT_WHATSAPP_CONFIG.headless,
      useChrome: config.useChrome ?? DEFAULT_WHATSAPP_CONFIG.useChrome,
      debug: config.debug ?? DEFAULT_WHATSAPP_CONFIG.debug,
      logQR: config.logQR ?? DEFAULT_WHATSAPP_CONFIG.logQR,
      autoClose: config.autoClose ?? DEFAULT_WHATSAPP_CONFIG.autoClose,
      browserArgs: config.browserArgs ?? DEFAULT_WHATSAPP_CONFIG.browserArgs,
      // Diretório onde os tokens de reautenticação ficam salvos (DEVE ser volume persistido)
      folderNameToken: config.folderNameToken ?? DEFAULT_WHATSAPP_CONFIG.folderNameToken,
      // true: create() só resolve após o WhatsApp estar autenticado (flag boolean na API)
      waitForLogin: true,
      devtools: false,
      ...(executablePath && {
        puppeteerOptions: { executablePath },
      }),
    };

    // Adicionar callbacks opcionais apenas se fornecidos
    if (config.onQRCode) {
      options.catchQR = config.onQRCode;
    }

    if (config.onLinkCode) {
      options.catchLinkCode = config.onLinkCode;
    }

    if (config.phoneNumber) {
      options.phoneNumber = config.phoneNumber;
    }

    // statusFind é CRÍTICO para diagnóstico: sempre loga o ciclo de vida da sessão
    if (config.onStatusChange) {
      options.statusFind = (status, session) => {
        this.logger.log(`[STATUS] [statusFind] session=${session} status=${status}`);
        config.onStatusChange!(status, session);
      };
    } else {
      // Fallback: mesmo sem callback externo, loga o status para debug em produção
      options.statusFind = (status, session) => {
        this.logger.log(`[STATUS] [statusFind] session=${session} status=${status}`);
      };
    }

    return options;
  }
}
