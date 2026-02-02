import {
    Controller,
    Post,
    Get,
    Delete,
    Body,
    Param,
} from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { SendMessageDto } from './dto/send-message.dto';

@Controller('whatsapp')
export class WhatsappController {
    constructor(private readonly whatsappService: WhatsappService) { }

    @Post('sessions')
    async createSession(@Body() createSessionDto: CreateSessionDto) {
        return this.whatsappService.setupSession(createSessionDto.sessionName);
    }

    @Get('sessions')
    async getAllSessions() {
        return this.whatsappService.getAllSessions();
    }

    @Get('sessions/:sessionName')
    async getSession(@Param('sessionName') sessionName: string) {
        return this.whatsappService.getSession(sessionName);
    }

    @Get('sessions/:sessionName/status')
    async getSessionStatus(@Param('sessionName') sessionName: string) {
        return this.whatsappService.getSessionStatus(sessionName);
    }

    @Get('sessions/:sessionName/qrcode')
    async getQRCode(@Param('sessionName') sessionName: string) {
        return this.whatsappService.getQRCode(sessionName);
    }

    @Delete('sessions/:sessionName')
    async deleteSession(@Param('sessionName') sessionName: string) {
        return this.whatsappService.deleteSession(sessionName);
    }

    @Post('messages/send')
    async sendMessage(@Body() sendMessageDto: SendMessageDto) {
        return this.whatsappService.sendMessage(
            sendMessageDto.sessionName,
            sendMessageDto.phone,
            sendMessageDto.message,
        );
    }
}

