import { EventEmitter2 } from "@nestjs/event-emitter";
import { WhatsappService } from "./whatsapp.service";
import { WhatsappSession } from "./entities/whatsapp-session.entity";
import { Repository } from "typeorm";
import * as wppconnect from '@wppconnect-team/wppconnect';
import { InternalServerErrorException, NotFoundException, RequestTimeoutException, BadRequestException } from "@nestjs/common";
import { SessionStatus } from "./enums/whatsapp.enum";

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
                status: SessionStatus.CONNECTED
            } as WhatsappSession);

            // Manually add client to map (simulating active memory)
            const mockClient = {
                close: jest.fn(),
                isConnected: jest.fn().mockResolvedValue(true)
            } as any;
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
            sessionRepository.create.mockReturnValue({ sessionName, status: SessionStatus.CONNECTING } as WhatsappSession);

            mockWppCreate.mockResolvedValue({
                onMessage: jest.fn(),
                getConnectionState: jest.fn(),
            });

            await sut.startSession(sessionName);

            expect(sessionRepository.create).toHaveBeenCalledWith({ sessionName, status: SessionStatus.CONNECTING });
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
                { qrCode: 'base64-code', status: SessionStatus.QRCODE }
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

            // Mock create to resolve AFTER the timeout
            let resolveCreate: (value: any) => void;
            mockWppCreate.mockImplementation(() => new Promise((res) => {
                resolveCreate = res;
            }));

            jest.useFakeTimers();

            const promise = sut.startSession(sessionName);

            // Advance time to trigger the service's internal timeout (20s)
            jest.advanceTimersByTime(21000);

            await expect(promise).rejects.toThrow(RequestTimeoutException);

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

        it('should send message successfully if number is valid', async () => {
            const { sut } = makeSut()

            const sessionName = 'active-session';
            const mockClient = {
                sendText: jest.fn().mockResolvedValue({ msgId: '123' }),
                checkNumberStatus: jest.fn().mockResolvedValue({
                    numberExists: true,
                    id: { _serialized: '5511999998888@c.us' }
                })
            };
            (sut as any).clients.set(sessionName, mockClient);

            const result = await sut.sendMessage(sessionName, '5511999998888', 'hello');

            expect(mockClient.checkNumberStatus).toHaveBeenCalledWith('5511999998888@c.us');
            expect(mockClient.sendText).toHaveBeenCalledWith('5511999998888@c.us', 'hello');
            expect(result.success).toBe(true);
        });

        it('should throw BadRequestException if number format is invalid', async () => {
            const { sut } = makeSut()

            const sessionName = 'active-session';
            const mockClient = {
                sendText: jest.fn(),
                checkNumberStatus: jest.fn()
            };
            (sut as any).clients.set(sessionName, mockClient);

            await expect(sut.sendMessage(sessionName, '123', 'short'))
                .rejects.toThrow(BadRequestException);

            expect(mockClient.checkNumberStatus).not.toHaveBeenCalled();
        });

        it('should throw BadRequestException if number does not exist on WhatsApp', async () => {
            const { sut } = makeSut()

            const sessionName = 'active-session';
            const mockClient = {
                sendText: jest.fn(),
                checkNumberStatus: jest.fn().mockResolvedValue({ numberExists: false })
            };
            (sut as any).clients.set(sessionName, mockClient);

            await expect(sut.sendMessage(sessionName, '5511999998888', 'hello'))
                .rejects.toThrow(BadRequestException);

            expect(mockClient.sendText).not.toHaveBeenCalled();
        });

        it('should throw InternalServerErrorException on send failure', async () => {
            const { sut } = makeSut()

            const sessionName = 'error-session';
            const mockClient = {
                checkNumberStatus: jest.fn().mockResolvedValue({
                    numberExists: true,
                    id: { _serialized: '5511999999999@c.us' }
                }),
                sendText: jest.fn().mockRejectedValue(new Error('Send failed'))
            };
            (sut as any).clients.set(sessionName, mockClient);

            await expect(sut.sendMessage(sessionName, '5511999999999', 'hi'))
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
        it('should return list of sessions with real-time status', async () => {
            const { sut, sessionRepository } = makeSut();

            const sessionName = 's1';
            const sessions = [{ sessionName, status: SessionStatus.CONNECTED }] as WhatsappSession[];
            sessionRepository.find.mockResolvedValue(sessions);
            sessionRepository.findOne.mockResolvedValue(sessions[0]);

            // Mock active client
            const mockClient = {
                isConnected: jest.fn().mockResolvedValue(true)
            };
            (sut as any).clients.set(sessionName, mockClient);

            const result = await sut.getAllSessions();

            expect(result.data).toHaveLength(1);
            expect(result.data[0].status).toBe(SessionStatus.CONNECTED);
            expect(result.data[0].sessionName).toBe(sessionName);
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
            const session = { sessionName, status: SessionStatus.CONNECTED } as WhatsappSession;
            sessionRepository.findOne.mockResolvedValue(session);

            const mockClient = {
                isConnected: jest.fn().mockResolvedValue(true),
                getConnectionState: jest.fn().mockResolvedValue('CONNECTED')
            };
            (sut as any).clients.set(sessionName, mockClient);

            const result = await sut.getSessionStatus(sessionName);

            expect(result.data.session.sessionName).toBe(sessionName);
            expect(result.data.isClientActive).toBe(true);
            expect(result.data.connectionState).toBe(SessionStatus.CONNECTED);
        });
    });

    describe('getQRCode', () => {
        it('should return connected status if already connected check passes', async () => {
            const { sut, sessionRepository } = makeSut();

            const sessionName = 'qr-conn';
            const session = { sessionName, qrCode: 'abc', status: SessionStatus.CONNECTED } as WhatsappSession;
            sessionRepository.findOne.mockResolvedValue(session);

            // Mock client active
            const mockClient = { isConnected: jest.fn().mockResolvedValue(true) };
            (sut as any).clients.set(sessionName, mockClient);

            const result = await sut.getQRCode(sessionName);
            expect(result.data.status).toBe(SessionStatus.CONNECTED);
            expect(result.data.message).toBeDefined();
        });

        it('should return qrcode if available and not connected', async () => {
            const { sut, sessionRepository } = makeSut()

            const sessionName = 'qr';
            const session = { sessionName, qrCode: 'abc', status: SessionStatus.QRCODE } as WhatsappSession;
            sessionRepository.findOne.mockResolvedValue(session);

            // No client in memory

            const result = await sut.getQRCode(sessionName);
            expect(result.data.qrCode).toBe('abc');
        });

        it('should return failure message if qrCode is null', async () => {
            const { sut, sessionRepository } = makeSut()

            const sessionName = 'no-qr';
            const session = { sessionName, qrCode: null } as WhatsappSession;
            sessionRepository.findOne.mockResolvedValue(session);

            const result = await sut.getQRCode(sessionName);
            expect(result.success).toBe(false);
        });
    });
});