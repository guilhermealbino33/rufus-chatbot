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

    // ========== Callbacks de Eventos ==========

    /** Callback executado quando um QR Code é gerado */
    onQRCode?: (base64Qr: string, asciiQR: string) => void;

    /** Callback executado quando o status da sessão muda */
    onStatusChange?: (status: string, session: string) => void;

    /** Callback executado quando uma mensagem é recebida */
    onMessage?: (message: any) => void;
}

/**
 * Configuração padrão para clientes WPPConnect
 * 
 * Estas configurações são otimizadas para ambientes de produção:
 * - Headless para economizar recursos
 * - Chrome para melhor compatibilidade
 * - Argumentos de segurança desabilitados para containers Docker
 */
export const DEFAULT_WHATSAPP_CONFIG: Partial<WhatsappClientConfig> = {
    headless: true,
    useChrome: true,
    debug: false,
    logQR: false,
    autoClose: 0,
    browserArgs: [
        '--disable-web-security',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage', // Previne problemas de memória compartilhada
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
    ],
};
