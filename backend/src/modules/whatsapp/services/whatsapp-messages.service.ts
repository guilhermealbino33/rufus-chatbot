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
      // Remove caracteres não numéricos
      const formattedPhone = phone.replace(/\D/g, '');

      // Basic format check
      if (formattedPhone.length < 10) {
        throw new BadRequestException('Invalid phone number format');
      }

      // Monta o ID manualmente como fallback
      const chatId = `${formattedPhone}@c.us`;

      // Validate number with WPPConnect
      // Nota: checkNumberStatus pode retornar numberExists: true mas sem o objeto id completo em alguns casos
      const resultCheck = await client.checkNumberStatus(chatId);

      if (!resultCheck.numberExists) {
        throw new BadRequestException(`Number ${phone} is not registered on WhatsApp`);
      }

      // CORREÇÃO APLICADA:
      // Usamos optional chaining (?.) para verificar se .id existe.
      // Se não existir, usamos o chatId que formatamos manualmente.
      const to = resultCheck.id?._serialized || chatId;

      const result = await client.sendText(to, message);

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
