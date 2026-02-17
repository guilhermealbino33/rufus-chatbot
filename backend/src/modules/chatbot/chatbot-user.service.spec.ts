import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatbotUserService } from './chatbot-user.service';
import { ChatbotUser } from './entities/chatbot-user.entity';
import { ChatbotState } from './enums/chatbot-state.enum';

interface MakeSutTypes {
  service: ChatbotUserService;
  repository: Repository<ChatbotUser>;
  mockRepository: {
    findOne: jest.Mock;
    findOneBy: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
}

const makeSut = async (): Promise<MakeSutTypes> => {
  const mockRepository = {
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      ChatbotUserService,
      {
        provide: getRepositoryToken(ChatbotUser),
        useValue: mockRepository,
      },
    ],
  }).compile();

  return {
    service: module.get<ChatbotUserService>(ChatbotUserService),
    repository: module.get<Repository<ChatbotUser>>(getRepositoryToken(ChatbotUser)),
    mockRepository,
  };
};

const mockChatbotUser = {
  id: 1,
  phoneNumber: '5511999999999',
  name: 'Test User',
  currentStep: ChatbotState.START,
  contextData: {},
  lastInteractionAt: new Date(),
} as ChatbotUser;

describe('ChatbotUserService', () => {
  it('should be defined', async () => {
    const { service } = await makeSut();
    expect(service).toBeDefined();
  });

  describe('getOrCreate', () => {
    it('should return existing user if found', async () => {
      const { service, mockRepository } = await makeSut();
      mockRepository.findOne.mockResolvedValue(mockChatbotUser);

      const result = await service.getOrCreate('5511999999999');

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { phoneNumber: '5511999999999' },
      });
      expect(result).toEqual(mockChatbotUser);
      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it('should create new user if not found', async () => {
      const { service, mockRepository } = await makeSut();
      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.create.mockReturnValue(mockChatbotUser);
      mockRepository.save.mockResolvedValue(mockChatbotUser);

      const result = await service.getOrCreate('5511999999999');

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { phoneNumber: '5511999999999' },
      });
      expect(mockRepository.create).toHaveBeenCalledWith({
        phoneNumber: '5511999999999',
        name: undefined,
        currentStep: ChatbotState.START,
        contextData: {},
      });
      expect(mockRepository.save).toHaveBeenCalled();
      expect(result).toEqual(mockChatbotUser);
    });

    it('should update name if existing user has no name', async () => {
      const { service, mockRepository } = await makeSut();
      const userWithoutName = { ...mockChatbotUser, name: null };
      mockRepository.findOne.mockResolvedValue(userWithoutName);
      mockRepository.save.mockResolvedValue({ ...userWithoutName, name: 'New Name' });

      await service.getOrCreate('5511999999999', 'New Name');

      expect(mockRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'New Name' }),
      );
    });
  });

  describe('updateState', () => {
    it('should update user state and context', async () => {
      const { service, mockRepository } = await makeSut();
      mockRepository.findOneBy.mockResolvedValue({ ...mockChatbotUser });
      mockRepository.save.mockImplementation((user) => Promise.resolve(user));

      const updates = { key: 'value' };
      const result = await service.updateState(1, 'NEXT_STEP', updates);

      expect(mockRepository.findOneBy).toHaveBeenCalledWith({ id: 1 });
      expect(result.currentStep).toBe('NEXT_STEP');
      expect(result.contextData).toEqual(expect.objectContaining(updates));
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('should throw error if user not found', async () => {
      const { service, mockRepository } = await makeSut();
      mockRepository.findOneBy.mockResolvedValue(null);

      await expect(service.updateState(999, 'NEXT_STEP')).rejects.toThrow('User 999 not found');
    });
  });
});
