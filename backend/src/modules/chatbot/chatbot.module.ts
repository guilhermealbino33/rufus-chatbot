import { Module } from '@nestjs/common';
import { ChatbotService } from './chatbot.service';
import { ChatbotController } from './chatbot.controller';

@Module({
    imports: [],
    controllers: [ChatbotController],
    providers: [ChatbotService],
})
export class ChatbotModule { }
