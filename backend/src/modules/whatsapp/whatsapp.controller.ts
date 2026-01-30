import {
    Controller,
    Post,
    Get,
    Delete,
    Body,
    Param,
    HttpException,
    HttpStatus,
} from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { SendMessageDto } from './dto/send-message.dto';

@Controller('whatsapp')
export class WhatsappController {
    constructor(private readonly whatsappService: WhatsappService) { }

    @Post('sessions')
    async createSession(@Body() createSessionDto: CreateSessionDto) {
        try {
            const session = await this.whatsappService.createSession(
                createSessionDto.sessionName,
            );
            return {
                success: true,
                message: 'Session created successfully',
                data: session,
            };
        } catch (error) {
            throw new HttpException(
                {
                    success: false,
                    message: 'Failed to create session',
                    error: error.message,
                },
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    @Get('sessions')
    async getAllSessions() {
        try {
            const sessions = await this.whatsappService.getAllSessions();
            return {
                success: true,
                data: sessions,
            };
        } catch (error) {
            throw new HttpException(
                {
                    success: false,
                    message: 'Failed to get sessions',
                    error: error.message,
                },
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    @Get('sessions/:sessionName')
    async getSession(@Param('sessionName') sessionName: string) {
        try {
            const session = await this.whatsappService.getSession(sessionName);
            if (!session) {
                throw new HttpException(
                    {
                        success: false,
                        message: 'Session not found',
                    },
                    HttpStatus.NOT_FOUND,
                );
            }
            return {
                success: true,
                data: session,
            };
        } catch (error) {
            throw new HttpException(
                {
                    success: false,
                    message: 'Failed to get session',
                    error: error.message,
                },
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    @Get('sessions/:sessionName/status')
    async getSessionStatus(@Param('sessionName') sessionName: string) {
        try {
            const status = await this.whatsappService.getSessionStatus(sessionName);
            return {
                success: true,
                data: status,
            };
        } catch (error) {
            throw new HttpException(
                {
                    success: false,
                    message: 'Failed to get session status',
                    error: error.message,
                },
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    @Get('sessions/:sessionName/qrcode')
    async getQRCode(@Param('sessionName') sessionName: string) {
        try {
            const session = await this.whatsappService.getSession(sessionName);
            if (!session) {
                throw new HttpException(
                    {
                        success: false,
                        message: 'Session not found',
                    },
                    HttpStatus.NOT_FOUND,
                );
            }

            if (!session.qrCode) {
                return {
                    success: false,
                    message: 'QR Code not available. Session may already be connected or not initialized.',
                };
            }

            return {
                success: true,
                data: {
                    qrCode: session.qrCode,
                    status: session.status,
                },
            };
        } catch (error) {
            throw new HttpException(
                {
                    success: false,
                    message: 'Failed to get QR Code',
                    error: error.message,
                },
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    @Delete('sessions/:sessionName')
    async deleteSession(@Param('sessionName') sessionName: string) {
        try {
            await this.whatsappService.deleteSession(sessionName);
            return {
                success: true,
                message: 'Session deleted successfully',
            };
        } catch (error) {
            throw new HttpException(
                {
                    success: false,
                    message: 'Failed to delete session',
                    error: error.message,
                },
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    @Post('messages/send')
    async sendMessage(@Body() sendMessageDto: SendMessageDto) {
        try {
            const result = await this.whatsappService.sendMessage(
                sendMessageDto.sessionName,
                sendMessageDto.phone,
                sendMessageDto.message,
            );
            return {
                success: true,
                message: 'Message sent successfully',
                data: result,
            };
        } catch (error) {
            throw new HttpException(
                {
                    success: false,
                    message: 'Failed to send message',
                    error: error.message,
                },
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }
}
