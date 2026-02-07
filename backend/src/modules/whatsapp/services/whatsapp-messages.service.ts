import {
    Injectable,
    Logger,
    NotFoundException,
    InternalServerErrorException,
    HttpException,
    BadRequestException,
    OnModuleInit,
} from '@nestjs/common';
import { SendMessageDTO } from '../dto';
import { WhatsappClientManager } from '../providers';
import { WebhookService } from '../../../shared/services/webhook.service';
import { OutgoingWhatsappMessage } from '../../../shared/interfaces/messaging.interface';


@Injectable()
export class WhatsappMessagesService implements OnModuleInit {
    private readonly logger = new Logger(WhatsappMessagesService.name);

    constructor(
        private clientManager: WhatsappClientManager,
        private webhookService: WebhookService,
    ) { }

    onModuleInit() {
        // Subscribe to outgoing message events via WebhookService
        this.webhookService.onMessageSend(async (msg: OutgoingWhatsappMessage) => {
            await this.handleOutgoingMessage(msg);
        });
        this.logger.log('✅ Subscribed to message.send events');
    }

    /**
     * Handles outgoing messages from the event system
     */
    private async handleOutgoingMessage(msg: OutgoingWhatsappMessage): Promise<void> {
        try {
            await this.send({
                sessionName: msg.sessionId,
                phone: msg.to,
                message: msg.body,
            });
        } catch (error) {
            this.logger.error(
                `Failed to send message via event to ${msg.to}:`,
                error.message
            );
        }
    }


    /**
     * Sends a message via WhatsApp (can be called directly via API or via events)
     */
    async send(
        { sessionName, phone, message }: SendMessageDTO
    ): Promise<any> {
        const client = this.clientManager.getClient(sessionName);

        if (!client) {
            throw new NotFoundException({
                success: false,
                message: `Session ${sessionName} not found or not connected`,
            });
        }

        try {
            const formattedPhone = phone.replace(/\D/g, '');
            // Basic format check
            if (formattedPhone.length < 10) {
                throw new BadRequestException('Invalid phone number format');
            }

            const chatId = `${formattedPhone}@c.us`;

            // Validate number with WPPConnect
            const resultCheck = await client.checkNumberStatus(chatId);

            if (!resultCheck.numberExists) {
                throw new BadRequestException(`Number ${phone} is not registered on WhatsApp`);
            }

            // Use the valid serialized ID from the check result
            const result = await client.sendText(resultCheck.id._serialized, message);

            return {
                success: true,
                message: 'Message sent successfully',
                data: result,
            };
        } catch (error) {
            this.logger.error(`Error sending message in ${sessionName}:`, error);

            if (error instanceof HttpException) {
                throw error;
            }

            throw new InternalServerErrorException({
                success: false,
                message: 'Failed to send message',
                error: error.message,
            });
        }
    }

}
