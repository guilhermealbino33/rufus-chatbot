import {
    Injectable,
    Logger,
    NotFoundException,
    RequestTimeoutException,
    InternalServerErrorException,
    HttpException,
} from '@nestjs/common';
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

    async startSession(sessionName: string): Promise<{ status: 'QRCODE' | 'CONNECTED'; qrcode?: string }> {
        this.logger.log(`Starting session: ${sessionName}`);

        // 1. Check if session exists and is already connected
        const existingSession = await this.sessionRepository.findOne({ where: { sessionName } });
        if (existingSession && existingSession.status === 'connected') {
            // Check if client is actually active in memory
            if (this.clients.has(sessionName)) {
                return { status: 'CONNECTED' };
            }
        }

        // 2. Create or Update DB record
        if (!existingSession) {
            const newSession = this.sessionRepository.create({
                sessionName,
                status: 'connecting',
            });
            await this.sessionRepository.save(newSession);
        } else {
            await this.sessionRepository.update({ sessionName }, { status: 'connecting' });
        }

        // 3. Initialize WPPConnect with Promise race (QR vs Connected vs Timeout)
        return new Promise(async (resolve, reject) => {
            const timeoutMs = 20000; // 20s timeout
            let isResolved = false;

            const timeoutId = setTimeout(() => {
                if (!isResolved) {
                    isResolved = true;
                    // Note: We might want to close the client init here to avoid memory leaks, 
                    // but wppconnect doesn't allow easy cancellation of create().
                    // For now, we reject the request.
                    reject(new RequestTimeoutException('Timeout generating QR Code (20s limit)'));
                }
            }, timeoutMs);

            try {
                await wppconnect.create({
                    session: sessionName,
                    catchQR: (base64Qr, asciiQR) => {
                        if (!isResolved) {
                            this.logger.log(`QR Code captured for ${sessionName}`);

                            // Save QR to DB for persistence/debugging
                            this.handleQRCode(sessionName, base64Qr);

                            isResolved = true;
                            clearTimeout(timeoutId);
                            resolve({
                                status: 'QRCODE',
                                qrcode: base64Qr
                            });
                        }
                    },
                    statusFind: (statusSession, session) => {
                        this.logger.log(`Status change for ${session}: ${statusSession}`);
                        this.handleStatusChange(sessionName, statusSession);

                        if (statusSession === 'inChat' || statusSession === 'isLogged') {
                            if (!isResolved) {
                                isResolved = true;
                                clearTimeout(timeoutId);
                                resolve({ status: 'CONNECTED' });
                            }
                        }
                    },
                    headless: true,
                    devtools: false,
                    useChrome: true,
                    debug: false,
                    logQR: false, // Controlled manually
                    browserArgs: [
                        '--disable-web-security',
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                    ],
                    autoClose: 0, // Disable auto close to control it manually
                })
                    .then((client) => {
                        this.clients.set(sessionName, client);

                        client.onMessage(async (message) => {
                            await this.handleIncomingMessage(sessionName, message);
                        });

                        // If create() finishes without QR (e.g. was already logged in fast), ensure connected
                        if (!isResolved) {
                            isResolved = true;
                            clearTimeout(timeoutId);
                            resolve({ status: 'CONNECTED' });
                        }
                    });
            } catch (error) {
                if (!isResolved) {
                    isResolved = true;
                    clearTimeout(timeoutId);
                    this.logger.error(`Error creating client: ${error.message}`);
                    reject(new InternalServerErrorException(`Failed to initialize WPPConnect: ${error.message}`));
                }
            }
        });
    }

    // Keep legacy createSession for internal use if needed, or remove if unused. 
    // For now, I'll remove the public createSession/setupSession and use startSession.

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
        // Here you can integrate with your chatbot logic
        this.logger.debug(`Message received in ${sessionName}`);
    }

    async sendMessage(
        sessionName: string,
        phone: string,
        message: string,
    ): Promise<any> {
        const client = this.clients.get(sessionName);

        if (!client) {
            throw new NotFoundException({
                success: false,
                message: `Session ${sessionName} not found or not connected`,
            });
        }

        try {
            const formattedPhone = phone.replace(/\D/g, '');
            const chatId = `${formattedPhone}@c.us`;

            const result = await client.sendText(chatId, message);
            return {
                success: true,
                message: 'Message sent successfully',
                data: result,
            };
        } catch (error) {
            this.logger.error(`Error sending message in ${sessionName}:`, error);
            throw new InternalServerErrorException({
                success: false,
                message: 'Failed to send message',
                error: error.message,
            });
        }
    }

    async getSession(sessionName: string): Promise<any> {
        const session = await this.sessionRepository.findOne({ where: { sessionName } });
        if (!session) {
            throw new NotFoundException({
                success: false,
                message: 'Session not found',
            });
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
            throw new InternalServerErrorException({
                success: false,
                message: 'Failed to get sessions',
                error: error.message,
            });
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
            throw new InternalServerErrorException({
                success: false,
                message: 'Failed to delete session',
                error: error.message,
            });
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
            throw new InternalServerErrorException({
                success: false,
                message: 'Failed to get session status',
                error: error.message,
            });
        }
    }

    async getQRCode(sessionName: string): Promise<any> {
        try {
            const result = await this.getSession(sessionName);
            const session = result.data;

            if (!session.qrCode) {
                return {
                    success: false,
                    message: 'QR Code not available.',
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
            throw new InternalServerErrorException({
                success: false,
                message: 'Failed to get QR Code',
                error: error.message,
            });
        }
    }
}



