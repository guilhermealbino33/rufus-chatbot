import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ChatbotService } from './chatbot.service';

@Controller('webhook')
export class ChatbotController {
    constructor(private readonly chatbotService: ChatbotService) { }

    @Post()
    @HttpCode(HttpStatus.OK)
    async handleWebhook(@Body() payload: any) {
        return this.chatbotService.handleWebhook(payload);
    }
}

