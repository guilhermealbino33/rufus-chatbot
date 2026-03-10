export enum LogSeverity {
  DEBUG = 'DEBUG',
  LOG = 'LOG', // Uso padrão do NestJS (Info)
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL', // Usado para falhas fatais que exigem atenção imediata do time
}

// Representa o formato estruturado das mensagens enviadas ao Logger
export interface LoggerPayload {
  severity: LogSeverity | string;
  message: string;

  /**
   * Identifica o contexto onde o log foi adicionado (Ex: 'WhatsappSessionsService')
   * Normalmente o NestJS injeta o contexto nativamente, mas é útil caso você gerencie isso na payload
   */
  context?: string;

  /**
   * O objeto de erro completo capturado no catch
   */
  error?: unknown;

  /**
   * Stack trace explícito do erro para debug (ex: error.stack)
   */
  stack?: string;

  /**
   * Identificador único atrelado a essa operação no sistema (Ex: ID da sessão do WhatsApp)
   */
  sessionId?: string;

  /**
   * ID do usuário ou do "tenant" atrelado à requisição (ótimo para rastreamento)
   */
  userId?: string;

  /**
   * Qualquer outro dado livre que ajude a debugar sem precisar concatenar na string da `message`
   */
  metadata?: Record<string, any>;

  /**
   * Identificador da mensagem (ex: ID da mensagem do WhatsApp)
   */
  messageId?: string;
}

export interface ILogger {
  log(payload: LoggerPayload | string): void;
  error(payload: LoggerPayload | string, trace?: string): void;
  warn(payload: LoggerPayload | string): void;
  debug(payload: LoggerPayload | string): void;
  verbose(payload: LoggerPayload | string): void;
}
