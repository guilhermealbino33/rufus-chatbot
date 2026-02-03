import { EventEmitter2 } from "@nestjs/event-emitter";
import { WhatsappService } from "./whatsapp.service";
import { WhatsappSession } from "./entities/whatsapp-session.entity";
import { Repository } from "typeorm";
import * as wppconnect from '@wppconnect-team/wppconnect';
import { InternalServerErrorException, NotFoundException, RequestTimeoutException } from "@nestjs/common";

jest.mock('@wppconnect-team/wppconnect', () => ({
    create: jest.fn(),
}));

interface MakeSutTypes {
    sut: WhatsappService;
    sessionRepository: jest.Mocked<Repository<WhatsappSession>>;
    eventEmitter: jest.Mocked<EventEmitter2>;
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

    const eventEmitter = {
        emit: jest.fn(),
    } as unknown as jest.Mocked<EventEmitter2>;

    const sut = new WhatsappService(sessionRepository, eventEmitter);

    /**
     * @todo
     * Remover o uso de console log dentro do whatsapp.service
     */
    (sut as any).logger = {
        log: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
    };

    return {
        sut,
        sessionRepository,
        eventEmitter,
    };
}

describe('WhatsappService', () => {
    describe('startSession', () => {
        it('should return CONNECTED if session already exists and is active', async () => {
            const { sut, sessionRepository } = makeSut();

            const mockWppCreate = wppconnect.create as jest.Mock;

            const sessionName = 'test-session';
            sessionRepository.findOne.mockResolvedValue({
                sessionName,
                status: 'connected'
            } as WhatsappSession);

            // Manually add client to map (simulating active memory)
            const mockClient = { close: jest.fn() } as any;
            (sut as any).clients.set(sessionName, mockClient);

            const result = await sut.startSession(sessionName);

            expect(result).toEqual({ status: 'CONNECTED' });
            expect(mockWppCreate).not.toHaveBeenCalled();
        });

        it('should create new session record if not exists', async () => {
            const { sut, sessionRepository } = makeSut();

            const mockWppCreate = wppconnect.create as jest.Mock;

            const sessionName = 'new-session';
            sessionRepository.findOne.mockResolvedValue(null);
            sessionRepository.create.mockReturnValue({ sessionName, status: 'connecting' } as WhatsappSession);

            mockWppCreate.mockResolvedValue({
                onMessage: jest.fn(),
                getConnectionState: jest.fn(),
            });

            await sut.startSession(sessionName);

            expect(sessionRepository.create).toHaveBeenCalledWith({ sessionName, status: 'connecting' });
            expect(sessionRepository.save).toHaveBeenCalled();
        });

        it('should return QRCODE status when catchQR is triggered', async () => {
            const { sut, sessionRepository } = makeSut();

            const mockWppCreate = wppconnect.create as jest.Mock;

            const sessionName = 'qr-session';
            sessionRepository.findOne.mockResolvedValue(null);

            mockWppCreate.mockImplementation(({ catchQR }) => {
                // Simulate QR code generation
                catchQR('base64-code', 'ascii-code');
                return new Promise(() => { }); // Pending promise to simulate waiting
            });

            const result = await sut.startSession(sessionName);

            expect(result).toEqual({ status: 'QRCODE', qrcode: 'base64-code' });
            expect(sessionRepository.update).toHaveBeenCalledWith(
                { sessionName },
                { qrCode: 'base64-code', status: 'qrcode' }
            );
        });

        it('should return CONNECTED status when client is created successfully (w/o QR)', async () => {
            const { sut, sessionRepository } = makeSut();

            const mockWppCreate = wppconnect.create as jest.Mock;

            const sessionName = 'fast-session';
            sessionRepository.findOne.mockResolvedValue(null);

            const mockClient = {
                onMessage: jest.fn(),
                getConnectionState: jest.fn()
            };
            mockWppCreate.mockResolvedValue(mockClient);

            const result = await sut.startSession(sessionName);

            expect(result).toEqual({ status: 'CONNECTED' });
            // Ensure client is stored
            expect((sut as any).clients.has(sessionName)).toBe(true);
        });

        it.skip('should throw RequestTimeoutException if timeout is reached', async () => {
            const { sut, sessionRepository } = makeSut();

            const mockWppCreate = wppconnect.create as jest.Mock;

            const sessionName = 'timeout-session';
            sessionRepository.findOne.mockResolvedValue(null);

            // Mock create to resolve AFTER the timeout, ensuring the internal logic triggers timeout first.
            // Using a plain function that returns a promise that resolves later.
            let resolveCreate: (value: any) => void;
            mockWppCreate.mockImplementation(() => new Promise((res) => {
                resolveCreate = res;
            }));

            jest.useFakeTimers();

            const promise = sut.startSession(sessionName);

            // Advance time to trigger the service's internal timeout (20s)
            jest.advanceTimersByTime(21000); // 21s

            await expect(promise).rejects.toThrow(RequestTimeoutException);

            // Cleanup: resolve the pending create promise to avoid open handles
            if (resolveCreate!) resolveCreate({});
            jest.useRealTimers();
        });
    });

    describe('sendMessage', () => {
        it('should throw NotFoundException if session not connected', async () => {
            const { sut } = makeSut()

            await expect(sut.sendMessage('no-session', '123', 'hello'))
                .rejects.toThrow(NotFoundException);
        });

        it('should send message successfully if session is connected', async () => {
            const { sut } = makeSut()

            const sessionName = 'active-session';
            const mockClient = {
                sendText: jest.fn().mockResolvedValue({ msgId: '123' })
            };
            (sut as any).clients.set(sessionName, mockClient);

            const result = await sut.sendMessage(sessionName, '5511999999999', 'hello');

            expect(mockClient.sendText).toHaveBeenCalledWith('5511999999999@c.us', 'hello');
            expect(result.success).toBe(true);
        });

        it('should throw InternalServerErrorException on send failure', async () => {
            const { sut } = makeSut()

            const sessionName = 'error-session';
            const mockClient = {
                sendText: jest.fn().mockRejectedValue(new Error('Send failed'))
            };
            (sut as any).clients.set(sessionName, mockClient);

            await expect(sut.sendMessage(sessionName, '123', 'hi'))
                .rejects.toThrow(InternalServerErrorException);
        });
    });

    describe('getSession', () => {
        it('should return session data if found', async () => {
            const { sut, sessionRepository } = makeSut()

            const session = { sessionName: 's1' } as WhatsappSession;
            sessionRepository.findOne.mockResolvedValue(session);

            const result = await sut.getSession('s1');
            expect(result.data).toBe(session);
        });

        it('should throw NotFoundException if not found', async () => {
            const { sut, sessionRepository } = makeSut()

            sessionRepository.findOne.mockResolvedValue(null);
            await expect(sut.getSession('unknown')).rejects.toThrow(NotFoundException);
        });
    });

    describe('getAllSessions', () => {
        it('should return list of sessions', async () => {
            const { sut, sessionRepository } = makeSut()

            const sessions = [{ sessionName: 's1' }] as WhatsappSession[];
            sessionRepository.find.mockResolvedValue(sessions);

            const result = await sut.getAllSessions();
            expect(result.data).toBe(sessions);
        });
    });

    describe('deleteSession', () => {
        it('should close client and remove session from DB', async () => {
            const { sut, sessionRepository } = makeSut()

            const sessionName = 'del-session';
            const mockClient = { close: jest.fn().mockResolvedValue(true) };
            (sut as any).clients.set(sessionName, mockClient);

            const result = await sut.deleteSession(sessionName);

            expect(mockClient.close).toHaveBeenCalled();
            expect(sessionRepository.delete).toHaveBeenCalledWith({ sessionName });
            expect((sut as any).clients.has(sessionName)).toBe(false);
            expect(result.success).toBe(true);
        });
    });

    describe('getSessionStatus', () => {
        it('should return complete status with connection state', async () => {
            const { sut, sessionRepository } = makeSut()

            const sessionName = 'status-session';
            const session = { sessionName, status: 'connected' } as WhatsappSession;
            sessionRepository.findOne.mockResolvedValue(session);

            const mockClient = {
                getConnectionState: jest.fn().mockResolvedValue('CONNECTED')
            };
            (sut as any).clients.set(sessionName, mockClient);

            const result = await sut.getSessionStatus(sessionName);

            expect(result.data.session).toBe(session);
            expect(result.data.isClientActive).toBe(true);
            expect(result.data.connectionState).toBe('CONNECTED');
        });
    });

    describe('getQRCode', () => {
        it('should return qrcode if available', async () => {
            const { sut, sessionRepository } = makeSut()

            const session = { sessionName: 'qr', qrCode: 'abc' } as WhatsappSession;
            sessionRepository.findOne.mockResolvedValue(session);

            const result = await sut.getQRCode('qr');
            expect(result.data.qrCode).toBe('abc');
        });

        it('should return failure message if qrCode is null', async () => {
            const { sut, sessionRepository } = makeSut()

            const session = { sessionName: 'no-qr', qrCode: null } as WhatsappSession;
            sessionRepository.findOne.mockResolvedValue(session);

            const result = await sut.getQRCode('no-qr');
            expect(result.success).toBe(false);
        });
    });
});