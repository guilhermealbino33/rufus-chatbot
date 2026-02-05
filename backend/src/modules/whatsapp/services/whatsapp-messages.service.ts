import {
    Injectable,
    Logger,
    NotFoundException,
    InternalServerErrorException,
    HttpException,
    BadRequestException,
} from '@nestjs/common';
import * as wppconnect from '@wppconnect-team/wppconnect';
import { SendMessageDTO } from '../dto';


@Injectable()
export class WhatsappMessagesService {
    private readonly logger = new Logger(WhatsappMessagesService.name);
    /**
     * @todo
     * 
     * - verificar melhor forma de trabalhar com Logger
     */
    private clients: Map<string, wppconnect.Whatsapp> = new Map();

    constructor(

    ) { }


    async send(
        { sessionName, phone, message }: SendMessageDTO
    ): Promise<any> /*
    @todo
    - tipar retorno
    */{
        const client = this.clients.get(sessionName);

        if (!client) {
            throw new NotFoundException({
                success: false,
                message: `Session ${sessionName} not found or not connected`,
            });
        }

        try {
            const formattedPhone = phone.replace(/\D/g, '');
            // Basic format check
            if (formattedPhone.length < 10) {
                throw new BadRequestException('Invalid phone number format');
            }

            const chatId = `${formattedPhone}@c.us`;

            // Validate number with WPPConnect
            const resultCheck = await client.checkNumberStatus(chatId);

            if (!resultCheck.numberExists) {
                throw new BadRequestException(`Number ${phone} is not registered on WhatsApp`);
            }

            // Use the valid serialized ID from the check result
            const result = await client.sendText(resultCheck.id._serialized, message);

            return {
                success: true,
                message: 'Message sent successfully',
                data: result,
            };
        } catch (error) {
            this.logger.error(`Error sending message in ${sessionName}:`, error);

            if (error instanceof HttpException) {
                throw error;
            }

            throw new InternalServerErrorException({
                success: false,
                message: 'Failed to send message',
                error: error.message,
            });
        }
    }

}
