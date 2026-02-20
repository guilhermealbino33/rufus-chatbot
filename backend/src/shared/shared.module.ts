import { Module } from '@nestjs/common';
import { WebhookService } from './services/webhook.service';

@Module({
  providers: [WebhookService],
  exports: [WebhookService],
})
export class SharedModule {}
