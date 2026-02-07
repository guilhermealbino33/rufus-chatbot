import { WebhookService } from "../../../shared/services/webhook.service";
import { WhatsappMessagesService } from "./whatsapp-messages.service";
import { InternalServerErrorException, NotFoundException, BadRequestException } from "@nestjs/common";
import { WhatsappClientManager } from "../providers/whatsapp-client.manager";

interface MakeSutTypes {
    sut: WhatsappMessagesService;
    clientManager: jest.Mocked<WhatsappClientManager>;
    webhookService: jest.Mocked<WebhookService>;
}

const makeSut = (): MakeSutTypes => {
    const webhookService = {
        emitMessageReceived: jest.fn(),
        onMessageSend: jest.fn(),
    } as unknown as jest.Mocked<WebhookService>;

    const clientManager = {
        getClient: jest.fn(),
    } as unknown as jest.Mocked<WhatsappClientManager>;

    const sut = new WhatsappMessagesService(clientManager as any, webhookService);

    return {
        sut,
        clientManager: clientManager as any,
        webhookService,
    };
}

describe('WhatsappMessagesService', () => {
    describe('send', () => {
        it('should throw NotFoundException if session not connected', async () => {
            const { sut, clientManager } = makeSut()
            clientManager.getClient.mockReturnValue(null);

            await expect(sut.send({ sessionName: 'no-session', phone: '123', message: 'hello' }))
                .rejects.toThrow(NotFoundException);
        });

        it('should send message successfully if number is valid', async () => {
            const { sut, clientManager } = makeSut()

            const sessionName = 'active-session';
            const mockClient = {
                sendText: jest.fn().mockResolvedValue({ msgId: '123' }),
                checkNumberStatus: jest.fn().mockResolvedValue({
                    numberExists: true,
                    id: { _serialized: '5511999998888@c.us' }
                })
            };
            clientManager.getClient.mockReturnValue(mockClient as any);

            const result = await sut.send({ sessionName, phone: '5511999998888', message: 'hello' });

            expect(mockClient.checkNumberStatus).toHaveBeenCalledWith('5511999998888@c.us');
            expect(mockClient.sendText).toHaveBeenCalledWith('5511999998888@c.us', 'hello');
            expect(result.success).toBe(true);
        });

        it('should throw BadRequestException if number format is invalid', async () => {
            const { sut, clientManager } = makeSut()

            const sessionName = 'active-session';
            const mockClient = {
                sendText: jest.fn(),
                checkNumberStatus: jest.fn()
            };
            clientManager.getClient.mockReturnValue(mockClient as any);

            await expect(sut.send({ sessionName, phone: '123', message: 'short' }))
                .rejects.toThrow(BadRequestException);

            expect(mockClient.checkNumberStatus).not.toHaveBeenCalled();
        });

        it('should throw BadRequestException if number does not exist on WhatsApp', async () => {
            const { sut, clientManager } = makeSut()

            const sessionName = 'active-session';
            const mockClient = {
                sendText: jest.fn(),
                checkNumberStatus: jest.fn().mockResolvedValue({ numberExists: false })
            };
            clientManager.getClient.mockReturnValue(mockClient as any);

            await expect(sut.send({ sessionName, phone: '5511999998888', message: 'hello' }))
                .rejects.toThrow(BadRequestException);

            expect(mockClient.sendText).not.toHaveBeenCalled();
        });

        it('should throw InternalServerErrorException on send failure', async () => {
            const { sut, clientManager } = makeSut()

            const sessionName = 'error-session';
            const mockClient = {
                checkNumberStatus: jest.fn().mockResolvedValue({
                    numberExists: true,
                    id: { _serialized: '5511999999999@c.us' }
                }),
                sendText: jest.fn().mockRejectedValue(new Error('Send failed'))
            };
            clientManager.getClient.mockReturnValue(mockClient as any);

            await expect(sut.send({ sessionName, phone: '5511999999999', message: 'hi' }))
                .rejects.toThrow(InternalServerErrorException);
        });
    });
});