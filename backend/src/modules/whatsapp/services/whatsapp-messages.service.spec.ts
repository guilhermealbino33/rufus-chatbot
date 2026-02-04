import { WhatsappMessagesService } from "./whatsapp-messages.service";
import { InternalServerErrorException, NotFoundException, BadRequestException } from "@nestjs/common";

interface MakeSutTypes {
    sut: WhatsappMessagesService;
}

const makeSut = (): MakeSutTypes => {

    const sut = new WhatsappMessagesService();

    return {
        sut
    };
}

describe('WhatsappMessagesService', () => {
  
    describe('send', () => {
        it('should throw NotFoundException if session not connected', async () => {
            const { sut } = makeSut()

            await expect(sut.send({sessionName: 'no-session', phone: '123', message: 'hello'}))
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

            const result = await sut.send({sessionName, phone: '5511999998888', message: 'hello'});

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

            await expect(sut.send({sessionName, phone: '123', message: 'short'}))
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

            await expect(sut.send({sessionName, phone: '5511999998888', message: 'hello'}))
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

            await expect(sut.send(sessionName, '5511999999999', 'hi'))
                .rejects.toThrow(InternalServerErrorException);
        });
    });
});