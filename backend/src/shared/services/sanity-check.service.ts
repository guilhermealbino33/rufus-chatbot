import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SanityCheckService implements OnApplicationBootstrap {
  private readonly logger = new Logger('SanityCheck');

  constructor(private readonly configService: ConfigService) {}

  onApplicationBootstrap() {
    this.logger.log('🚀 Running Environment Sanity Check...');

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

    this.logger.log(`✅ Loaded Keys: ${loadedKeys.join(', ')}`);

    const missingKeys = mandatoryKeys.filter((key) => !this.configService.get(key));

    if (missingKeys.length > 0) {
      this.logger.warn(`⚠️ Missing Keys (using defaults if any): ${missingKeys.join(', ')}`);
    }

    this.logger.log('🔒 (Values are hidden for security)');
  }
}
