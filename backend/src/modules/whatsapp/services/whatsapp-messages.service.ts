import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  HttpException,
  BadRequestException,
  OnModuleInit,
} from '@nestjs/common';
import { AppLoggerService } from '@/shared/services/logger.service';
import { ILogger, LogSeverity } from '@/shared/interfaces/logger.interface';
import { SendMessageDTO } from '../dto';
import { WhatsappClientManager } from '../providers';
import { WebhookService } from '../../../shared/services/webhook.service';
import { OutgoingWhatsappMessage } from '../../../shared/interfaces/messaging.interface';
import { ApiResponse } from '../interfaces/whatsapp-common.interface';

@Injectable()
export class WhatsappMessagesService implements OnModuleInit {
  private readonly logger: ILogger;

  constructor(
    private clientManager: WhatsappClientManager,
    private webhookService: WebhookService,
    private readonly loggerService: AppLoggerService,
  ) {
    this.logger = loggerService.forContext(WhatsappMessagesService.name);
  }

  onModuleInit() {
    // Subscribe to outgoing message events via WebhookService
    this.webhookService.onMessageSend(async (msg: OutgoingWhatsappMessage) => {
      await this.handleOutgoingMessage(msg);
    });
    this.logger.log({
      severity: LogSeverity.LOG,
      message: '[SUCCESS] Subscribed to message.send events',
    });
  }

  /**
   * Phase 3 fallback: resolves LID → @c.us via getPnLidEntry and sends the message.
   * @returns ApiResponse on success, null if resolution or send failed
   */
  private async trySendViaPnLidEntry(
    client: {
      getPnLidEntry: (jid: string) => Promise<{
        phoneNumber?: { id?: string; server?: string; _serialized?: string };
      }>;
      sendText: (to: string, text: string) => Promise<unknown>;
    },
    sessionName: string,
    lidJid: string,
    message: string,
    isLidJid: (jid: string) => boolean,
  ): Promise<ApiResponse | null> {
    try {
      const pnLidEntry = await client.getPnLidEntry(lidJid);

      // Prefer phoneNumber.id (pure digits) over _serialized to hit createWid's /^\d+$/ path
      const rawPhoneNumber = pnLidEntry?.phoneNumber;
      const phoneJid: string | undefined =
        rawPhoneNumber == null
          ? undefined
          : typeof rawPhoneNumber === 'string'
            ? rawPhoneNumber
            : (rawPhoneNumber.id ??
              (typeof rawPhoneNumber._serialized === 'string'
                ? rawPhoneNumber._serialized
                : rawPhoneNumber._serialized != null
                  ? String(rawPhoneNumber._serialized)
                  : String(rawPhoneNumber)));

      this.logger.debug({
        severity: LogSeverity.DEBUG,
        message: `[${sessionName}] getPnLidEntry resolved: ${phoneJid}`,
      });
      if (phoneJid && !isLidJid(phoneJid)) {
        const result = await client.sendText(phoneJid, message);
        return {
          success: true,
          message: 'Message sent successfully',
          data: result,
        };
      }
    } catch (pnLidError) {
      this.logger.debug({
        severity: LogSeverity.DEBUG,
        message: `[${sessionName}] getPnLidEntry failed: ${pnLidError?.message}`,
      });
    }
    return null;
  }

  /**
   * Handles outgoing messages from the event system
   */
  private async handleOutgoingMessage(msg: OutgoingWhatsappMessage): Promise<void> {
    try {
      this.logger.debug({
        severity: LogSeverity.DEBUG,
        message: `[${msg.sessionId}] Handling outgoing message to: ${msg.to}`,
      });

      await this.send({
        sessionName: msg.sessionId,
        phone: msg.to,
        message: msg.body,
      });
    } catch (error) {
      this.logger.error({
        severity: LogSeverity.ERROR,
        message: `Failed to send message via event to ${msg.to}: ${error.message}`,
      });
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

      // Multi-line replacement to handle try-catch around normalizeJid
      // Normalize the JID - this preserves @lid and @c.us formats, or converts pure numbers
      let normalizedJid: string;
      try {
        normalizedJid = normalizeJid(phone);
      } catch (error) {
        throw new BadRequestException(`Invalid phone number format: ${phone}`);
      }

      this.logger.debug({
        severity: LogSeverity.DEBUG,
        message: `[${sessionName}] Normalized JID: ${normalizedJid} (from input: ${phone})`,
      });

      // For @lid identifiers, try direct send first; fallback to getContact() if it fails
      if (isLidJid(normalizedJid)) {
        this.logger.debug({
          severity: LogSeverity.DEBUG,
          message: `[${sessionName}] Detected LID format, sending directly to: ${normalizedJid}`,
        });

        try {
          const result = await client.sendText(normalizedJid, message);
          return {
            success: true,
            message: 'Message sent successfully',
            data: result,
          };
        } catch (lidError) {
          this.logger.debug({
            severity: LogSeverity.DEBUG,
            message: `[${sessionName}] LID send failed, resolving contact for: ${normalizedJid}`,
          });

          const contact = await client.getContact(normalizedJid);
          const rawContactId = contact?.id as { _serialized?: string } | string | undefined;
          const resolvedId: string | undefined =
            typeof rawContactId === 'string' ? rawContactId : rawContactId?._serialized;

          this.logger.debug({
            severity: LogSeverity.DEBUG,
            message: `[${sessionName}] getContact returned id type=${typeof rawContactId} value=${JSON.stringify(rawContactId)}, resolvedId=${resolvedId}`,
          });

          if (resolvedId && typeof resolvedId === 'string' && !isLidJid(resolvedId)) {
            this.logger.debug({
              severity: LogSeverity.DEBUG,
              message: `[${sessionName}] Resolved LID to ${resolvedId}, retrying send`,
            });
            const result = await client.sendText(resolvedId, message);
            return {
              success: true,
              message: 'Message sent successfully',
              data: result,
            };
          }

          const pnLidResult = await this.trySendViaPnLidEntry(
            client,
            sessionName,
            normalizedJid,
            message,
            isLidJid,
          );
          if (pnLidResult) return pnLidResult;
          throw lidError;
        }
      }

      // For @c.us identifiers, validate with checkNumberStatus first
      this.logger.debug({
        severity: LogSeverity.DEBUG,
        message: `[${sessionName}] Validating number status for: ${normalizedJid}`,
      });

      const resultCheck = await client.checkNumberStatus(normalizedJid);

      if (!resultCheck.numberExists) {
        throw new BadRequestException(`Number ${phone} is not registered on WhatsApp`);
      }

      // Use the ID returned by checkNumberStatus if available, otherwise use normalized JID
      const targetJid = resultCheck.id?._serialized || normalizedJid;

      this.logger.debug({
        severity: LogSeverity.DEBUG,
        message: `[${sessionName}] Sending message to: ${targetJid}`,
      });

      const result = await client.sendText(targetJid, message);

      return {
        success: true,
        message: 'Message sent successfully',
        data: result,
      };
    } catch (error) {
      this.logger.error({
        severity: LogSeverity.ERROR,
        message: `Error sending message in ${sessionName}: ${error?.message ?? error}`,
        error,
      });

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
