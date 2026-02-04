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
import { SessionStatus } from './enums/whatsapp.enum';


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

        // 1. Check if session exists and is already connected in memory
        if (this.clients.has(sessionName)) {
            const client = this.clients.get(sessionName);
            const isConnected = await client.isConnected();
            if (isConnected) {
                return { status: 'CONNECTED' };
            }
        }

        // 2. Create or Update DB record
        let session = await this.sessionRepository.findOne({ where: { sessionName } });
        if (!session) {
            session = this.sessionRepository.create({
                sessionName,
                status: SessionStatus.CONNECTING,
            });
            await this.sessionRepository.save(session);
        } else {
            await this.sessionRepository.update({ sessionName }, { status: SessionStatus.CONNECTING });
        }

        // 3. Initialize WPPConnect
        return this.initializeClient(sessionName);
    }

    private async initializeClient(sessionName: string): Promise<{ status: 'QRCODE' | 'CONNECTED'; qrcode?: string }> {
        return new Promise(async (resolve, reject) => {
            const timeoutMs = 20000;
            let isResolved = false;

            const timeoutId = setTimeout(() => {
                if (!isResolved) {
                    isResolved = true;
                    reject(new RequestTimeoutException('Timeout generating QR Code (20s limit)'));
                }
            }, timeoutMs);

            try {
                await wppconnect.create({
                    session: sessionName,
                    catchQR: (base64Qr, asciiQR) => {
                        if (!isResolved) {
                            this.logger.log(`QR Code captured for ${sessionName}`);
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
                    },
                    headless: true,
                    devtools: false,
                    useChrome: true,
                    debug: false,
                    logQR: false,
                    browserArgs: [
                        '--disable-web-security',
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                    ],
                    autoClose: 0,
                })
                    .then((client) => {
                        this.clients.set(sessionName, client);

                        client.onMessage(async (message) => {
                            await this.handleIncomingMessage(sessionName, message);
                        });

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

    // New wrapper to check real status
    async checkSessionStatus(sessionName: string): Promise<string> {
        const client = this.clients.get(sessionName);

        // 1. If we have client in memory, ask it directly
        if (client) {
            try {
                const isConnected = await client.isConnected();
                if (isConnected) return SessionStatus.CONNECTED;

                // If not connected but client exists, check detailed state
                const state = await client.getConnectionState();
                if (state === 'CONNECTED') return SessionStatus.CONNECTED;
                return SessionStatus.DISCONNECTED;
            } catch (error) {
                // Client might be dead
                this.clients.delete(sessionName);
                return SessionStatus.DISCONNECTED;
            }
        }

        // 2. If valid in DB but missing in memory -> Try Recovery
        const session = await this.sessionRepository.findOne({ where: { sessionName } });
        if (!session) return SessionStatus.DISCONNECTED; // Unknown session

        // If DB says connected but we don't have it, we must recover
        if (session.status === 'connected' || session.status === SessionStatus.CONNECTED) {
            this.logger.log(`Session ${sessionName} found in DB as connected but missing from memory. Attempting recovery...`);
            this.recoverSession(sessionName); // Fire and forget
            return SessionStatus.DISCONNECTED; // Or 'RECOVERING' if we add that enum
        }

        return session.status;
    }

    private async recoverSession(sessionName: string) {
        if (this.clients.has(sessionName)) return; // Already recovering or active

        this.logger.log(`Recovering session ${sessionName}...`);
        try {
            await wppconnect.create({
                session: sessionName,
                catchQR: (base64Qr, asciiQR) => {
                    // If it asks for QR during recovery, it means it's definitely disconnected
                    this.updateSessionStatus(sessionName, SessionStatus.QRCODE);
                },
                statusFind: (status) => this.handleStatusChange(sessionName, status),
                headless: true,
                devtools: false,
                useChrome: true,
                debug: false,
                logQR: false,
                browserArgs: [
                    '--disable-web-security',
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                ],
                autoClose: 0,
            }).then(client => {
                this.clients.set(sessionName, client);
                client.onMessage(msg => this.handleIncomingMessage(sessionName, msg));
                this.logger.log(`Session ${sessionName} recovered successfully.`);
                this.updateSessionStatus(sessionName, SessionStatus.CONNECTED);
            });
        } catch (e) {
            this.logger.error(`Failed to recover session ${sessionName}: ${e.message}`);
            this.updateSessionStatus(sessionName, SessionStatus.DISCONNECTED);
        }
    }

    private async handleQRCode(sessionName: string, qrCode: string): Promise<void> {
        await this.sessionRepository.update(
            { sessionName },
            { qrCode, status: SessionStatus.QRCODE },
        );
    }

    private async handleStatusChange(
        sessionName: string,
        status: string,
    ): Promise<void> {
        const statusMap: { [key: string]: string } = {
            inChat: SessionStatus.CONNECTED,
            qrReadSuccess: SessionStatus.CONNECTED,
            isLogged: SessionStatus.CONNECTED,
            notLogged: SessionStatus.DISCONNECTED,
            browserClose: SessionStatus.DISCONNECTED,
            qrReadFail: SessionStatus.DISCONNECTED,
            autocloseCalled: SessionStatus.DISCONNECTED,
            desconnectedMobile: SessionStatus.DISCONNECTED,
        };

        const mappedStatus = statusMap[status] || status;

        const updateData: any = { status: mappedStatus };

        if (mappedStatus === SessionStatus.CONNECTED) {
            updateData.connectedAt = new Date();
            updateData.qrCode = null;
        } else if (mappedStatus === SessionStatus.DISCONNECTED) {
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

            // Enrich with real status
            const sessionsWithRealStatus = await Promise.all(sessions.map(async (session) => {
                const realStatus = await this.checkSessionStatus(session.sessionName);
                return {
                    ...session,
                    status: realStatus // Override DB status with real status
                };
            }));

            return {
                success: true,
                data: sessionsWithRealStatus,
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
            // Check session exists first
            const session = await this.sessionRepository.findOne({ where: { sessionName } });
            if (!session) {
                throw new NotFoundException({
                    success: false,
                    message: 'Session not found in database',
                });
            }

            const realStatus = await this.checkSessionStatus(sessionName);
            const client = this.clients.get(sessionName);

            return {
                success: true,
                data: {
                    session: {
                        ...session,
                        status: realStatus
                    },
                    isClientActive: !!client,
                    connectionState: realStatus,
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

            // Check real status
            const realStatus = await this.checkSessionStatus(sessionName);

            if (realStatus === SessionStatus.CONNECTED) {
                return {
                    success: true,
                    data: {
                        status: SessionStatus.CONNECTED,
                        message: 'Session is already connected'
                    }
                };
            }

            if (!session.qrCode) {
                return {
                    success: false,
                    message: 'QR Code not available. Please start a session first.',
                };
            }

            return {
                success: true,
                data: {
                    qrCode: session.qrCode,
                    status: realStatus,
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
