import { Message } from '@wppconnect-team/wppconnect';

/**
 * Configuração para criação de clientes WPPConnect
 *
 * Esta interface define todas as opções disponíveis para configurar
 * uma instância do WPPConnect, abstraindo os detalhes de implementação
 * da biblioteca e facilitando testes e manutenção.
 */
export interface WhatsappClientConfig {
  /** Nome único da sessão */
  sessionName: string;

  /** Executar navegador em modo headless (sem interface gráfica) */
  headless?: boolean;

  /** Usar Google Chrome ao invés de Chromium */
  useChrome?: boolean;

  /** Habilitar modo debug com logs detalhados */
  debug?: boolean;

  /** Exibir QR Code no console (ASCII art) */
  logQR?: boolean;

  /** Argumentos adicionais para o navegador */
  browserArgs?: string[];

  /** Tempo em milissegundos para auto-fechar o navegador (0 = nunca) */
  autoClose?: number;

  /** Telefone para pareamento (apenas se pairingMode for 'phone') */
  phoneNumber?: string;

  /** Caminho para o executável do Chromium/Chrome (ex.: em Docker/Railway) */
  executablePath?: string;

  /**
   * Diretório onde os tokens de sessão serão armazenados.
   * CRÍTICO para produção: deve apontar para um volume persistido.
   * Padrão: process.env.WPPCONNECT_TOKENS_DIR ?? './wpp-sessions'
   */
  folderNameToken?: string;

  /**
   * Timeout (ms) aguardando o WhatsApp Web finalizar o login.
   * Servidores de produção são mais lentos — use valores altos (120s+).
   */
  waitForLogin?: number;

  // ========== Callbacks de Eventos ==========

  /** Callback executado quando um QR Code é gerado */
  onQRCode?: (base64Qr: string, asciiQR: string) => void;

  /** Callback executado quando um Código de Pareamento é gerado */
  onLinkCode?: (code: string) => void;

  /** Callback executado quando o status da sessão muda */
  onStatusChange?: (status: string, session: string) => void;

  /** Callback executado quando uma mensagem é recebida */
  onMessage?: (message: Message) => void;
}

/**
 * Configuração padrão para clientes WPPConnect
 *
 * Estas configurações são otimizadas para ambientes de produção/Docker:
 * - Headless para economizar recursos
 * - useChrome: false força o uso do Chromium do sistema (sem precisar do Google Chrome)
 * - browserArgs: flags obrigatórias para containers sem sandbox
 * - folderNameToken: lido do env para permitir volumes Docker persistentes
 * - waitForLogin: timeout generoso pois servidores PaaS são mais lentos
 */
export const DEFAULT_WHATSAPP_CONFIG: Partial<WhatsappClientConfig> = {
  headless: true,
  // Em Docker usamos o Chromium do sistema; useChrome: false evita buscar o Google Chrome
  useChrome: false,
  debug: false,
  logQR: false,
  autoClose: 0,
  // Diretório de tokens lido do env para facilitar o mapeamento de volumes
  folderNameToken: process.env.WPPCONNECT_TOKENS_DIR ?? './wpp-sessions',
  // 120 s é um ponto de partida seguro para servidores mais lentos
  // waitForLogin é boolean no WPPConnect: true = aguarda login antes de resolver create()
  // (o timeout interno pode ser controlado via autoClose se necessário)
  browserArgs: [
    // --- Obrigatórias em qualquer container sem sandbox de SO ---
    '--no-sandbox',
    '--disable-setuid-sandbox',
    // Substitui /dev/shm por /tmp para evitar ENOMEM em containers com shm pequeno
    '--disable-dev-shm-usage',
    // --- Otimizações de resources para ambientes headless ---
    '--disable-gpu',
    '--disable-accelerated-2d-canvas',
    '--no-first-run',
    '--no-zygote',
    '--disable-extensions',
    '--disable-background-networking',
    '--disable-default-apps',
    '--disable-sync',
    '--disable-translate',
    '--hide-scrollbars',
    '--metrics-recording-only',
    '--mute-audio',
    '--safebrowsing-disable-auto-update',
    '--disable-features=AudioServiceOutOfProcess',
    // '--- Removed --single-process as it is unstable in specific headless environments ---'
  ],
};
