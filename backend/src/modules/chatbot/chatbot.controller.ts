import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ChatbotService } from './chatbot.service';

@Controller('webhook')
export class ChatbotController {
    constructor(private readonly chatbotService: ChatbotService) { }

    @Post()
    @HttpCode(HttpStatus.OK) // Sempre retornar 200 rápido
    async handleWebhook(@Body() payload: any) {
        console.log('Webhook received:', JSON.stringify(payload));

        // Exemplo genérico. Adapte conforme o provider (WPPConnect, Baileys, etc)
        // Supondo: { type: 'message', message: { from: '5511...', body: 'Oi' } }
        const message = payload.type === 'message' ? payload.message : null;

        if (message) {
            // Em produção, isso deve ir para uma fila (BullMQ)
            const result = await this.chatbotService.processMessage(message.from, message.body);

            if (result && result.response) {
                // Aqui você chamaria a API do WhatsApp para ENVIAR a resposta
                console.log(`Responding to ${message.from}: ${result.response}`);
                // await whatsappProvider.sendText(message.from, result.response);
            }
        }

        return { status: 'received' };
    }
}
