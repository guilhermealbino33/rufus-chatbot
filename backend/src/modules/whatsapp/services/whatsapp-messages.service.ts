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
import * as wppconnect from '@wppconnect-team/wppconnect';

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
   * Sends a text message via page.evaluate calling WPP.chat.sendTextMessage
   * directly. This bypasses the WAPI.getMessageById step in client.sendText
   * which fails with "Invalid WID value" for LID-migrated contacts.
   *
   * Also calls WPP.contact.queryExists first to update the local WA store
   * (fix from WPPConnect 1.37.10+ for LID contacts).
   */
  private async sendTextDirect(
    client: wppconnect.Whatsapp,
    sessionName: string,
    to: string,
    content: string,
  ): Promise<unknown> {
    const page = (client as unknown as Record<string, unknown>).page as
      | { evaluate: (fn: string, ...args: unknown[]) => Promise<unknown> }
      | undefined;
    if (!page) {
      throw new Error('Client page not available for direct send');
    }

    this.logger.debug({
      severity: LogSeverity.DEBUG,
      message: `[${sessionName}] sendTextDirect: queryExists + sendTextMessage for: ${to}`,
    });

    // Runs in browser context where WPP is a global from @wppconnect/wa-js.
    // Using a string function avoids TypeScript errors for browser-only globals.
    return page.evaluate(
      `async (to, content) => {
        try { await WPP.contact.queryExists(to); } catch (_e) {}
        return WPP.chat.sendTextMessage(to, content, { waitForAck: false });
      }`,
      to,
      content,
    );
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
      const { normalizeJid, isLidJid } = await import('../utils/jid.utils');

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

      // For @lid identifiers, resolve to @c.us then send directly
      if (isLidJid(normalizedJid)) {
        this.logger.debug({
          severity: LogSeverity.DEBUG,
          message: `[${sessionName}] Detected LID format: ${normalizedJid}`,
        });

        // Resolve LID -> @c.us via getPnLidEntry
        const resolvedJid = await this.resolveLidToUs(client, sessionName, normalizedJid);

        if (resolvedJid) {
          this.logger.debug({
            severity: LogSeverity.DEBUG,
            message: `[${sessionName}] LID resolved to ${resolvedJid}, sending directly`,
          });
          const result = await this.sendTextDirect(client, sessionName, resolvedJid, message);
          return { success: true, message: 'Message sent successfully', data: result };
        }

        // Fallback: try direct LID send via sendTextDirect
        this.logger.debug({
          severity: LogSeverity.DEBUG,
          message: `[${sessionName}] No @c.us resolution, trying direct LID send`,
        });
        const result = await this.sendTextDirect(client, sessionName, normalizedJid, message);
        return { success: true, message: 'Message sent successfully', data: result };
      }

      // For @c.us identifiers, use sendTextDirect (queryExists updates local DB, then send)
      this.logger.debug({
        severity: LogSeverity.DEBUG,
        message: `[${sessionName}] Sending to @c.us: ${normalizedJid}`,
      });

      const result = await this.sendTextDirect(client, sessionName, normalizedJid, message);

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

  /**
   * Resolves a @lid JID to @c.us via getPnLidEntry and getContact.
   * Returns the resolved @c.us JID, or null if resolution failed.
   */
  private async resolveLidToUs(
    client: wppconnect.Whatsapp,
    sessionName: string,
    lidJid: string,
  ): Promise<string | null> {
    const { isLidJid } = await import('../utils/jid.utils');

    // Strategy 1: getPnLidEntry
    try {
      const clientExt = client as unknown as {
        getPnLidEntry: (jid: string) => Promise<{
          phoneNumber?: { id?: string; server?: string; _serialized?: string } | string;
        }>;
      };
      const pnLidEntry = await clientExt.getPnLidEntry(lidJid);
      const rawPhoneNumber = pnLidEntry?.phoneNumber;
      let phoneJid: string | undefined =
        rawPhoneNumber == null
          ? undefined
          : typeof rawPhoneNumber === 'string'
            ? rawPhoneNumber
            : typeof rawPhoneNumber._serialized === 'string'
              ? rawPhoneNumber._serialized
              : rawPhoneNumber.id != null
                ? String(rawPhoneNumber.id)
                : undefined;

      if (phoneJid && !phoneJid.includes('@')) {
        phoneJid = `${phoneJid}@c.us`;
      }

      this.logger.debug({
        severity: LogSeverity.DEBUG,
        message: `[${sessionName}] getPnLidEntry resolved: ${phoneJid}`,
      });

      if (phoneJid && !isLidJid(phoneJid)) {
        return phoneJid;
      }
    } catch (e) {
      this.logger.debug({
        severity: LogSeverity.DEBUG,
        message: `[${sessionName}] getPnLidEntry failed: ${(e as Error)?.message}`,
      });
    }

    // Strategy 2: getContact
    try {
      const contact = await client.getContact(lidJid);
      const rawContactId = contact?.id as { _serialized?: string } | string | undefined;
      const resolvedId: string | undefined =
        typeof rawContactId === 'string' ? rawContactId : rawContactId?._serialized;

      this.logger.debug({
        severity: LogSeverity.DEBUG,
        message: `[${sessionName}] getContact resolved: ${resolvedId}`,
      });

      if (resolvedId && typeof resolvedId === 'string' && !isLidJid(resolvedId)) {
        return resolvedId;
      }
    } catch (e) {
      this.logger.debug({
        severity: LogSeverity.DEBUG,
        message: `[${sessionName}] getContact failed: ${(e as Error)?.message}`,
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
}
