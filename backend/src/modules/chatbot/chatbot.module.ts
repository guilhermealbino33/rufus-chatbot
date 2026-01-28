import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatbotService } from './chatbot.service';
import { ChatbotController } from './chatbot.controller';
import { MessageLog } from './entities/message-log.entity';
import { FlowLog } from './entities/flow-log.entity';

@Module({
    imports: [TypeOrmModule.forFeature([MessageLog, FlowLog])],
    controllers: [ChatbotController],
    providers: [ChatbotService],
})
export class ChatbotModule { }
