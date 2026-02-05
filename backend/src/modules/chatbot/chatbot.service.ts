import { Injectable, Logger } from '@nestjs/common';
import { WhatsappMessagesService } from '../whatsapp/services/whatsapp-messages.service';

@Injectable()
export class ChatbotService {
    private readonly logger = new Logger(ChatbotService.name);

    constructor(private readonly whatsappService: WhatsappMessagesService) { }

    async handleWebhook(payload: any) {
        this.logger.log(`Webhook received: ${JSON.stringify(payload)}`);

        // Check for session in payload (some providers include it at root)
        const sessionName = payload.session || 'default';

        // Supondo: { type: 'message', message: { from: '5511...', body: 'Oi' } }
        const message = payload.type === 'message' ? payload.message : null;

        if (message && message.from && message.body) {
            const result = await this.processMessage(message.from, message.body);

            if (result && result.response) {
                this.logger.log(`Responding to ${message.from}: ${result.response}`);

                try {
                    await this.whatsappService.send(
                        { sessionName,
                        phone: message.from,
                        message: result.response}
                    );
                } catch (error) {
                    this.logger.error(`Error sending response to ${message.from}:`, error.message);
                }
            }
        }

        return { status: 'received' };
    }

    async processMessage(phoneNumber: string, messageBody: string) {
        // TODO: Re-implement using custom modules (Leads, Sessions, Tickets)
        return { response: 'Chatbot em manutenção para migração de arquitetura.' };
    }
}

