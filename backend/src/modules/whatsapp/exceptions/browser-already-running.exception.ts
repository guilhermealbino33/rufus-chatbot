import { ConflictException } from '@nestjs/common';

/**
 * Exceção lançada quando o WPPConnect detecta que um processo do browser
 * já está rodando para a sessão especificada.
 *
 * Isso geralmente ocorre quando:
 * - Um processo anterior não foi encerrado corretamente
 * - Existe um arquivo de lock no diretório userDataDir (/tokens/{sessionName})
 * - Múltiplas tentativas de inicialização simultâneas
 *
 * Esta exceção fornece instruções claras para o desenvolvedor resolver o problema.
 */
export class BrowserAlreadyRunningException extends ConflictException {
  constructor(sessionName: string) {
    super({
      success: false,
      message: 'Sessão já em processo de inicialização ou browser travado',
      error: 'BROWSER_ALREADY_RUNNING',
      details: {
        sessionName,
        solution: [
          `1. Aguarde alguns segundos e tente novamente`,
          `2. Se o problema persistir, delete a sessão via DELETE /whatsapp/sessions/${sessionName}`,
          `3. Como último recurso, remova manualmente a pasta /tokens/${sessionName}`,
        ],
      },
    });
  }
}
