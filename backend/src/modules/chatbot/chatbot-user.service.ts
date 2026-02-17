import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatbotUser } from './entities/chatbot-user.entity';
import { ChatbotState } from './enums/chatbot-state.enum';

@Injectable()
export class ChatbotUserService {
  private readonly logger = new Logger(ChatbotUserService.name);

  constructor(
    @InjectRepository(ChatbotUser)
    private readonly chatbotUserRepository: Repository<ChatbotUser>,
  ) {}

  /**
   * Retrieves an existing user by phone number or creates a new one.
   * This ensures we always have a user context to work with.
   */
  async getOrCreate(phoneNumber: string, name?: string): Promise<ChatbotUser> {
    let user = await this.chatbotUserRepository.findOne({ where: { phoneNumber } });

    if (!user) {
      this.logger.log(`Creating new ChatbotUser for ${phoneNumber}`);
      user = this.chatbotUserRepository.create({
        phoneNumber,
        name,
        currentStep: ChatbotState.START,
        contextData: {},
      });
      await this.chatbotUserRepository.save(user);
    } else if (name && !user.name) {
      // Update name if provided and not already set
      user.name = name;
      await this.chatbotUserRepository.save(user);
    }

    return user;
  }

  /**
   * Updates the user's current step and context.
   */
  async updateState(
    userId: number,
    newStep: string,
    updates: Record<string, any> = {},
  ): Promise<ChatbotUser> {
    const user = await this.chatbotUserRepository.findOneBy({ id: userId });

    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    user.currentStep = newStep;
    user.contextData = { ...user.contextData, ...updates };
    user.lastInteractionAt = new Date(); // Reset inactivity timer? This updates the interaction time.

    return this.chatbotUserRepository.save(user);
  }
}
