import { WebhookService } from '../../../shared/services/webhook.service';
import { WhatsappMessagesService } from './whatsapp-messages.service';
import {
  InternalServerErrorException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { WhatsappClientManager } from '../providers/whatsapp-client.manager';

interface MakeSutTypes {
  sut: WhatsappMessagesService;
  clientManager: jest.Mocked<WhatsappClientManager>;
  webhookService: jest.Mocked<WebhookService>;
  loggerService: any;
}

const makeSut = (): MakeSutTypes => {
  const webhookService = {
    emitMessageReceived: jest.fn(),
    onMessageSend: jest.fn(),
  } as unknown as jest.Mocked<WebhookService>;

  const clientManager = {
    getClient: jest.fn(),
  } as unknown as jest.Mocked<WhatsappClientManager>;

  const loggerService = {
    forContext: jest.fn().mockReturnValue({
      log: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
    }),
  };

  const sut = new WhatsappMessagesService(
    clientManager as any,
    webhookService,
    loggerService as any,
  );

  return {
    sut,
    clientManager: clientManager as any,
    webhookService,
    loggerService,
  };
};

function createMockClient(overrides: Record<string, unknown> = {}) {
  return {
    page: {
      evaluate: jest.fn().mockResolvedValue({ id: 'msg-123' }),
    },
    getContact: jest.fn().mockResolvedValue({ id: 'unknown@c.us' }),
    getPnLidEntry: jest.fn().mockResolvedValue({ phoneNumber: undefined }),
    ...overrides,
  };
}

describe('WhatsappMessagesService', () => {
  describe('send', () => {
    it('should throw NotFoundException if session not connected', async () => {
      const { sut, clientManager } = makeSut();
      clientManager.getClient.mockReturnValue(null);

      await expect(
        sut.send({ sessionName: 'no-session', phone: '123', message: 'hello' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should send message successfully via sendTextDirect for @c.us', async () => {
      const { sut, clientManager } = makeSut();

      const sessionName = 'active-session';
      const mockClient = createMockClient();
      clientManager.getClient.mockReturnValue(mockClient as any);

      const result = await sut.send({ sessionName, phone: '5511999998888', message: 'hello' });

      expect(mockClient.page.evaluate).toHaveBeenCalled();
      const evalCall = mockClient.page.evaluate.mock.calls[0];
      expect(evalCall[1]).toBe('5511999998888@c.us');
      expect(evalCall[2]).toBe('hello');
      expect(result.success).toBe(true);
    });

    it('should throw BadRequestException if number format is invalid', async () => {
      const { sut, clientManager } = makeSut();

      const sessionName = 'active-session';
      const mockClient = createMockClient();
      clientManager.getClient.mockReturnValue(mockClient as any);

      await expect(sut.send({ sessionName, phone: '123', message: 'short' })).rejects.toThrow(
        BadRequestException,
      );

      expect(mockClient.page.evaluate).not.toHaveBeenCalled();
    });

    it('should throw InternalServerErrorException on send failure', async () => {
      const { sut, clientManager } = makeSut();

      const sessionName = 'error-session';
      const mockClient = createMockClient({
        page: {
          evaluate: jest.fn().mockRejectedValue(new Error('Send failed')),
        },
      });
      clientManager.getClient.mockReturnValue(mockClient as any);

      await expect(
        sut.send({ sessionName, phone: '5511999999999', message: 'hi' }),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('should resolve LID via getPnLidEntry and send to @c.us', async () => {
      const { sut, clientManager } = makeSut();

      const sessionName = 'lid-session';
      const lidJid = '257431800180973@lid';
      const resolvedJid = '5511999998888@c.us';

      const mockClient = createMockClient({
        getPnLidEntry: jest.fn().mockResolvedValue({
          phoneNumber: { _serialized: resolvedJid },
        }),
      });
      clientManager.getClient.mockReturnValue(mockClient as any);

      const result = await sut.send({ sessionName, phone: lidJid, message: 'hello lid' });

      expect(mockClient.getPnLidEntry).toHaveBeenCalledWith(lidJid);
      expect(mockClient.page.evaluate).toHaveBeenCalled();
      const evalCall = mockClient.page.evaluate.mock.calls[0];
      expect(evalCall[1]).toBe(resolvedJid);
      expect(result.success).toBe(true);
    });

    it('should fallback to getContact when getPnLidEntry returns no @c.us', async () => {
      const { sut, clientManager } = makeSut();

      const sessionName = 'lid-fallback-session';
      const lidJid = '123456789@lid';
      const resolvedJid = '5511999998888@c.us';

      const mockClient = createMockClient({
        getPnLidEntry: jest.fn().mockRejectedValue(new Error('not found')),
        getContact: jest.fn().mockResolvedValue({ id: resolvedJid }),
      });
      clientManager.getClient.mockReturnValue(mockClient as any);

      const result = await sut.send({ sessionName, phone: lidJid, message: 'hello fallback' });

      expect(mockClient.getContact).toHaveBeenCalledWith(lidJid);
      expect(mockClient.page.evaluate).toHaveBeenCalled();
      const evalCall = mockClient.page.evaluate.mock.calls[0];
      expect(evalCall[1]).toBe(resolvedJid);
      expect(result.success).toBe(true);
    });

    it('should try direct LID send when no resolution is available', async () => {
      const { sut, clientManager } = makeSut();

      const sessionName = 'lid-direct-session';
      const lidJid = '123456789@lid';

      const mockClient = createMockClient({
        getPnLidEntry: jest.fn().mockRejectedValue(new Error('not found')),
        getContact: jest.fn().mockResolvedValue({ id: { _serialized: lidJid } }),
      });
      clientManager.getClient.mockReturnValue(mockClient as any);

      const result = await sut.send({ sessionName, phone: lidJid, message: 'hello direct lid' });

      expect(mockClient.page.evaluate).toHaveBeenCalled();
      const evalCall = mockClient.page.evaluate.mock.calls[0];
      expect(evalCall[1]).toBe(lidJid);
      expect(result.success).toBe(true);
    });
  });
});
