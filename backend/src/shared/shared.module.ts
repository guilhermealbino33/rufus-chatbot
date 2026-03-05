import { Module } from '@nestjs/common';
import { WebhookService } from './services/webhook.service';
import { SanityCheckService } from './services/sanity-check.service';

@Module({
  providers: [WebhookService, SanityCheckService],
  exports: [WebhookService, SanityCheckService],
})
export class SharedModule {}
