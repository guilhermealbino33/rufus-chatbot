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
import { ApiResponse } from '../interfaces/whatsapp-common.interface';

@Injectable()
export class WhatsappMessagesService implements OnModuleInit {
  private readonly logger = new Logger(WhatsappMessagesService.name);

  constructor(
    private clientManager: WhatsappClientManager,
    private webhookService: WebhookService,
  ) {}

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
      this.logger.debug(`[${msg.sessionId}] Handling outgoing message to: ${msg.to}`);

      await this.send({
        sessionName: msg.sessionId,
        phone: msg.to,
        message: msg.body,
      });
    } catch (error) {
      this.logger.error(`Failed to send message via event to ${msg.to}:`, error.message);
    }
  }

  /**
   * Sends a message via WhatsApp (can be called directly via API or via events)
   */
  async send({ sessionName, phone, message }: SendMessageDTO): Promise<ApiResponse> {
    const client = this.clientManager.getClient(sessionName);

    if (!client) {
      throw new NotFoundException({
        success: false,
        message: `Session ${sessionName} not found or not connected`,
      });
    }

    try {
      // Import JID utilities inline to avoid circular dependencies
      const { normalizeJid, isLidJid } = await import('../utils/jid.utils');

      // Normalize the JID - this preserves @lid and @c.us formats, or converts pure numbers
      const normalizedJid = normalizeJid(phone);

      this.logger.debug(`[${sessionName}] Normalized JID: ${normalizedJid} (from input: ${phone})`);

      // For @lid identifiers, we send directly without checkNumberStatus
      // because LIDs are already validated identifiers from incoming messages
      if (isLidJid(normalizedJid)) {
        this.logger.debug(
          `[${sessionName}] Detected LID format, sending directly to: ${normalizedJid}`,
        );

        const result = await client.sendText(normalizedJid, message);

        return {
          success: true,
          message: 'Message sent successfully',
          data: result,
        };
      }

      // For @c.us identifiers, validate with checkNumberStatus first
      this.logger.debug(`[${sessionName}] Validating number status for: ${normalizedJid}`);

      const resultCheck = await client.checkNumberStatus(normalizedJid);

      if (!resultCheck.numberExists) {
        throw new BadRequestException(`Number ${phone} is not registered on WhatsApp`);
      }

      // Use the ID returned by checkNumberStatus if available, otherwise use normalized JID
      const targetJid = resultCheck.id?._serialized || normalizedJid;

      this.logger.debug(`[${sessionName}] Sending message to: ${targetJid}`);

      const result = await client.sendText(targetJid, message);

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
