import { WhatsappSessionsService } from './whatsapp-sessions.service';
import { WhatsappSession } from '../entities/whatsapp-session.entity';
import { Repository } from 'typeorm';
import * as wppconnect from '@wppconnect-team/wppconnect';
import { NotFoundException, RequestTimeoutException } from '@nestjs/common';
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
    getConnectionState: jest.fn(),
  } as unknown as jest.Mocked<WhatsappClientManager>;

  const sut = new WhatsappSessionsService(sessionRepository, clientManager as any, webhookService);

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

    it('should create new session record if not exists and initialize client', async () => {
      const { sut, sessionRepository, clientManager } = makeSut();

      const sessionName = 'new-session';
      sessionRepository.findOne.mockResolvedValue(null);
      sessionRepository.create.mockReturnValue({
        sessionName,
        status: SessionStatus.CONNECTING,
      } as WhatsappSession);

      clientManager.hasClient.mockReturnValue(false);
      clientManager.createClient.mockResolvedValue({
        onMessage: jest.fn(),
      } as any);

      const result = await sut.start({ sessionName, phoneNumber: '5511999999999' });

      expect(sessionRepository.create).toHaveBeenCalledWith({
        sessionName,
        status: SessionStatus.CONNECTING,
      });
      expect(sessionRepository.save).toHaveBeenCalled();
      expect(clientManager.createClient).toHaveBeenCalled();
      expect(result).toEqual({ status: SessionStatus.CONNECTED });
    });

    it('should return QRCODE status when onQRCode is triggered', async () => {
      const { sut, sessionRepository, clientManager } = makeSut();

      const sessionName = 'qr-session';
      sessionRepository.findOne.mockResolvedValue(null);
      clientManager.hasClient.mockReturnValue(false);

      clientManager.createClient.mockImplementation(async (name, config) => {
        // Simulate QR code generation via callback
        if (config.onQRCode) {
          config.onQRCode('base64-code', 'ascii-code');
        }
        return new Promise(() => {}); // Never resolves to simulate waiting for QR
      });

      const result = await sut.start({ sessionName, phoneNumber: '5511999999999' });

      expect(result).toEqual({ status: SessionStatus.CONNECTING, qrcode: 'base64-code' });
      expect(sessionRepository.update).toHaveBeenCalledWith(
        { sessionName },
        { qrCode: 'base64-code', status: SessionStatus.CONNECTING },
      );
    });

    it.skip('should throw RequestTimeoutException if timeout is reached', async () => {
      const { sut, sessionRepository, clientManager } = makeSut();

      const sessionName = 'timeout-session';
      sessionRepository.findOne.mockResolvedValue(null);
      clientManager.hasClient.mockReturnValue(false);

      // Mock createClient to never resolve
      clientManager.createClient.mockReturnValue(new Promise(() => {}));

      jest.useFakeTimers();

      const promise = sut.start({ sessionName, phoneNumber: '5511999999999' });

      // Advance time to trigger the service's internal timeout (20s)
      jest.advanceTimersByTime(21000);

      await expect(promise).rejects.toThrow(RequestTimeoutException);

      jest.useRealTimers();
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
});
