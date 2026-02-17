import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { WebhookService } from '../../shared/services/webhook.service';
import {
  IncomingWhatsappMessage,
  OutgoingWhatsappMessage,
} from '../../shared/interfaces/messaging.interface';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatbotUserService } from './chatbot-user.service';
import { FlowLog } from './entities/flow-log.entity';
import { FUNNEL_TREE } from './funnel.config';

@Injectable()
export class ChatbotService implements OnModuleInit {
  private readonly logger = new Logger(ChatbotService.name);

  constructor(
    private readonly webhookService: WebhookService,
    private readonly chatbotUserService: ChatbotUserService,
    @InjectRepository(FlowLog)
    private readonly flowLogRepository: Repository<FlowLog>,
  ) {}

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

    // Extract phone number from remote JID (e.g. 5511999999999@c.us -> 5511999999999)
    const phone = msg.from.replace(/\D/g, '');

    this.logger.debug(
      `[${msg.sessionId}] Extracted phone for session: ${phone} (original JID: ${msg.from})`,
    );

    const response = await this.processMessage(msg.sessionId, phone, msg.body);

    if (response) {
      // Emit outgoing message via WebhookService
      // IMPORTANT: We preserve the original JID (msg.from) to maintain @lid or @c.us format
      const outgoingMessage: OutgoingWhatsappMessage = {
        sessionId: msg.sessionId,
        to: msg.from, // ✅ Preserves @lid or @c.us format
        body: response,
      };

      this.logger.debug(`[${msg.sessionId}] Emitting response to: ${outgoingMessage.to}`);

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
    if (initialStep === 'HANDOFF_ACTIVE') {
      if (body.trim().toUpperCase() === '#VOLTAR') {
        await this.chatbotUserService.updateState(user.id, 'START');
        return FUNNEL_TREE.START.message;
      }
      return null; // Silently ignore to let human agent handle
    }

    const currentNode = FUNNEL_TREE[initialStep];

    if (!currentNode) {
      this.logger.error(`Node ${initialStep} not found in FUNNEL_TREE. Resetting to START.`);
      await this.chatbotUserService.updateState(user.id, 'START');
      return FUNNEL_TREE.START.message;
    }

    // 2. Validate Input against Current Node Options
    const cleanInput = body.trim();
    let nextNodeId: string | null = null;
    let actionType = 'USER_MESSAGE';

    if (currentNode.options && currentNode.options[cleanInput]) {
      nextNodeId = currentNode.options[cleanInput];
    } else {
      // Input match failed
      // Check if we stay in the same node or go to fallback
      // If we are just starting, maybe we should just send the menu without error?
      // For now, simple fallback logic:
      const fallbackId = currentNode.fallbackNodeId || initialStep;

      // If staying on same node, it's an invalid input
      if (fallbackId === initialStep) {
        // Log the "invalid input" event but don't change state
        await this.logFlow(sessionId, phone, initialStep, initialStep, 'INVALID_INPUT', body);
        return `Opção inválida. \n\n${currentNode.message}`;
      }

      nextNodeId = fallbackId;
    }

    // 3. Move to Next Node
    const nextNode = FUNNEL_TREE[nextNodeId];

    if (!nextNode) {
      this.logger.error(`Next Node ${nextNodeId} not found. Staying at ${initialStep}.`);
      return `Erro interno. Opção configurada incorretamente.`;
    }

    // 4. Handle Actions (HANDOFF, CLOSE)
    let finalStep = nextNodeId;
    if (nextNode.action === 'HANDOFF') {
      this.logger.log(`Performing HANDOFF for ${phone}`);
      finalStep = 'HANDOFF_ACTIVE'; // Special state to block bot
      actionType = 'HANDOFF';
    } else if (nextNode.action === 'CLOSE') {
      // Logic to close ticket?
      // Reset to START for next interaction?
      // Usually we want to keep it "closed" until they talk again, effectively restarting.
      finalStep = 'START';
      actionType = 'CLOSE';
    }

    // 5. Update User State
    await this.chatbotUserService.updateState(user.id, finalStep);

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
    action: string,
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
      this.logger.error(`Failed to log flow transition: ${e.message}`, e.stack);
    }
  }

  /**
   * Legacy webhook handler
   * @deprecated
   */
  async handleWebhook(payload: any) {
    this.logger.warn('⚠️ handleWebhook is deprecated. Use event-driven architecture instead.');
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
