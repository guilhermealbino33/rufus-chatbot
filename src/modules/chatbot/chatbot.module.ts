import { Module } from '@nestjs/common';
import { ChatbotService } from './chatbot.service';
import { ChatbotController } from './chatbot.controller';
import { PrismaModule } from '../../shared/prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [ChatbotController],
    providers: [ChatbotService],
})
export class ChatbotModule { }
