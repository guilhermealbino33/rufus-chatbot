import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WhatsappMessagesService, WhatsappSessionsService } from './services/';
import { WhatsappController } from './controllers/whatsapp-sessions.controller';
import { WhatsappSession } from './entities/whatsapp-session.entity';

@Module({
    imports: [TypeOrmModule.forFeature([WhatsappSession])],
    controllers: [WhatsappController],
    providers: [WhatsappMessagesService, WhatsappSessionsService],
    exports: [WhatsappMessagesService, WhatsappSessionsService],
})
export class WhatsappModule { }
