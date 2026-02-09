import { WhatsappClientFactory } from './whatsapp-client.factory';
import * as wppconnect from '@wppconnect-team/wppconnect';
import { InternalServerErrorException } from '@nestjs/common';
import { DEFAULT_WHATSAPP_CONFIG } from '../config/whatsapp-client.config';

jest.mock('@wppconnect-team/wppconnect', () => ({
  create: jest.fn(),
}));

interface MakeSutTypes {
  sut: WhatsappClientFactory;
}

const makeSut = (): MakeSutTypes => {
  const sut = new WhatsappClientFactory();

  (sut as any).logger = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  };

  return { sut };
};

describe('WhatsappClientFactory', () => {
  describe('create', () => {
    const sessionName = 'test-session';
    const config = { sessionName };

    it('should call wppconnect.create with correct options', async () => {
      const { sut } = makeSut();
      const mockClient = { session: sessionName } as any;
      (wppconnect.create as jest.Mock).mockResolvedValue(mockClient);

      const result = await sut.create(config);

      expect(wppconnect.create).toHaveBeenCalledWith(
        expect.objectContaining({
          session: sessionName,
          headless: DEFAULT_WHATSAPP_CONFIG.headless,
          useChrome: DEFAULT_WHATSAPP_CONFIG.useChrome,
        }),
      );
      expect(result).toBe(mockClient);
    });

    it('should use provided config options instead of defaults', async () => {
      const { sut } = makeSut();
      const customConfig = {
        sessionName,
        headless: false,
        useChrome: false,
        debug: true,
      };

      await sut.create(customConfig);

      expect(wppconnect.create).toHaveBeenCalledWith(
        expect.objectContaining({
          session: sessionName,
          headless: false,
          useChrome: false,
          debug: true,
        }),
      );
    });

    it('should include optional callbacks in options', async () => {
      const { sut } = makeSut();
      const onQRCode = jest.fn();
      const onStatusChange = jest.fn();
      const configWithCallbacks = {
        sessionName,
        onQRCode,
        onStatusChange,
      };

      await sut.create(configWithCallbacks);

      expect(wppconnect.create).toHaveBeenCalledWith(
        expect.objectContaining({
          catchQR: onQRCode,
          statusFind: onStatusChange,
        }),
      );
    });

    it('should throw InternalServerErrorException if wppconnect.create fails', async () => {
      const { sut } = makeSut();
      const error = new Error('Connection failed');
      (wppconnect.create as jest.Mock).mockRejectedValue(error);

      await expect(sut.create(config)).rejects.toThrow(InternalServerErrorException);
      expect((sut as any).logger.error).toHaveBeenCalled();
    });
  });
});
