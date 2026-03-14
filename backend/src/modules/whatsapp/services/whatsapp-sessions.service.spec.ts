import { WhatsappSessionsService } from './whatsapp-sessions.service';
import { WhatsappSession } from '../entities/whatsapp-session.entity';
import { Repository } from 'typeorm';
import * as wppconnect from '@wppconnect-team/wppconnect';
import { NotFoundException } from '@nestjs/common';
import { SessionStatus } from '../enums/whatsapp.enum';
import { WebhookService } from '../../../shared/services/webhook.service';
import { WhatsappClientManager } from '../providers/whatsapp-client.manager';

jest.mock('@wppconnect-team/wppconnect', () => ({
  create: jest.fn(),
}));

interface MakeSutTypes {
  sut: WhatsappSessionsService;
  sessionRepository: jest.Mocked<Repository<WhatsappSession>>;
  clientManager: jest.Mocked<WhatsappClientManager>;
  webhookService: jest.Mocked<WebhookService>;
  loggerService: any;
}

const makeSut = (): MakeSutTypes => {
  const sessionRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    delete: jest.fn(),
    update: jest.fn(),
    find: jest.fn(),
  } as unknown as jest.Mocked<Repository<WhatsappSession>>;

  const webhookService = {
    emitMessageReceived: jest.fn(),
    onMessageReceived: jest.fn(),
    emitMessageSend: jest.fn(),
    onMessageSend: jest.fn(),
  } as unknown as jest.Mocked<WebhookService>;

  const clientManager = {
    getClient: jest.fn(),
    hasClient: jest.fn(),
    isClientConnected: jest.fn(),
    createClient: jest.fn(),
    removeClient: jest.fn(),
    cancelClient: jest.fn(),
    forceCloseClient: jest.fn(),
    getConnectionState: jest.fn(),
    isClientInitializing: jest.fn(),
  } as unknown as jest.Mocked<WhatsappClientManager>;

  const loggerService = {
    forContext: jest.fn().mockReturnValue({
      log: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
    }),
  };

  const sut = new WhatsappSessionsService(
    sessionRepository,
    clientManager as any,
    webhookService,
    loggerService as any,
  );

  (sut as any).logger = {
    log: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };

  return {
    sut,
    sessionRepository,
    clientManager: clientManager as any,
    webhookService,
    loggerService,
  };
};

describe('WhatsappSessionsService', () => {
  describe('start', () => {
    it('should return CONNECTED if session already exists and is active', async () => {
      const { sut, clientManager } = makeSut();

      const sessionName = 'test-session';
      clientManager.hasClient.mockReturnValue(true);
      clientManager.isClientConnected.mockResolvedValue(true);

      const result = await sut.start({ sessionName, phoneNumber: '5511999999999' });

      expect(result).toEqual({ status: SessionStatus.CONNECTED });
      expect(clientManager.createClient).not.toHaveBeenCalled();
    });

    it('should create new session record if not exists and return CONNECTING immediately', async () => {
      const { sut, sessionRepository, clientManager } = makeSut();

      const sessionName = 'new-session';
      sessionRepository.findOne.mockResolvedValue(null);
      sessionRepository.create.mockReturnValue({
        sessionName,
        status: SessionStatus.CONNECTING,
      } as WhatsappSession);

      clientManager.hasClient.mockReturnValue(false);
      // createClient may never resolve (background), but start() returns immediately
      clientManager.createClient.mockReturnValue(new Promise(() => {}));

      const result = await sut.start({ sessionName, phoneNumber: '5511999999999' });

      expect(sessionRepository.create).toHaveBeenCalledWith({
        sessionName,
        status: SessionStatus.CONNECTING,
      });
      expect(sessionRepository.save).toHaveBeenCalled();
      // start() now returns immediately without waiting for createClient
      expect(result).toEqual({ status: SessionStatus.CONNECTING });
    });

    it('should return CONNECTING immediately without waiting for QR code', async () => {
      const { sut, sessionRepository, clientManager } = makeSut();

      const sessionName = 'qr-session';
      sessionRepository.findOne.mockResolvedValue(null);
      clientManager.hasClient.mockReturnValue(false);

      // QR callback fires in background, but start() returns before it
      clientManager.createClient.mockReturnValue(new Promise(() => {}));

      const result = await sut.start({ sessionName, phoneNumber: '5511999999999' });

      // start() returns CONNECTING immediately, QR is persisted to DB in background
      expect(result).toEqual({ status: SessionStatus.CONNECTING });
    });

    it.skip('should throw RequestTimeoutException if timeout is reached', async () => {
      // This test is no longer relevant: start() returns immediately
      // and the client initialization runs in background.
    });
  });

  describe('cancelSession', () => {
    it('should cancel session and update DB status to CANCELED', async () => {
      const { sut, sessionRepository, clientManager } = makeSut();

      const sessionName = 'cancel-session';
      sessionRepository.findOne.mockResolvedValue({
        sessionName,
        status: SessionStatus.CONNECTING,
      } as WhatsappSession);

      const result = await sut.cancelSession(sessionName);

      expect(clientManager.cancelClient).toHaveBeenCalledWith(sessionName);
      expect(sessionRepository.update).toHaveBeenCalledWith(
        { sessionName },
        expect.objectContaining({
          status: SessionStatus.CANCELED,
          qrCode: null,
        }),
      );
      expect(result.success).toBe(true);
    });

    it('should throw NotFoundException if session not found', async () => {
      const { sut, sessionRepository } = makeSut();

      sessionRepository.findOne.mockResolvedValue(null);
      await expect(sut.cancelSession('unknown')).rejects.toThrow(NotFoundException);
    });
  });

  describe('get', () => {
    it('should return session data if found', async () => {
      const { sut, sessionRepository } = makeSut();

      const session = { sessionName: 's1' } as WhatsappSession;
      sessionRepository.findOne.mockResolvedValue(session);

      const result = await sut.get('s1');
      expect(result.data).toBe(session);
    });

    it('should throw NotFoundException if not found', async () => {
      const { sut, sessionRepository } = makeSut();

      sessionRepository.findOne.mockResolvedValue(null);
      await expect(sut.get('unknown')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getAll', () => {
    it('should return list of sessions with real-time status', async () => {
      const { sut, sessionRepository, clientManager } = makeSut();

      const sessionName = 's1';
      const sessions = [{ sessionName, status: SessionStatus.CONNECTED }] as WhatsappSession[];
      sessionRepository.find.mockResolvedValue(sessions);

      clientManager.hasClient.mockReturnValue(true);
      clientManager.isClientConnected.mockResolvedValue(true);

      const result = await sut.getAll();

      expect(result.data).toHaveLength(1);
      expect(result.data[0].status).toBe(SessionStatus.CONNECTED);
      expect(result.data[0].sessionName).toBe(sessionName);
    });
  });

  describe('delete', () => {
    it('should close client and remove session from DB', async () => {
      const { sut, sessionRepository, clientManager } = makeSut();

      const sessionName = 'del-session';
      const session = { sessionName } as WhatsappSession;
      sessionRepository.findOne.mockResolvedValue(session);

      const result = await sut.delete(sessionName);

      expect(clientManager.removeClient).toHaveBeenCalledWith(sessionName);
      expect(sessionRepository.delete).toHaveBeenCalledWith({ sessionName });
      expect(result.success).toBe(true);
    });

    it('should throw NotFoundException if session not found', async () => {
      const { sut, sessionRepository } = makeSut();

      const sessionName = 'unknown-session';
      sessionRepository.findOne.mockResolvedValue(null);

      await expect(sut.delete(sessionName)).rejects.toThrow(NotFoundException);
      expect(sessionRepository.delete).not.toHaveBeenCalled();
    });
  });

  describe('getStatus', () => {
    it('should return complete status with connection state', async () => {
      const { sut, sessionRepository, clientManager } = makeSut();

      const sessionName = 'status-session';
      const session = { sessionName, status: SessionStatus.CONNECTED } as WhatsappSession;
      sessionRepository.findOne.mockResolvedValue(session);

      clientManager.hasClient.mockReturnValue(true);
      clientManager.isClientConnected.mockResolvedValue(true);

      const result = await sut.getStatus(sessionName);

      expect(result.data.session.sessionName).toBe(sessionName);
      expect(result.data.isClientActive).toBe(true);
      expect(result.data.connectionState).toBe(SessionStatus.CONNECTED);
    });
  });

  describe('getQRCode', () => {
    it('should return connected status if already connected check passes', async () => {
      const { sut, sessionRepository, clientManager } = makeSut();

      const sessionName = 'qr-conn';
      const session = {
        sessionName,
        qrCode: 'abc',
        status: SessionStatus.CONNECTED,
      } as WhatsappSession;
      sessionRepository.findOne.mockResolvedValue(session);

      clientManager.hasClient.mockReturnValue(true);
      clientManager.isClientConnected.mockResolvedValue(true);

      const result = await sut.getQRCode(sessionName);
      expect(result.data.status).toBe(SessionStatus.CONNECTED);
      expect(result.data.message).toBeDefined();
    });

    it('should return qrcode if available and not connected', async () => {
      const { sut, sessionRepository, clientManager } = makeSut();

      const sessionName = 'qr';
      const session = {
        sessionName,
        qrCode: 'abc',
        status: SessionStatus.QRCODE,
      } as WhatsappSession;
      sessionRepository.findOne.mockResolvedValue(session);
      clientManager.hasClient.mockReturnValue(false);

      const result = await sut.getQRCode(sessionName);
      expect(result.data.qrCode).toBe('abc');
    });

    it('should return failure message if qrCode is null', async () => {
      const { sut, sessionRepository, clientManager } = makeSut();

      const sessionName = 'no-qr';
      const session = { sessionName, qrCode: null } as WhatsappSession;
      sessionRepository.findOne.mockResolvedValue(session);
      clientManager.hasClient.mockReturnValue(false);

      const result = await sut.getQRCode(sessionName);
      expect(result.success).toBe(false);
    });
  });

  describe('handleIncomingMessage', () => {
    it('should emit message with @c.us JID when both @c.us and @lid are present', async () => {
      const { sut, webhookService } = makeSut();
      const sessionName = 'test-session';

      const mockMessage = {
        id: { _serialized: 'msg_123' },
        from: '5511999998888@c.us',
        chatId: '257431800180973@lid',
        body: 'hello',
        t: 1625097600,
        isGroupMsg: false,
      } as any;

      await (sut as any).handleIncomingMessage(sessionName, mockMessage);

      expect(webhookService.emitMessageReceived).toHaveBeenCalledWith(
        expect.objectContaining({
          from: '5511999998888@c.us',
          chatId: '5511999998888@c.us', // It uses the same remoteJid for both
        }),
      );
    });

    it('should emit message with @lid JID if no @c.us/@g.us is available', async () => {
      const { sut, webhookService } = makeSut();
      const sessionName = 'test-session';

      const mockMessage = {
        id: { _serialized: 'msg_124' },
        from: '257431800180973@lid',
        chatId: { _serialized: '257431800180973@lid' },
        body: 'hello lid',
        t: 1625097600,
        isGroupMsg: false,
      } as any;

      await (sut as any).handleIncomingMessage(sessionName, mockMessage);

      expect(webhookService.emitMessageReceived).toHaveBeenCalledWith(
        expect.objectContaining({
          from: '257431800180973@lid',
        }),
      );
    });

    it('should extract JID from nested object with _serialized', async () => {
      const { sut, webhookService } = makeSut();
      const sessionName = 'test-session';

      const mockMessage = {
        id: 'msg_125',
        from: { _serialized: '5511999998888@c.us' },
        body: 'hello nested',
        t: 1625097600,
      } as any;

      await (sut as any).handleIncomingMessage(sessionName, mockMessage);

      expect(webhookService.emitMessageReceived).toHaveBeenCalledWith(
        expect.objectContaining({
          from: '5511999998888@c.us',
        }),
      );
    });
  });
});
