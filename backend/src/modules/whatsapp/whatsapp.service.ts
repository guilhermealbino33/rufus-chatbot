import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as wppconnect from '@wppconnect-team/wppconnect';
import { WhatsappSession } from './entities/whatsapp-session.entity';

@Injectable()
export class WhatsappService {
    private readonly logger = new Logger(WhatsappService.name);
    private clients: Map<string, wppconnect.Whatsapp> = new Map();

    constructor(
        @InjectRepository(WhatsappSession)
        private sessionRepository: Repository<WhatsappSession>,
        private eventEmitter: EventEmitter2,
    ) { }

    async createSession(sessionName: string): Promise<WhatsappSession> {
        this.logger.log(`Creating session: ${sessionName}`);

        // Check if session already exists
        let session = await this.sessionRepository.findOne({
            where: { sessionName },
        });

        if (!session) {
            session = this.sessionRepository.create({
                sessionName,
                status: 'connecting',
            });
            await this.sessionRepository.save(session);
        }

        // Initialize WPPConnect client
        await this.initializeClient(sessionName);

        return session;
    }

    async setupSession(sessionName: string) {
        try {
            await this.createSession(sessionName);

            // Wait for QR Code with a 30-second timeout
            try {
                const qrCode = await this.waitForQRCode(sessionName, 30000);
                return {
                    success: true,
                    message: 'Sessão criada e QR Code gerado com sucesso',
                    data: { qrcode: qrCode },
                };
            } catch (qrError) {
                if (qrError.message === 'Timeout waiting for QR Code') {
                    throw new HttpException(
                        {
                            success: false,
                            message: 'Tempo esgotado aguardando a geração do QR Code',
                        },
                        HttpStatus.REQUEST_TIMEOUT,
                    );
                }
                throw qrError;
            }
        } catch (error) {
            if (error instanceof HttpException) {
                throw error;
            }
            throw new HttpException(
                {
                    success: false,
                    message: 'Falha ao criar sessão',
                    error: error.message,
                },
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    private async initializeClient(sessionName: string): Promise<void> {
        try {
            const client = await wppconnect.create({
                session: sessionName,
                catchQR: (base64Qr, asciiQR, attempts, urlCode) => {
                    this.logger.log(`QR Code received for session: ${sessionName}`);
                    this.handleQRCode(sessionName, base64Qr);
                    this.eventEmitter.emit(`qr.${sessionName}`, base64Qr);
                },
                statusFind: (statusSession, session) => {
                    this.logger.log(`Status for ${session}: ${statusSession}`);
                    this.handleStatusChange(sessionName, statusSession);
                },
                headless: true,
                devtools: false,
                useChrome: true,
                debug: false,
                logQR: true,
                browserArgs: [
                    '--disable-web-security',
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                ],
                autoClose: 60000,
                puppeteerOptions: {
                    headless: true,
                    args: ['--no-sandbox', '--disable-setuid-sandbox'],
                },
            });

            this.clients.set(sessionName, client);

            // Setup message listener
            client.onMessage(async (message) => {
                await this.handleIncomingMessage(sessionName, message);
            });

            this.logger.log(`Client initialized for session: ${sessionName}`);
        } catch (error) {
            this.logger.error(`Error initializing client for ${sessionName}:`, error);
            await this.updateSessionStatus(sessionName, 'disconnected');
            throw error;
        }
    }

    private async handleQRCode(sessionName: string, qrCode: string): Promise<void> {
        await this.sessionRepository.update(
            { sessionName },
            { qrCode, status: 'qrcode' },
        );
    }

    private async handleStatusChange(
        sessionName: string,
        status: string,
    ): Promise<void> {
        const statusMap: { [key: string]: string } = {
            inChat: 'connected',
            qrReadSuccess: 'connected',
            isLogged: 'connected',
            notLogged: 'disconnected',
            browserClose: 'disconnected',
            qrReadFail: 'disconnected',
        };

        const mappedStatus = statusMap[status] || status;

        const updateData: any = { status: mappedStatus };

        if (mappedStatus === 'connected') {
            updateData.connectedAt = new Date();
            updateData.qrCode = null;
        } else if (mappedStatus === 'disconnected') {
            updateData.disconnectedAt = new Date();
        }

        await this.sessionRepository.update({ sessionName }, updateData);
    }

    private async updateSessionStatus(
        sessionName: string,
        status: string,
    ): Promise<void> {
        await this.sessionRepository.update({ sessionName }, { status });
    }

    private async handleIncomingMessage(
        sessionName: string,
        message: any,
    ): Promise<void> {
        this.logger.log(
            `Message received in session ${sessionName}: ${JSON.stringify(message)}`,
        );
        // Here you can integrate with your chatbot logic
        // For now, just logging the message
    }

    async sendMessage(
        sessionName: string,
        phone: string,
        message: string,
    ): Promise<any> {
        const client = this.clients.get(sessionName);

        if (!client) {
            throw new HttpException(
                {
                    success: false,
                    message: `Session ${sessionName} not found or not connected`,
                },
                HttpStatus.NOT_FOUND,
            );
        }

        try {
            // Format phone number (remove special characters and add country code if needed)
            const formattedPhone = phone.replace(/\D/g, '');
            const chatId = `${formattedPhone}@c.us`;

            const result = await client.sendText(chatId, message);
            this.logger.log(`Message sent to ${phone} in session ${sessionName}`);
            return {
                success: true,
                message: 'Message sent successfully',
                data: result,
            };
        } catch (error) {
            this.logger.error(`Error sending message in ${sessionName}:`, error);
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

    async getSession(sessionName: string): Promise<any> {
        const session = await this.sessionRepository.findOne({ where: { sessionName } });
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
    }

    async getAllSessions(): Promise<any> {
        try {
            const sessions = await this.sessionRepository.find();
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

    async deleteSession(sessionName: string): Promise<any> {
        try {
            const client = this.clients.get(sessionName);

            if (client) {
                try {
                    await client.close();
                } catch (error) {
                    this.logger.error(`Error closing client for ${sessionName}:`, error);
                }
                this.clients.delete(sessionName);
            }

            await this.sessionRepository.delete({ sessionName });
            this.logger.log(`Session ${sessionName} deleted`);
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

    async getSessionStatus(sessionName: string): Promise<any> {
        try {
            const result = await this.getSession(sessionName);
            const session = result.data;
            const client = this.clients.get(sessionName);

            return {
                success: true,
                data: {
                    session,
                    isClientActive: !!client,
                    connectionState: client ? await client.getConnectionState() : null,
                },
            };
        } catch (error) {
            if (error instanceof HttpException) {
                throw error;
            }
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

    async getQRCode(sessionName: string): Promise<any> {
        try {
            const result = await this.getSession(sessionName);
            const session = result.data;

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
            if (error instanceof HttpException) {
                throw error;
            }
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

    async waitForQRCode(sessionName: string, timeoutMs: number): Promise<string> {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.eventEmitter.removeAllListeners(`qr.${sessionName}`);
                reject(new Error('Timeout waiting for QR Code'));
            }, timeoutMs);

            this.eventEmitter.once(`qr.${sessionName}`, (qrCode: string) => {
                clearTimeout(timeout);
                resolve(qrCode);
            });
        });
    }
}

