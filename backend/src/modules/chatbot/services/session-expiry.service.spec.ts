import { Test, TestingModule } from '@nestjs/testing';
import { SessionExpiryService } from './session-expiry.service';
import { ChatbotUserService } from './chatbot-user.service';
import { WebhookService } from '@/shared/services/webhook.service';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FlowLog } from '../entities/flow-log.entity';
import { AppLoggerService } from '@/shared/services/logger.service';
import { ChatbotState, FlowAction } from '../enums';
import { LogSeverity } from '@/shared/interfaces/logger.interface';

interface MakeSutTypes {
  sut: SessionExpiryService;
  chatbotUserService: jest.Mocked<ChatbotUserService>;
  webhookService: jest.Mocked<WebhookService>;
  configService: jest.Mocked<ConfigService>;
  flowLogRepository: jest.Mocked<Repository<FlowLog>>;
  loggerService: any;
}

const makeSut = (): MakeSutTypes => {
  const chatbotUserService = {
    findInactiveUsers: jest.fn(),
    updateState: jest.fn(),
  } as unknown as jest.Mocked<ChatbotUserService>;

  const webhookService = {
    emitMessageSend: jest.fn(),
  } as unknown as jest.Mocked<WebhookService>;

  const configService = {
    get: jest.fn(),
  } as unknown as jest.Mocked<ConfigService>;

  const flowLogRepository = {
    createQueryBuilder: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getOne: jest.fn(),
    }),
    create: jest.fn(),
    save: jest.fn(),
  } as unknown as jest.Mocked<Repository<FlowLog>>;

  const loggerService = {
    forContext: jest.fn().mockReturnValue({
      log: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
    }),
  };

  const sut = new SessionExpiryService(
    chatbotUserService,
    webhookService,
    configService,
    flowLogRepository,
    loggerService as any,
  );

  return {
    sut,
    chatbotUserService,
    webhookService,
    configService,
    flowLogRepository,
    loggerService,
  };
};

describe('SessionExpiryService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('expireInactiveSessions', () => {
    it('should return early if no inactive users are found', async () => {
      const { sut, chatbotUserService, loggerService } = makeSut();
      chatbotUserService.findInactiveUsers.mockResolvedValue([]);

      await sut.expireInactiveSessions();

      expect(chatbotUserService.findInactiveUsers).toHaveBeenCalled();
      expect(loggerService.forContext().log).not.toHaveBeenCalled();
    });

    it('should process inactive users and expire their sessions', async () => {
      const { sut, chatbotUserService, webhookService, flowLogRepository, configService } =
        makeSut();

      const mockUser = {
        id: 'user-id',
        phoneNumber: '5511999998888',
        currentStep: 'SOME_STEP',
        contextData: { lastSessionId: 'active-session' },
      };

      chatbotUserService.findInactiveUsers.mockResolvedValue([mockUser as any]);
      configService.get.mockImplementation((key: string) => {
        if (key === 'SESSION_TIMEOUT_MINUTES') return '15';
        if (key === 'SESSION_EXPIRY_DEFAULT_SESSION') return 'default';
        return null;
      });

      await sut.expireInactiveSessions();

      expect(webhookService.emitMessageSend).toHaveBeenCalledWith({
        sessionId: 'active-session',
        to: '5511999998888@c.us',
        body: expect.any(String),
      });

      expect(chatbotUserService.updateState).toHaveBeenCalledWith('user-id', ChatbotState.START);
      expect(flowLogRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'active-session',
          userPhone: '5511999998888',
          action: FlowAction.TIMEOUT,
        }),
      );
      expect(flowLogRepository.save).toHaveBeenCalled();
    });

    it('should use default session if user has no lastSessionId and no logs found', async () => {
      const { sut, chatbotUserService, webhookService, flowLogRepository, configService } =
        makeSut();

      const mockUser = {
        id: 'user-id',
        phoneNumber: '5511999998888',
        currentStep: 'SOME_STEP',
        contextData: {}, // No lastSessionId
      };

      chatbotUserService.findInactiveUsers.mockResolvedValue([mockUser as any]);
      configService.get.mockReturnValue('default');

      // Mock getLastSessionForUser to return null
      (flowLogRepository.createQueryBuilder().getOne as jest.Mock).mockResolvedValue(null);

      await sut.expireInactiveSessions();

      expect(webhookService.emitMessageSend).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'default',
        }),
      );
    });

    it('should fetch session from logs if lastSessionId is missing', async () => {
      const { sut, chatbotUserService, webhookService, flowLogRepository, configService } =
        makeSut();

      const mockUser = {
        id: 'user-id',
        phoneNumber: '5511999998888',
        currentStep: 'SOME_STEP',
        contextData: {},
      };

      chatbotUserService.findInactiveUsers.mockResolvedValue([mockUser as any]);
      configService.get.mockReturnValue('default');

      (flowLogRepository.createQueryBuilder().getOne as jest.Mock).mockResolvedValue({
        sessionId: 'logged-session',
      });

      await sut.expireInactiveSessions();

      expect(webhookService.emitMessageSend).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'logged-session',
        }),
      );
    });

    it('should continue processing other users if one fails', async () => {
      const { sut, chatbotUserService, webhookService, loggerService } = makeSut();

      const user1 = { id: '1', phoneNumber: '111', contextData: { lastSessionId: 's1' } };
      const user2 = { id: '2', phoneNumber: '222', contextData: { lastSessionId: 's2' } };

      chatbotUserService.findInactiveUsers.mockResolvedValue([user1 as any, user2 as any]);

      // Fail for user1
      webhookService.emitMessageSend.mockImplementationOnce(() => {
        throw new Error('Send failed');
      });

      await sut.expireInactiveSessions();

      // Should still try for user2
      expect(webhookService.emitMessageSend).toHaveBeenCalledTimes(2);
      expect(chatbotUserService.updateState).toHaveBeenCalledWith('2', ChatbotState.START);
      expect(loggerService.forContext().error).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Failed to expire session for 111'),
        }),
      );
    });
  });
});
