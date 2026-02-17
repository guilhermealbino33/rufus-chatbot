import { Repository } from 'typeorm';
import { ChatbotUserService } from './chatbot-user.service';
import { ChatbotUser } from './entities/chatbot-user.entity';
import { ChatbotState } from './enums/chatbot-state.enum';

interface MakeSutTypes {
  service: ChatbotUserService;
  repository: Repository<ChatbotUser>;
}

const makeSut = async (): Promise<MakeSutTypes> => {
  const mockRepository = {
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    create: jest.fn(),
    save: jest.fn().mockImplementation((user) => Promise.resolve(user as ChatbotUser)),
  } as unknown as Repository<ChatbotUser>;

  const sut = new ChatbotUserService(mockRepository);

  return {
    service: sut,
    repository: mockRepository,
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
      const { service, repository } = await makeSut();
      jest.spyOn(repository, 'findOne').mockResolvedValue(mockChatbotUser);

      const result = await service.getOrCreate('5511999999999');

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { phoneNumber: '5511999999999' },
      });
      expect(result).toEqual(mockChatbotUser);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('should create new user if not found', async () => {
      const { service, repository } = await makeSut();
      jest.spyOn(repository, 'findOne').mockResolvedValue(null);
      jest.spyOn(repository, 'create').mockReturnValue(mockChatbotUser);
      jest.spyOn(repository, 'save').mockResolvedValue(mockChatbotUser);

      const result = await service.getOrCreate('5511999999999');

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { phoneNumber: '5511999999999' },
      });
      expect(repository.create).toHaveBeenCalledWith({
        phoneNumber: '5511999999999',
        name: undefined,
        currentStep: ChatbotState.START,
        contextData: {},
      });
      expect(repository.save).toHaveBeenCalled();
      expect(result).toEqual(mockChatbotUser);
    });

    it('should update name if existing user has no name', async () => {
      const { service, repository } = await makeSut();
      const userWithoutName = { ...mockChatbotUser, name: null };
      jest.spyOn(repository, 'findOne').mockResolvedValue(userWithoutName);
      jest.spyOn(repository, 'save').mockResolvedValue({ ...userWithoutName, name: 'New Name' });

      await service.getOrCreate('5511999999999', 'New Name');

      expect(repository.save).toHaveBeenCalledWith(expect.objectContaining({ name: 'New Name' }));
    });
  });

  describe('updateState', () => {
    it('should update user state and context', async () => {
      const { service, repository } = await makeSut();
      jest.spyOn(repository, 'findOneBy').mockResolvedValue({ ...mockChatbotUser });

      const updates = { key: 'value' };
      const result = await service.updateState(1, 'NEXT_STEP', updates);

      expect(repository.findOneBy).toHaveBeenCalledWith({ id: 1 });
      expect(result.currentStep).toBe('NEXT_STEP');
      expect(result.contextData).toEqual(expect.objectContaining(updates));
      expect(repository.save).toHaveBeenCalled();
    });

    it('should throw error if user not found', async () => {
      const { service, repository } = await makeSut();
      jest.spyOn(repository, 'findOneBy').mockResolvedValue(null);

      await expect(service.updateState(999, 'NEXT_STEP')).rejects.toThrow('User 999 not found');
    });
  });
});
