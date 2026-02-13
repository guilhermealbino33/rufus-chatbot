import { Test, TestingModule } from '@nestjs/testing';
import { ChatbotService } from '../src/modules/chatbot/chatbot.service';
import { WebhookService } from '../src/shared/services/webhook.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ChatbotSession } from '../src/modules/chatbot/entities/chatbot-session.entity';
import { FUNNEL_TREE } from '../src/modules/chatbot/funnel.config';

// Mock WebhookService
const mockWebhookService = {
  onMessageReceived: jest.fn(),
  emitMessageSend: jest.fn(),
  onMessageSend: jest.fn(),
};

// Mock Repository
const mockRepository = {
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
};

interface SutTypes {
  sut: ChatbotService;
  chatbotSessionRepositoryStub: any;
  webhookServiceStub: any;
}

const makeSut = async (): Promise<SutTypes> => {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      ChatbotService,
      {
        provide: WebhookService,
        useValue: mockWebhookService,
      },
      {
        provide: getRepositoryToken(ChatbotSession),
        useValue: mockRepository,
      },
    ],
  }).compile();

  const sut = module.get<ChatbotService>(ChatbotService);
  const chatbotSessionRepositoryStub = module.get(getRepositoryToken(ChatbotSession));
  const webhookServiceStub = module.get(WebhookService);

  jest.clearAllMocks();

  return {
    sut,
    chatbotSessionRepositoryStub,
    webhookServiceStub,
  };
};

describe('Chatbot Sandbox', () => {
  it('should be defined', async () => {
    const { sut } = await makeSut();
    expect(sut).toBeDefined();
  });

  it('should start a new session with START message if no session exists', async () => {
    const { sut, chatbotSessionRepositoryStub } = await makeSut();
    const phone = '5511999999999';

    // Mock finding no session
    mockRepository.findOne.mockResolvedValue(null);
    // Mock creating session
    const newSession = { phone, currentNode: 'START', context: {} };
    mockRepository.create.mockReturnValue(newSession);
    mockRepository.save.mockResolvedValue(newSession);

    const response = await sut.processMessage(phone, 'Hi');

    expect(chatbotSessionRepositoryStub.findOne).toHaveBeenCalledWith({ where: { phone } });
    expect(chatbotSessionRepositoryStub.create).toHaveBeenCalledWith({
      phone,
      currentNode: 'START',
      context: {},
    });
    expect(chatbotSessionRepositoryStub.save).toHaveBeenCalled();
    expect(response).toContain('Opção inválida');
    expect(response).toContain(FUNNEL_TREE.START.message);
  });

  it('should process valid option 1 from START and move to FINANCEIRO_MENU', async () => {
    const { sut, chatbotSessionRepositoryStub } = await makeSut();
    const phone = '5511999999999';
    const currentSession = { phone, currentNode: 'START', context: {} };

    mockRepository.findOne.mockResolvedValue(currentSession);
    mockRepository.save.mockImplementation((s) => Promise.resolve(s));

    const response = await sut.processMessage(phone, '1');

    expect(chatbotSessionRepositoryStub.save).toHaveBeenCalledWith(
      expect.objectContaining({
        currentNode: 'FINANCEIRO_MENU',
      }),
    );
    expect(response).toBe(FUNNEL_TREE.FINANCEIRO_MENU.message);
  });

  it('should handle invalid option and stay on same node', async () => {
    const { sut, chatbotSessionRepositoryStub } = await makeSut();
    const phone = '5511999999999';
    const currentSession = { phone, currentNode: 'START', context: {} };

    mockRepository.findOne.mockResolvedValue(currentSession);

    const response = await sut.processMessage(phone, '99');

    expect(chatbotSessionRepositoryStub.save).not.toHaveBeenCalled();
    expect(response).toContain('Opção inválida');
  });

  it('should handle navigation back to START', async () => {
    const { sut, chatbotSessionRepositoryStub } = await makeSut();
    const phone = '5511999999999';
    const currentSession = { phone, currentNode: 'FINANCEIRO_MENU', context: {} };

    mockRepository.findOne.mockResolvedValue(currentSession);
    mockRepository.save.mockImplementation((s) => Promise.resolve(s));

    const response = await sut.processMessage(phone, '3'); // 3 is Back to START in Financeiro

    expect(chatbotSessionRepositoryStub.save).toHaveBeenCalledWith(
      expect.objectContaining({
        currentNode: 'START',
      }),
    );
    expect(response).toBe(FUNNEL_TREE.START.message);
  });

  it('should handle CLOSE action', async () => {
    const { sut, chatbotSessionRepositoryStub } = await makeSut();
    const phone = '5511999999999';

    const currentSession = { phone, currentNode: 'FINANCEIRO_MENU', context: {} };
    mockRepository.findOne.mockResolvedValue(currentSession);
    mockRepository.save.mockImplementation((s) => Promise.resolve(s));

    const response = await sut.processMessage(phone, '2');

    expect(chatbotSessionRepositoryStub.save).toHaveBeenCalledTimes(2);
    expect(chatbotSessionRepositoryStub.save).toHaveBeenLastCalledWith(
      expect.objectContaining({
        currentNode: 'START',
      }),
    );
    expect(response).toBe(FUNNEL_TREE.PAYMENT_STATUS.message);
  });
});
