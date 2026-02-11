import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { WebhookService } from '../../shared/services/webhook.service';
import {
  IncomingWhatsappMessage,
  OutgoingWhatsappMessage,
} from '../../shared/interfaces/messaging.interface';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatbotSession } from './entities/chatbot-session.entity';
import { FUNNEL_TREE } from './funnel.config';

@Injectable()
export class ChatbotService implements OnModuleInit {
  private readonly logger = new Logger(ChatbotService.name);

  constructor(
    private readonly webhookService: WebhookService,
    @InjectRepository(ChatbotSession)
    private chatbotSessionRepository: Repository<ChatbotSession>,
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

    const response = await this.processMessage(phone, msg.body);

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
   * Processes a message and generates a response based on the Funnel Tree
   *
   * @param phone - Phone number of the sender
   * @param body - Message content
   * @returns Response message or null if no response needed
   */
  async processMessage(phone: string, body: string): Promise<string | null> {
    // 1. Get or Create Session
    let session = await this.chatbotSessionRepository.findOne({ where: { phone } });

    if (!session) {
      session = this.chatbotSessionRepository.create({
        phone,
        currentNode: 'START',
        context: {},
      });
      await this.chatbotSessionRepository.save(session);

      // If it's a new session, verify if we should send the START message or wait for input
      // For now, let's process the input against the START node
    }

    const currentNodeId = session.currentNode;
    const currentNode = FUNNEL_TREE[currentNodeId];

    if (!currentNode) {
      this.logger.error(`Node ${currentNodeId} not found in FUNNEL_TREE. Resetting to START.`);
      session.currentNode = 'START';
      await this.chatbotSessionRepository.save(session);
      return FUNNEL_TREE.START.message;
    }

    // 2. Validate Input against Current Node Options
    const cleanInput = body.trim();
    let nextNodeId: string | null = null;
    const responseMessage: string | null = null;

    // Check if current node implies an action without input (e.g. just sending info)
    // But usually we wait for user input to move info.

    if (currentNode.options && currentNode.options[cleanInput]) {
      nextNodeId = currentNode.options[cleanInput];
    } else {
      // Input match failed
      // Check if we stay in the same node or go to fallback
      const fallbackId = currentNode.fallbackNodeId || currentNodeId;

      // If we are in START and user says "Hi", we might just want to send the menu again
      // For now, return the current node message as "Invalid option" feedback implies showing options again
      return `Opção inválida. \n\n${currentNode.message}`;
    }

    // 3. Move to Next Node
    const nextNode = FUNNEL_TREE[nextNodeId];

    if (!nextNode) {
      this.logger.error(`Next Node ${nextNodeId} not found. Staying at ${currentNodeId}.`);
      return `Erro interno. Opção configurada incorretamente.`;
    }

    // Update Session
    session.currentNode = nextNodeId;
    session.lastInteraction = new Date();
    await this.chatbotSessionRepository.save(session);

    // 4. Handle Actions (HANDOFF, CLOSE)
    if (nextNode.action === 'HANDOFF') {
      // Logic to notify attendants would go here
      this.logger.log(`Performing HANDOFF for ${phone}`);
    } else if (nextNode.action === 'CLOSE') {
      // Reset session for next time? or keep it closed?
      // Let's reset to START for next interaction after action
      session.currentNode = 'START';
      await this.chatbotSessionRepository.save(session);
    }

    return nextNode.message;
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
