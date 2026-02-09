import { WhatsappClientManager } from './whatsapp-client.manager';
import { WhatsappClientFactory } from './whatsapp-client.factory';
import * as wppconnect from '@wppconnect-team/wppconnect';

interface MakeSutTypes {
  sut: WhatsappClientManager;
  factory: jest.Mocked<WhatsappClientFactory>;
}

const makeSut = (): MakeSutTypes => {
  const factory = {
    create: jest.fn(),
  } as unknown as jest.Mocked<WhatsappClientFactory>;

  const sut = new WhatsappClientManager(factory);

  // Mock logger
  (sut as any).logger = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  };

  return { sut, factory };
};

const mockClient = (sessionName: string) =>
  ({
    session: sessionName,
    close: jest.fn().mockResolvedValue(true),
    isConnected: jest.fn().mockResolvedValue(true),
    getConnectionState: jest.fn().mockResolvedValue('CONNECTED' as any),
  }) as unknown as jest.Mocked<wppconnect.Whatsapp>;

describe('WhatsappClientManager', () => {
  describe('createClient', () => {
    it('should create and store a new client', async () => {
      const { sut, factory } = makeSut();
      const sessionName = 'new-session';
      const config = { sessionName } as any;
      const client = mockClient(sessionName);
      factory.create.mockResolvedValue(client);

      const result = await sut.createClient(sessionName, config);

      expect(factory.create).toHaveBeenCalledWith(config);
      expect(sut.getClient(sessionName)).toBe(client);
      expect(result).toBe(client);
    });

    it('should return existing client if already created', async () => {
      const { sut, factory } = makeSut();
      const sessionName = 'existing-session';
      const config = { sessionName } as any;
      const client = mockClient(sessionName);
      factory.create.mockResolvedValue(client);

      // Create first time
      await sut.createClient(sessionName, config);

      // Try create second time
      const result = await sut.createClient(sessionName, config);

      expect(factory.create).toHaveBeenCalledTimes(1);
      expect(result).toBe(client);
      expect((sut as any).logger.warn).toHaveBeenCalledWith(
        expect.stringContaining(`Client for ${sessionName} already exists`),
      );
    });
  });

  describe('getClient/hasClient', () => {
    it('should return undefined and false if client does not exist', () => {
      const { sut } = makeSut();
      expect(sut.getClient('unknown')).toBeUndefined();
      expect(sut.hasClient('unknown')).toBe(false);
    });

    it('should return client and true if client exists', async () => {
      const { sut, factory } = makeSut();
      const sessionName = 'active-session';
      const client = mockClient(sessionName);
      factory.create.mockResolvedValue(client);
      await sut.createClient(sessionName, { sessionName } as any);

      expect(sut.getClient(sessionName)).toBe(client);
      expect(sut.hasClient(sessionName)).toBe(true);
    });
  });

  describe('removeClient', () => {
    it('should close and remove client from memory', async () => {
      const { sut, factory } = makeSut();
      const sessionName = 'session-to-remove';
      const client = mockClient(sessionName);
      factory.create.mockResolvedValue(client);
      await sut.createClient(sessionName, { sessionName } as any);

      await sut.removeClient(sessionName);

      expect(client.close).toHaveBeenCalled();
      expect(sut.hasClient(sessionName)).toBe(false);
    });

    it('should log error if close fails but still remove from memory', async () => {
      const { sut, factory } = makeSut();
      const sessionName = 'faulty-session';
      const client = mockClient(sessionName);
      client.close.mockRejectedValue(new Error('Close failed'));
      factory.create.mockResolvedValue(client);
      await sut.createClient(sessionName, { sessionName } as any);

      await sut.removeClient(sessionName);

      expect((sut as any).logger.error).toHaveBeenCalled();
      expect(sut.hasClient(sessionName)).toBe(false);
    });
  });

  describe('isClientConnected', () => {
    it('should return true if client is connected', async () => {
      const { sut, factory } = makeSut();
      const sessionName = 'conn';
      const client = mockClient(sessionName);
      factory.create.mockResolvedValue(client);
      await sut.createClient(sessionName, { sessionName } as any);

      const isConnected = await sut.isClientConnected(sessionName);
      expect(isConnected).toBe(true);
      expect(client.isConnected).toHaveBeenCalled();
    });

    it('should return false and remove client if isConnected throws', async () => {
      const { sut, factory } = makeSut();
      const sessionName = 'dead-session';
      const client = mockClient(sessionName);
      client.isConnected.mockRejectedValue(new Error('Dead'));
      factory.create.mockResolvedValue(client);
      await sut.createClient(sessionName, { sessionName } as any);

      const isConnected = await sut.isClientConnected(sessionName);
      expect(isConnected).toBe(false);
      expect(sut.hasClient(sessionName)).toBe(false);
    });
  });

  describe('getConnectionState', () => {
    it('should return state from client', async () => {
      const { sut, factory } = makeSut();
      const sessionName = 'state-session';
      const client = mockClient(sessionName);
      client.getConnectionState.mockResolvedValue('CONNECTED' as any);
      factory.create.mockResolvedValue(client);
      await sut.createClient(sessionName, { sessionName } as any);

      const state = await sut.getConnectionState(sessionName);
      expect(state).toBe('CONNECTED');
    });

    it('should return null if client does not exist', async () => {
      const { sut } = makeSut();
      const state = await sut.getConnectionState('none');
      expect(state).toBeNull();
    });
  });

  describe('closeAll', () => {
    it('should close all active clients', async () => {
      const { sut, factory } = makeSut();
      const c1 = mockClient('s1');
      const c2 = mockClient('s2');
      factory.create.mockResolvedValueOnce(c1).mockResolvedValueOnce(c2);

      await sut.createClient('s1', { sessionName: 's1' } as any);
      await sut.createClient('s2', { sessionName: 's2' } as any);

      await sut.closeAll();

      expect(c1.close).toHaveBeenCalled();
      expect(c2.close).toHaveBeenCalled();
      expect(sut.hasClient('s1')).toBe(false);
      expect(sut.hasClient('s2')).toBe(false);
    });
  });

  describe('onModuleDestroy', () => {
    it('should call closeAll', async () => {
      const { sut } = makeSut();
      const closeAllSpy = jest.spyOn(sut, 'closeAll').mockResolvedValue();
      await sut.onModuleDestroy();
      expect(closeAllSpy).toHaveBeenCalled();
    });
  });
});
