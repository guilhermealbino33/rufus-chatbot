import { Injectable, OnModuleInit } from '@nestjs/common';
import { AppLoggerService } from '@/shared/services/logger.service';
import { ILogger, LogSeverity } from '@/shared/interfaces/logger.interface';
import { WebhookService } from '../../shared/services/webhook.service';
import {
  IncomingWhatsappMessage,
  OutgoingWhatsappMessage,
} from '../../shared/interfaces/messaging.interface';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatbotUserService } from './chatbot-user.service';
import { FlowLog } from './entities/flow-log.entity';
import { FUNNEL_TREE, getMainMenuMessage } from './funnel.config';
import { ChatbotState, FlowAction } from './enums';

@Injectable()
export class ChatbotService implements OnModuleInit {
  private readonly logger: ILogger;

  constructor(
    private readonly webhookService: WebhookService,
    private readonly chatbotUserService: ChatbotUserService,
    @InjectRepository(FlowLog)
    private readonly flowLogRepository: Repository<FlowLog>,
    private readonly loggerService: AppLoggerService,
  ) {
    this.logger = loggerService.forContext(ChatbotService.name);
  }

  onModuleInit() {
    // Subscribe to incoming messages via WebhookService
    this.webhookService.onMessageReceived(async (msg: IncomingWhatsappMessage) => {
      await this.handleIncomingMessage(msg);
    });
    this.logger.log({
      severity: LogSeverity.LOG,
      message: '[SUCCESS] Subscribed to message.received events',
    });
  }

  /**
   * Handles incoming messages from any channel (currently WhatsApp only)
   */
  private async handleIncomingMessage(msg: IncomingWhatsappMessage): Promise<void> {
    this.logger.log({
      severity: LogSeverity.LOG,
      message: `Processing message from ${msg.from} in session ${msg.sessionId}`,
    });

    // Extract phone number from remote JID (e.g. 5511999999999@c.us -> 5511999999999)
    const phone = msg.from.replace(/\D/g, '');
    const jidFormat = msg.from?.endsWith?.('@lid')
      ? 'LID'
      : msg.from?.endsWith?.('@c.us')
        ? 'c.us'
        : 'other';

    this.logger.debug({
      severity: LogSeverity.DEBUG,
      message: `[${msg.sessionId}] Extracted phone: ${phone} JID format: ${jidFormat} (original: ${msg.from})`,
    });

    const response = await this.processMessage(msg.sessionId, phone, msg.body);

    if (response) {
      // Emit outgoing message via WebhookService
      // IMPORTANT: We preserve the original JID (msg.from) to maintain @lid or @c.us format
      const outgoingMessage: OutgoingWhatsappMessage = {
        sessionId: msg.sessionId,
        to: msg.from, // ✅ Preserves @lid or @c.us format
        body: response,
      };

      this.logger.debug({
        severity: LogSeverity.DEBUG,
        message: `[${msg.sessionId}] Emitting response to: ${outgoingMessage.to}`,
      });

      this.webhookService.emitMessageSend(outgoingMessage);
    }
  }

  /**
   * Processes a message and generates a response based on the Funnel Tree
   *
   * @param sessionId - WhatsApp Session ID
   * @param phone - Phone number of the user
   * @param body - Message content
   * @returns Response message or null if no response needed
   */
  async processMessage(sessionId: string, phone: string, body: string): Promise<string | null> {
    // 1. Get or Create User Context
    const user = await this.chatbotUserService.getOrCreate(phone);
    const initialStep = user.currentStep;

    // Check if user is in HANDOFF state
    // TODO: Implement a timeout or manual reset for HANDOFF. For now, if in HANDOFF, we stop.
    // If you want to allow "reset", check for a keyword like #RESET
    if (initialStep === ChatbotState.HANDOFF_ACTIVE) {
      if (body.trim().toUpperCase() === '#VOLTAR') {
        await this.chatbotUserService.updateState(user.id, ChatbotState.START, {
          lastSessionId: sessionId,
        });
        return getMainMenuMessage();
      }
      return null; // Silently ignore to let human agent handle
    }

    const currentNode = FUNNEL_TREE[initialStep];

    if (!currentNode) {
      this.logger.error({
        severity: LogSeverity.ERROR,
        message: `Node ${initialStep} not found in FUNNEL_TREE. Resetting to START.`,
      });
      await this.chatbotUserService.updateState(user.id, ChatbotState.START, {
        lastSessionId: sessionId,
      });
      return getMainMenuMessage();
    }

    // 2. Normalize input (e.g. "Sair" -> "0") and validate against Current Node Options
    const rawInput = body.trim();
    const cleanInput = rawInput.toLowerCase() === 'sair' ? '0' : rawInput;
    let nextNodeId: string | null = null;
    let actionType = FlowAction.USER_MESSAGE;

    if (currentNode.options && currentNode.options[cleanInput]) {
      nextNodeId = currentNode.options[cleanInput];
    } else {
      // Input match failed
      const fallbackId = currentNode.fallbackNodeId || initialStep;

      // If staying on same node, it's an invalid input (or greeting at START)
      if (fallbackId === initialStep) {
        // At START: any unrecognized input is a valid greeting trigger - show menu without error
        if (initialStep === ChatbotState.START) {
          return getMainMenuMessage();
        }
        // Other menus: empathetic fallback + re-show options
        await this.logFlow(
          sessionId,
          phone,
          initialStep,
          initialStep,
          FlowAction.INVALID_INPUT,
          body,
        );
        return `Opa, não consegui entender "${cleanInput}".\n\n${currentNode.message}`;
      }

      nextNodeId = fallbackId;
    }

    // 3. Move to Next Node
    const nextNode = FUNNEL_TREE[nextNodeId];

    if (!nextNode) {
      this.logger.error({
        severity: LogSeverity.ERROR,
        message: `Next Node ${nextNodeId} not found. Staying at ${initialStep}.`,
      });
      return `Erro interno. Opção configurada incorretamente.`;
    }

    // 4. Handle Actions (HANDOFF, CLOSE)
    let finalStep = nextNodeId;
    if (nextNode.action === FlowAction.HANDOFF) {
      this.logger.log({ severity: LogSeverity.LOG, message: `Performing HANDOFF for ${phone}` });
      finalStep = ChatbotState.HANDOFF_ACTIVE; // Special state to block bot
      actionType = FlowAction.HANDOFF;
    } else if (nextNode.action === FlowAction.CLOSE) {
      // Logic to close ticket?
      // Reset to START for next interaction?
      // Usually we want to keep it "closed" until they talk again, effectively restarting.
      finalStep = ChatbotState.START;
      actionType = FlowAction.CLOSE;
    }

    // 5. Update User State (include lastSessionId for session-expiry lookups)
    await this.chatbotUserService.updateState(user.id, finalStep, {
      lastSessionId: sessionId,
    });

    // 6. Log Transition
    await this.logFlow(sessionId, phone, initialStep, finalStep, actionType, body);

    return nextNode.message;
  }

  /**
   * Logs the flow transition asynchronously
   */
  private async logFlow(
    sessionId: string,
    userPhone: string,
    previousStep: string,
    newStep: string,
    action: FlowAction,
    inputContent: string,
  ) {
    try {
      const log = this.flowLogRepository.create({
        sessionId,
        userPhone,
        previousStep,
        newStep,
        action,
        inputContent,
      });
      await this.flowLogRepository.save(log);
    } catch (e) {
      this.logger.error({
        severity: LogSeverity.ERROR,
        message: `Failed to log flow transition: ${e.message}`,
        stack: e.stack,
      });
    }
  }

  /**
   * Legacy webhook handler
   * @deprecated
   */
  async handleWebhook(payload: any) {
    this.logger.warn({
      severity: LogSeverity.WARNING,
      message: '[DEPRECATED] handleWebhook is deprecated. Use event-driven architecture instead.',
    });
    // Simple compatibility layer
    const sessionName = payload.session || 'default';
    const message = payload.type === 'message' ? payload.message : null;

    if (message && message.from && message.body) {
      const result = await this.processMessage(
        sessionName,
        message.from.replace(/\D/g, ''),
        message.body,
      );
      return { status: 'received', response: result };
    }
    return { status: 'received' };
  }
}
