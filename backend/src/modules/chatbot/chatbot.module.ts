import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatbotService } from './chatbot.service';
import { ChatbotController } from './chatbot.controller';
import { MessageLog } from './entities/message-log.entity';
import { FlowLog } from './entities/flow-log.entity';
import { ChatbotUser } from './entities/chatbot-user.entity';
import { ChatbotUserService } from './chatbot-user.service';
import { SharedModule } from '@/shared/shared.module';

@Module({
  imports: [TypeOrmModule.forFeature([MessageLog, FlowLog, ChatbotUser]), SharedModule],
  controllers: [ChatbotController],
  providers: [ChatbotService, ChatbotUserService],
  exports: [ChatbotService],
})
export class ChatbotModule {}
