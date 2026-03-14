import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { ChatbotController } from './controllers/chatbot.controller';
import { MessageLog, FlowLog, ChatbotUser } from './entities';
import { ChatbotUserService, SessionExpiryService, ChatbotService } from './services';
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
