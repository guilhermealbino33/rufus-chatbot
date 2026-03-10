import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppLoggerService } from './logger.service';
import { ILogger, LogSeverity } from '@/shared/interfaces/logger.interface';

@Injectable()
export class SanityCheckService implements OnApplicationBootstrap {
  private readonly logger: ILogger;

  constructor(
    private readonly configService: ConfigService,
    private readonly loggerService: AppLoggerService,
  ) {
    this.logger = loggerService.forContext('SanityCheck');
  }

  onApplicationBootstrap() {
    this.logger.log({
      severity: LogSeverity.LOG,
      message: '[BOOT] Running Environment Sanity Check...',
    });

    const mandatoryKeys = [
      'NODE_ENV',
      'PORT',
      'DATABASE_HOST',
      'DATABASE_PORT',
      'DATABASE_USERNAME',
      'DATABASE_NAME',
      'WHATSAPP_PARTNER_ID',
    ];

    const loadedKeys = mandatoryKeys.filter((key) => this.configService.get(key));

    this.logger.log({
      severity: LogSeverity.LOG,
      message: `[SUCCESS] Loaded Keys: ${loadedKeys.join(', ')}`,
    });

    const missingKeys = mandatoryKeys.filter((key) => !this.configService.get(key));

    if (missingKeys.length > 0) {
      this.logger.warn({
        severity: LogSeverity.WARNING,
        message: `[WARN] Missing Keys (using defaults if any): ${missingKeys.join(', ')}`,
      });
    }

    this.logger.log({
      severity: LogSeverity.LOG,
      message: '[SECURE] (Values are hidden for security)',
    });
  }
}
