import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { WebhookService } from '../../shared/services/webhook.service';
import {
    IncomingWhatsappMessage,
    OutgoingWhatsappMessage,
} from '../../shared/interfaces/messaging.interface';

@Injectable()
export class ChatbotService implements OnModuleInit {
    private readonly logger = new Logger(ChatbotService.name);

    constructor(private readonly webhookService: WebhookService) { }

    onModuleInit() {
        // Subscribe to incoming messages via WebhookService
        this.webhookService.onMessageReceived(async (msg: IncomingWhatsappMessage) => {
            await this.handleIncomingMessage(msg);
        });
        this.logger.log('✅ Subscribed to message.received events');
    }

    /**
     * Handles incoming messages from any channel (currently WhatsApp only)
     */
    private async handleIncomingMessage(msg: IncomingWhatsappMessage): Promise<void> {
        this.logger.log(`Processing message from ${msg.from} in session ${msg.sessionId}`);

        const response = await this.processMessage(msg.from, msg.body);

        if (response) {
            // Emit outgoing message via WebhookService
            const outgoingMessage: OutgoingWhatsappMessage = {
                sessionId: msg.sessionId,
                to: msg.from,
                body: response,
            };

            this.webhookService.emitMessageSend(outgoingMessage);
        }
    }

    /**
     * Processes a message and generates a response
     * 
     * @param from - Phone number of the sender
     * @param body - Message content
     * @returns Response message or null if no response needed
     */
    async processMessage(from: string, body: string): Promise<string | null> {
        // PoC: Simple echo bot
        return `🤖 Echo: ${body}`;

        // TODO: Implement funnel logic using FUNNEL_TREE
        // TODO: Implement session state management
        // TODO: Integrate with LLM/NLU
    }

    /**
     * Legacy webhook handler (kept for backward compatibility with existing controller)
     * @deprecated Use event-driven architecture instead
     */
    async handleWebhook(payload: any) {
        this.logger.warn('⚠️ handleWebhook is deprecated. Use event-driven architecture instead.');

        const sessionName = payload.session || 'default';
        const message = payload.type === 'message' ? payload.message : null;

        if (message && message.from && message.body) {
            const result = await this.processMessage(message.from, message.body);
            return { status: 'received', response: result };
        }

        return { status: 'received' };
    }
}

