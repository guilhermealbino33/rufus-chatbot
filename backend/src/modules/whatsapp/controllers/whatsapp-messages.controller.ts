import {
    Controller,
    Post,
    Body,
} from '@nestjs/common';
import { WhatsappMessagesService } from '../services';
import { SendMessageDTO } from '../dto/send-message.dto';

@Controller('whatsapp/messages')
export class WhatsappMessagesController {
    constructor(private readonly service: WhatsappMessagesService) { }

    @Post('send')
    async sendMessage(@Body() sendMessageDTO: SendMessageDTO) {
        return this.service.send(sendMessageDTO);
    }
}
