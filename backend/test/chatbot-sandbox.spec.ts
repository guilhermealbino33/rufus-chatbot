import { Test, TestingModule } from '@nestjs/testing';
import { ChatbotService } from '../src/modules/chatbot/services/chatbot.service';
import { WebhookService } from '../src/shared/services/webhook.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ChatbotUser } from '../src/modules/chatbot/entities/chatbot-user.entity';
import { FlowLog } from '../src/modules/chatbot/entities/flow-log.entity';
import { ChatbotUserService } from '../src/modules/chatbot/services/chatbot-user.service';
import { FUNNEL_TREE } from '../src/modules/chatbot/config/funnel.config';
import { ChatbotState } from '../src/modules/chatbot/enums';

// Mock WebhookService
const mockWebhookService = {
  onMessageReceived: jest.fn(),
  emitMessageSend: jest.fn(),
  onMessageSend: jest.fn(),
};

// Mock Repositories
const mockFlowLogRepository = {
  create: jest.fn().mockImplementation((dto) => dto),
  save: jest.fn().mockImplementation((log) => Promise.resolve(log)),
};

const mockChatbotUserRepository = {
  findOne: jest.fn(),
  findOneBy: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
};

describe('Chatbot Sandbox', () => {
  let sut: ChatbotService;
  let chatbotUserService: ChatbotUserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatbotService,
        ChatbotUserService,
        {
          provide: WebhookService,
          useValue: mockWebhookService,
        },
        {
          provide: getRepositoryToken(ChatbotUser),
          useValue: mockChatbotUserRepository,
        },
        {
          provide: getRepositoryToken(FlowLog),
          useValue: mockFlowLogRepository,
        },
      ],
    }).compile();

    sut = module.get<ChatbotService>(ChatbotService);
    chatbotUserService = module.get<ChatbotUserService>(ChatbotUserService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(sut).toBeDefined();
  });

  it('should start a new session with START message if no user exists', async () => {
    const phone = '5511999999999';
    const sessionId = 'test-session';

    // Mock finding no user
    mockChatbotUserRepository.findOne.mockResolvedValue(null);
    // Mock creating user
    const newUser = { id: 1, phoneNumber: phone, currentStep: ChatbotState.START, contextData: {} };
    mockChatbotUserRepository.create.mockReturnValue(newUser);
    mockChatbotUserRepository.save.mockResolvedValue(newUser);
    mockChatbotUserRepository.findOneBy.mockResolvedValue(newUser);

    const response = await sut.processMessage(sessionId, phone, 'Hi');

    expect(mockChatbotUserRepository.findOne).toHaveBeenCalledWith({
      where: { phoneNumber: phone },
    });
    expect(mockChatbotUserRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        phoneNumber: phone,
        currentStep: ChatbotState.START,
      }),
    );
    expect(response).toContain('Opção inválida');
    expect(response).toContain(FUNNEL_TREE[ChatbotState.START].message);
  });

  it('should process valid option 1 from START and move to FINANCEIRO_MENU', async () => {
    const phone = '5511999999999';
    const sessionId = 'test-session';
    const currentUser = {
      id: 1,
      phoneNumber: phone,
      currentStep: ChatbotState.START,
      contextData: {},
    };

    mockChatbotUserRepository.findOne.mockResolvedValue(currentUser);
    mockChatbotUserRepository.findOneBy.mockResolvedValue(currentUser);
    mockChatbotUserRepository.save.mockImplementation((u) => Promise.resolve(u));

    const response = await sut.processMessage(sessionId, phone, '1');

    expect(mockChatbotUserRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        currentStep: 'FINANCEIRO_MENU',
      }),
    );
    expect(response).toBe(FUNNEL_TREE.FINANCEIRO_MENU.message);
  });

  it('should handle invalid option and stay on same node', async () => {
    const phone = '5511999999999';
    const sessionId = 'test-session';
    const currentUser = {
      id: 1,
      phoneNumber: phone,
      currentStep: ChatbotState.START,
      contextData: {},
    };

    mockChatbotUserRepository.findOne.mockResolvedValue(currentUser);

    const response = await sut.processMessage(sessionId, phone, '99');

    expect(response).toContain('Opção inválida');
    expect(response).toContain(FUNNEL_TREE.START.message);
  });

  it('should handle navigation back to START', async () => {
    const phone = '5511999999999';
    const sessionId = 'test-session';
    const currentUser = {
      id: 1,
      phoneNumber: phone,
      currentStep: 'FINANCEIRO_MENU',
      contextData: {},
    };

    mockChatbotUserRepository.findOne.mockResolvedValue(currentUser);
    mockChatbotUserRepository.findOneBy.mockResolvedValue(currentUser);
    mockChatbotUserRepository.save.mockImplementation((u) => Promise.resolve(u));

    const response = await sut.processMessage(sessionId, phone, '3'); // 3 is Back to START in Financeiro

    expect(mockChatbotUserRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        currentStep: ChatbotState.START,
      }),
    );
    expect(response).toBe(FUNNEL_TREE.START.message);
  });
});
