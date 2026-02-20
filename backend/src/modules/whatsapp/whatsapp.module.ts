import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WhatsappMessagesService, WhatsappSessionsService } from './services/';
import { WhatsappController } from './controllers/whatsapp-sessions.controller';
import { WhatsappSession } from './entities/whatsapp-session.entity';
import { WhatsappClientFactory, WhatsappClientManager } from './providers';
import { SharedModule } from '@/shared/shared.module';

@Module({
  imports: [TypeOrmModule.forFeature([WhatsappSession]), SharedModule],
  controllers: [WhatsappController],
  providers: [
    WhatsappMessagesService,
    WhatsappSessionsService,
    WhatsappClientFactory,
    WhatsappClientManager,
  ],
  exports: [WhatsappMessagesService, WhatsappSessionsService, WhatsappClientManager],
})
export class WhatsappModule {}
