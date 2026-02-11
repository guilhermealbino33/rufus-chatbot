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

describe('Chatbot Sandbox', () => {
  let service: ChatbotService;
  let repository: any;

  beforeEach(async () => {
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

    service = module.get<ChatbotService>(ChatbotService);
    repository = module.get(getRepositoryToken(ChatbotSession));

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should start a new session with START message if no session exists', async () => {
    const phone = '5511999999999';

    // Mock finding no session
    mockRepository.findOne.mockResolvedValue(null);
    // Mock creating session
    const newSession = { phone, currentNode: 'START', context: {} };
    mockRepository.create.mockReturnValue(newSession);
    mockRepository.save.mockResolvedValue(newSession);

    const response = await service.processMessage(phone, 'Hi');

    expect(mockRepository.findOne).toHaveBeenCalledWith({ where: { phone } });
    expect(mockRepository.create).toHaveBeenCalledWith({
      phone,
      currentNode: 'START',
      context: {},
    });
    expect(mockRepository.save).toHaveBeenCalled();
    // Since we created a new session and logic says "process input against START node",
    // "Hi" is not a valid option for START, so it should return invalid option message OR
    // maybe we should change logic to return START message on new session regardless of input?
    // Current logic: validates 'Hi' against START options. 'Hi' is invalid.
    // Returns "Opção inválida... + START message"
    expect(response).toContain('Opção inválida');
    expect(response).toContain(FUNNEL_TREE.START.message);
  });

  it('should process valid option 1 from START and move to FINANCEIRO_MENU', async () => {
    const phone = '5511999999999';
    const currentSession = { phone, currentNode: 'START', context: {} };

    mockRepository.findOne.mockResolvedValue(currentSession);
    mockRepository.save.mockImplementation((s) => Promise.resolve(s));

    const response = await service.processMessage(phone, '1');

    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        currentNode: 'FINANCEIRO_MENU',
      }),
    );
    expect(response).toBe(FUNNEL_TREE.FINANCEIRO_MENU.message);
  });

  it('should handle invalid option and stay on same node', async () => {
    const phone = '5511999999999';
    const currentSession = { phone, currentNode: 'START', context: {} };

    mockRepository.findOne.mockResolvedValue(currentSession);

    const response = await service.processMessage(phone, '99');

    // Should NOT update session (except maybe lastInteraction, but logic implies save is called only on nextNode)
    // Wait, logic says:
    // if invalid -> return error message.
    // Update: logic implementation:
    // if (currentNode.options[cleanInput]) { ... } else { return 'Invalid...' }
    // So repository.save is NOT called for invalid input.

    expect(repository.save).not.toHaveBeenCalled();
    expect(response).toContain('Opção inválida');
  });

  it('should handle navigation back to START', async () => {
    const phone = '5511999999999';
    const currentSession = { phone, currentNode: 'FINANCEIRO_MENU', context: {} };

    mockRepository.findOne.mockResolvedValue(currentSession);
    mockRepository.save.mockImplementation((s) => Promise.resolve(s));

    const response = await service.processMessage(phone, '3'); // 3 is Back to START in Financeiro

    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        currentNode: 'START',
      }),
    );
    expect(response).toBe(FUNNEL_TREE.START.message);
  });

  it('should handle CLOSE action', async () => {
    const phone = '5511999999999';
    // Mock session at a point where next step is close, e.g. PAYMENT_STATUS -> CLOSE
    // Wait, PAYMENT_STATUS has action CLOSE immediately.
    // But we need to Navigate TO it.
    // Let's say we are at FINANCEIRO_MENU and choose 2 (PAYMENT_STATUS)

    const currentSession = { phone, currentNode: 'FINANCEIRO_MENU', context: {} };
    mockRepository.findOne.mockResolvedValue(currentSession);
    mockRepository.save.mockImplementation((s) => Promise.resolve(s));

    const response = await service.processMessage(phone, '2');

    // It should update to PAYMENT_STATUS first
    // Then check action CLOSE
    // logic:
    // if (nextNode.action === 'CLOSE') { session.currentNode = 'START'; save(session) }

    // So we expect save to be called twice? Or once with START?
    // Implementation:
    // session.currentNode = nextNodeId; save();
    // if (action == CLOSE) { session.currentNode = 'START'; save(); }

    expect(repository.save).toHaveBeenCalledTimes(2);
    expect(repository.save).toHaveBeenLastCalledWith(
      expect.objectContaining({
        currentNode: 'START',
      }),
    );
    expect(response).toBe(FUNNEL_TREE.PAYMENT_STATUS.message);
  });
});
