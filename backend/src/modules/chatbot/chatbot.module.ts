import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { ChatbotService } from './chatbot.service';
import { ChatbotController } from './chatbot.controller';
import { SessionExpiryService } from './session-expiry.service';
import { MessageLog } from './entities/message-log.entity';
import { FlowLog } from './entities/flow-log.entity';
import { ChatbotUser } from './entities/chatbot-user.entity';
import { ChatbotUserService } from './chatbot-user.service';
import { SharedModule } from '@/shared/shared.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([MessageLog, FlowLog, ChatbotUser]),
    SharedModule,
  ],
  controllers: [ChatbotController],
  providers: [ChatbotService, ChatbotUserService, SessionExpiryService],
  exports: [ChatbotService],
})
export class ChatbotModule {}
