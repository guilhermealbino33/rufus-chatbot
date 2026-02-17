import { Test, TestingModule } from '@nestjs/testing';
import { ChatbotService } from './chatbot.service';
import { WebhookService } from '../../shared/services/webhook.service';
import { ChatbotUserService } from './chatbot-user.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { FlowLog } from './entities/flow-log.entity';
import { ChatbotState } from './enums';
import { Repository } from 'typeorm';
import { ChatbotUser } from './entities/chatbot-user.entity';

interface makeSutTypes {
  service: ChatbotService;
  chatbotUserService: ChatbotUserService;
  flowLogRepository: Repository<FlowLog>;
}

const makeSut = async (): Promise<makeSutTypes> => {
  const chatbotUserService = {
    getOrCreate: jest.fn(),
    updateState: jest.fn(),
  } as unknown as ChatbotUserService;

  const flowLogRepository = {
    create: jest.fn(),
    save: jest.fn(),
  } as unknown as Repository<FlowLog>;

  const webhookService = {
    onMessageReceived: jest.fn(),
    emitMessageSend: jest.fn(),
  } as unknown as WebhookService;

  const sut = new ChatbotService(webhookService, chatbotUserService, flowLogRepository);

  return {
    service: sut,
    chatbotUserService,
    flowLogRepository,
  };
};

const userExample: ChatbotUser = {
  id: 1,
  currentStep: ChatbotState.START,
  phoneNumber: '5511999999999',
  createdAt: new Date(),
  updatedAt: new Date(),
} as unknown as ChatbotUser;

describe('ChatbotService', () => {
  it('should be defined', async () => {
    const { service } = await makeSut();
    expect(service).toBeDefined();
  });

  describe('processMessage', () => {
    it('should return initial menu for new user', async () => {
      const { service, chatbotUserService } = await makeSut();
      jest.spyOn(chatbotUserService, 'getOrCreate').mockResolvedValue(userExample);
      jest.spyOn(chatbotUserService, 'updateState').mockResolvedValue(userExample);

      const response = await service.processMessage('session1', '5511999999999', 'Hello');

      expect(response).toContain('Olá! Bem-vindo ao Suporte da Rufus');
      // Should stay in START since input didn't match any option, but fallback is START
      expect(response).toContain('Opção inválida');
    });

    it('should transition to FINANCEIRO_MENU when user selects option 1', async () => {
      const { service, chatbotUserService } = await makeSut();
      jest.spyOn(chatbotUserService, 'getOrCreate').mockResolvedValue(userExample);

      const response = await service.processMessage('session1', '5511999999999', '1');

      expect(chatbotUserService.updateState).toHaveBeenCalledWith(1, 'FINANCEIRO_MENU');
      expect(response).toContain('Setor Financeiro');
    });

    it('should handle HANDOFF state', async () => {
      const { service, chatbotUserService } = await makeSut();
      jest.spyOn(chatbotUserService, 'getOrCreate').mockResolvedValue(userExample);

      // Select option 3 for human handoff
      const response = await service.processMessage('session1', '5511999999999', '3');

      expect(chatbotUserService.updateState).toHaveBeenCalledWith(1, ChatbotState.HANDOFF_ACTIVE);
      expect(response).toContain('transferindo seu atendimento');
    });

    it('should return null when in HANDOFF_ACTIVE state', async () => {
      const { service, chatbotUserService } = await makeSut();
      jest.spyOn(chatbotUserService, 'getOrCreate').mockResolvedValue({
        id: 1,
        currentStep: ChatbotState.HANDOFF_ACTIVE,
      } as unknown as ChatbotUser);

      const response = await service.processMessage('session1', '5511999999999', 'Hello');

      expect(response).toBeNull();
    });

    it('should reset to START when sending #VOLTAR in HANDOFF_ACTIVE', async () => {
      const { service, chatbotUserService } = await makeSut();

      jest.spyOn(chatbotUserService, 'getOrCreate').mockResolvedValue({
        id: 1,
        currentStep: ChatbotState.HANDOFF_ACTIVE,
      } as unknown as ChatbotUser);

      const response = await service.processMessage('session1', '5511999999999', '#VOLTAR');

      expect(chatbotUserService.updateState).toHaveBeenCalledWith(1, ChatbotState.START);
      expect(response).toContain('Bem-vindo ao Suporte da Rufus');
    });
  });
});
