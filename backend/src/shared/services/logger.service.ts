import { Injectable, ConsoleLogger, LoggerService } from '@nestjs/common';
import { ILogger, LoggerPayload } from '@/shared/interfaces/logger.interface';

function isLoggerPayload(payload: LoggerPayload | string): payload is LoggerPayload {
  return (
    typeof payload === 'object' && payload !== null && 'message' in payload && 'severity' in payload
  );
}

const KNOWN_PAYLOAD_KEYS = new Set([
  'severity',
  'message',
  'context',
  'error',
  'stack',
  'sessionId',
  'userId',
  'metadata',
  'messageId',
]);

function formatPayload(payload: LoggerPayload): string {
  const parts: string[] = [`[${payload.severity}] ${payload.message}`];
  if (payload.sessionId) parts.push(`sessionId=${payload.sessionId}`);
  if (payload.userId) parts.push(`userId=${payload.userId}`);
  if (payload.messageId) parts.push(`messageId=${payload.messageId}`);
  if (payload.metadata && Object.keys(payload.metadata).length > 0) {
    parts.push(`metadata=${JSON.stringify(payload.metadata)}`);
  }
  const record = payload as unknown as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!KNOWN_PAYLOAD_KEYS.has(key) && record[key] !== undefined) {
      parts.push(`${key}=${String(record[key])}`);
    }
  }
  return parts.join(' | ');
}

@Injectable()
export class AppLoggerService implements LoggerService {
  private readonly nestLogger = new ConsoleLogger();

  log(message: unknown, ...optionalParams: unknown[]): void;
  log(payload: LoggerPayload | string): void;
  log(messageOrPayload: unknown, ...optionalParams: unknown[]): void {
    if (isLoggerPayload(messageOrPayload as LoggerPayload | string)) {
      const payload = messageOrPayload as LoggerPayload;
      this.nestLogger.log(formatPayload(payload), payload.context);
    } else {
      this.nestLogger.log(messageOrPayload, ...optionalParams);
    }
  }

  error(message: unknown, ...optionalParams: unknown[]): void;
  error(payload: LoggerPayload | string, trace?: string): void;
  error(messageOrPayload: unknown, ...optionalParams: unknown[]): void {
    if (isLoggerPayload(messageOrPayload as LoggerPayload | string)) {
      const payload = messageOrPayload as LoggerPayload;
      const formatted = formatPayload(payload);
      if (payload.stack ?? optionalParams[0]) {
        this.nestLogger.error(
          formatted,
          payload.stack ?? (optionalParams[0] as string),
          payload.context,
        );
      } else {
        this.nestLogger.error(formatted, payload.context);
      }
    } else {
      this.nestLogger.error(messageOrPayload, ...optionalParams);
    }
  }

  warn(message: unknown, ...optionalParams: unknown[]): void;
  warn(payload: LoggerPayload | string): void;
  warn(messageOrPayload: unknown, ...optionalParams: unknown[]): void {
    if (isLoggerPayload(messageOrPayload as LoggerPayload | string)) {
      const payload = messageOrPayload as LoggerPayload;
      this.nestLogger.warn(formatPayload(payload), payload.context);
    } else {
      this.nestLogger.warn(messageOrPayload, ...optionalParams);
    }
  }

  debug(message: unknown, ...optionalParams: unknown[]): void;
  debug(payload: LoggerPayload | string): void;
  debug(messageOrPayload: unknown, ...optionalParams: unknown[]): void {
    if (isLoggerPayload(messageOrPayload as LoggerPayload | string)) {
      const payload = messageOrPayload as LoggerPayload;
      this.nestLogger.debug(formatPayload(payload), payload.context);
    } else {
      this.nestLogger.debug(messageOrPayload, ...optionalParams);
    }
  }

  verbose(message: unknown, ...optionalParams: unknown[]): void;
  verbose(payload: LoggerPayload | string): void;
  verbose(messageOrPayload: unknown, ...optionalParams: unknown[]): void {
    if (isLoggerPayload(messageOrPayload as LoggerPayload | string)) {
      const payload = messageOrPayload as LoggerPayload;
      this.nestLogger.verbose(formatPayload(payload), payload.context);
    } else {
      this.nestLogger.verbose(messageOrPayload, ...optionalParams);
    }
  }

  /**
   * Returns a context-bound ILogger for use in services.
   * Preserves per-class context without breaking DI.
   */
  forContext(context: string): ILogger {
    const boundLogger = new ConsoleLogger(context);
    return {
      log: (payload: LoggerPayload | string) => {
        if (isLoggerPayload(payload)) {
          boundLogger.log(formatPayload(payload));
        } else {
          boundLogger.log(payload);
        }
      },
      error: (payload: LoggerPayload | string, trace?: string) => {
        if (isLoggerPayload(payload)) {
          const formatted = formatPayload(payload);
          if (payload.stack ?? trace) {
            boundLogger.error(formatted, payload.stack ?? trace);
          } else {
            boundLogger.error(formatted);
          }
        } else {
          boundLogger.error(payload, trace);
        }
      },
      warn: (payload: LoggerPayload | string) => {
        if (isLoggerPayload(payload)) {
          boundLogger.warn(formatPayload(payload));
        } else {
          boundLogger.warn(payload);
        }
      },
      debug: (payload: LoggerPayload | string) => {
        if (isLoggerPayload(payload)) {
          boundLogger.debug(formatPayload(payload));
        } else {
          boundLogger.debug(payload);
        }
      },
      verbose: (payload: LoggerPayload | string) => {
        if (isLoggerPayload(payload)) {
          boundLogger.verbose(formatPayload(payload));
        } else {
          boundLogger.verbose(payload);
        }
      },
    };
  }
}
