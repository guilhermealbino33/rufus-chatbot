import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatbotService } from './chatbot.service';
import { ChatbotController } from './chatbot.controller';
import { MessageLog } from './entities/message-log.entity';

@Module({
    imports: [TypeOrmModule.forFeature([MessageLog])],
    controllers: [ChatbotController],
    providers: [ChatbotService],
})
export class ChatbotModule { }
