import {
  Injectable,
  Logger,
  NotFoundException,
  RequestTimeoutException,
  InternalServerErrorException,
  HttpException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WhatsappSession } from '../entities/whatsapp-session.entity';
import { SessionStatus } from '../enums/whatsapp.enum';
import { SearchSessionsDTO, CreateSessionDTO } from '../dto';
import { WhatsappClientManager } from '../providers';
import { WebhookService } from '../../../shared/services/webhook.service';
import { IncomingWhatsappMessage } from '../../../shared/interfaces/messaging.interface';
import { WhatsappClientConfig } from '../config/whatsapp-client.config';
import {
  ApiResponse,
  SessionStatusResponse,
  QRCodeResponse,
  PaginationResponse,
  WhatsappSessionStartResponse,
} from '../interfaces/whatsapp-common.interface';
import * as wppconnect from '@wppconnect-team/wppconnect';

@Injectable()
export class WhatsappSessionsService {
  private readonly logger = new Logger(WhatsappSessionsService.name);

  constructor(
    @InjectRepository(WhatsappSession)
    private sessionRepository: Repository<WhatsappSession>,
    private clientManager: WhatsappClientManager,
    private webhookService: WebhookService,
  ) {}

  async start(createSessionDto: CreateSessionDTO): Promise<WhatsappSessionStartResponse> {
    const { sessionName, pairingMode, phoneNumber } = createSessionDto;

    this.logger.log(`Starting session: ${sessionName} (Mode: ${pairingMode || 'qrcode'})`);

    // 1. Check if session exists and is already connected in memory
    if (this.clientManager.hasClient(sessionName)) {
      const isConnected = await this.clientManager.isClientConnected(sessionName);
      if (isConnected) {
        return { status: SessionStatus.CONNECTED };
      }
    }

    // 2. Create or Update DB record
    let session = await this.sessionRepository.findOne({ where: { sessionName } });

    if (!session) {
      session = this.sessionRepository.create({
        sessionName,
        status: SessionStatus.CONNECTING,
        phoneNumber: pairingMode === 'phone' ? phoneNumber : undefined,
      });

      await this.sessionRepository.save(session);
    } else {
      await this.sessionRepository.update(
        { sessionName },
        {
          status: SessionStatus.CONNECTING,
          phoneNumber: pairingMode === 'phone' ? phoneNumber : session.phoneNumber,
        },
      );
    }

    // 3. Initialize WPPConnect
    return this.initializeClient(sessionName, pairingMode, phoneNumber);
  }

  async checkStatus(sessionName: string): Promise<string> {
    if (this.clientManager.hasClient(sessionName)) {
      try {
        const isConnected = await this.clientManager.isClientConnected(sessionName);
        if (isConnected) return SessionStatus.CONNECTED;

        const state = await this.clientManager.getConnectionState(sessionName);

        if (state === 'CONNECTED') return SessionStatus.CONNECTED;

        return SessionStatus.DISCONNECTED;
      } catch (error) {
        return SessionStatus.DISCONNECTED;
      }
    }

    const session = await this.sessionRepository.findOne({ where: { sessionName } });
    if (!session) return SessionStatus.DISCONNECTED;

    if (session.status === 'connected' || session.status === SessionStatus.CONNECTED) {
      this.logger.log(
        `Session ${sessionName} found in DB as connected but missing from memory. Attempting recovery...`,
      );

      this.recoverSession(sessionName);

      return SessionStatus.DISCONNECTED;
    }

    return session.status;
  }

  async get(sessionName: string): Promise<ApiResponse<WhatsappSession>> {
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

  async getAll(): Promise<ApiResponse<WhatsappSession[]>> {
    try {
      const sessions = await this.sessionRepository.find();

      // Enrich with real status
      const sessionsWithRealStatus = await Promise.all(
        sessions.map(async (session) => {
          const realStatus = await this.checkStatus(session.sessionName);
          return {
            ...session,
            status: realStatus, // Override DB status with real status
          } as WhatsappSession;
        }),
      );

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

  async search({
    page = 1,
    limit = 10,
  }: SearchSessionsDTO): Promise<PaginationResponse<WhatsappSession>> {
    const [data, total] = await this.sessionRepository.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
    });

    const pages = Math.ceil(total / limit);

    return { data, pages, total };
  }

  async delete(sessionName: string): Promise<ApiResponse> {
    const session = await this.sessionRepository.findOne({ where: { sessionName } });

    if (!session) {
      throw new NotFoundException({
        success: false,
        message: 'Session not found',
      });
    }

    try {
      // Delegate client cleanup to Manager
      await this.clientManager.removeClient(sessionName);

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

  async getStatus(sessionName: string): Promise<ApiResponse<SessionStatusResponse>> {
    try {
      // Check session exists first
      const session = await this.sessionRepository.findOne({ where: { sessionName } });
      if (!session) {
        throw new NotFoundException({
          success: false,
          message: 'Session not found in database',
        });
      }

      const realStatus = await this.checkStatus(sessionName);
      const isClientActive = this.clientManager.hasClient(sessionName);

      return {
        success: true,
        data: {
          session: {
            ...session,
            status: realStatus,
          } as WhatsappSession,
          isClientActive,
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

  async getQRCode(sessionName: string): Promise<ApiResponse<QRCodeResponse>> {
    try {
      const result = await this.get(sessionName);
      const session = result.data!;

      // Check real status
      const realStatus = await this.checkStatus(sessionName);

      if (realStatus === SessionStatus.CONNECTED) {
        return {
          success: true,
          data: {
            status: SessionStatus.CONNECTED,
            message: 'Session is already connected',
          },
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

  private initializeClient(
    sessionName: string,
    pairingMode: 'qrcode' | 'phone' = 'qrcode',
    phoneNumber?: string,
  ): Promise<WhatsappSessionStartResponse> {
    return new Promise((resolve, reject) => {
      const timeoutMs = 20000;
      let isResolved = false;

      const timeoutId = setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          reject(new RequestTimeoutException('Timeout generating QR Code (20s limit)'));
        }
      }, timeoutMs);

      const config: WhatsappClientConfig = {
        sessionName,
        onQRCode: (base64Qr) => {
          if (!isResolved && pairingMode === 'qrcode') {
            this.logger.log(`QR Code captured for ${sessionName}`);
            this.handleQRCode(sessionName, base64Qr);
            isResolved = true;
            clearTimeout(timeoutId);
            resolve({ status: SessionStatus.CONNECTING, qrcode: base64Qr });
          }
        },
        onLinkCode: (code) => {
          if (!isResolved && pairingMode === 'phone') {
            this.logger.log(`Link Code captured for ${sessionName}: ${code}`);
            // We can optionally store this in DB if needed, but for now just return it
            isResolved = true;
            clearTimeout(timeoutId);
            resolve({ status: SessionStatus.CONNECTING, code });
          }
        },
        phoneNumber: pairingMode === 'phone' ? phoneNumber : undefined,
        onStatusChange: (status, session) => {
          this.logger.log(`Status change for ${session}: ${status}`);
          this.handleStatusChange(sessionName, status).catch((err) => {
            this.logger.error(`Failed to persist status change for ${sessionName}: ${err.message}`);
          });
        },
      };

      // ✅ Delegate creation to Manager (run async but outside executor as promise)
      this.clientManager
        .createClient(sessionName, config)
        .then(async (client) => {
          // Register message listener
          client.onMessage(async (message) => {
            await this.handleIncomingMessage(sessionName, message);
          });

          if (!isResolved) {
            isResolved = true;
            clearTimeout(timeoutId);
            resolve({ status: SessionStatus.CONNECTED });
          }
        })
        .catch((error) => {
          if (!isResolved) {
            isResolved = true;
            clearTimeout(timeoutId);
            this.logger.error(`Error creating client: ${error.message}`);
            reject(error);
          }
        });
    });
  }

  private async recoverSession(sessionName: string) {
    if (this.clientManager.hasClient(sessionName)) return; // Already recovering or active

    this.logger.log(`Recovering session ${sessionName}...`);
    try {
      const config: WhatsappClientConfig = {
        sessionName,
        onQRCode: (_base64Qr) => {
          // If it asks for QR during recovery, it means it's definitely disconnected
          this.updateSessionStatus(sessionName, SessionStatus.CONNECTING);
        },
        onStatusChange: (status) => this.handleStatusChange(sessionName, status),
      };

      const client = await this.clientManager.createClient(sessionName, config);
      client.onMessage((msg) => this.handleIncomingMessage(sessionName, msg));
      this.logger.log(`Session ${sessionName} recovered successfully.`);
      this.updateSessionStatus(sessionName, SessionStatus.CONNECTED);
    } catch (e) {
      this.logger.error(`Failed to recover session ${sessionName}: ${e.message}`);
      this.updateSessionStatus(sessionName, SessionStatus.DISCONNECTED);
    }
  }

  private async handleQRCode(sessionName: string, qrCode: string): Promise<void> {
    await this.sessionRepository.update(
      { sessionName },
      { qrCode, status: SessionStatus.CONNECTING },
    );
  }

  private async handleStatusChange(sessionName: string, status: string): Promise<void> {
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

    const updateData: Partial<WhatsappSession> = { status: mappedStatus };

    if (mappedStatus === SessionStatus.CONNECTED) {
      updateData.connectedAt = new Date();
      updateData.qrCode = null;

      // Fetch real number on connection
      try {
        const client = this.clientManager.getClient(sessionName);
        if (client) {
          const device = await client.getHostDevice();
          if (device && device.wid && device.wid.user) {
            updateData.phoneNumber = device.wid.user;
            this.logger.log(
              `Session ${sessionName} connected with number: ${updateData.phoneNumber}`,
            );
          }
        }
      } catch (e) {
        this.logger.warn(`Failed to fetch official phoneNumber for ${sessionName}: ${e.message}`);
      }
    } else if (mappedStatus === SessionStatus.DISCONNECTED) {
      updateData.disconnectedAt = new Date();
    }

    await this.sessionRepository.update({ sessionName }, updateData);
  }

  private async updateSessionStatus(sessionName: string, status: string): Promise<void> {
    await this.sessionRepository.update({ sessionName }, { status });
  }

  private async handleIncomingMessage(
    sessionName: string,
    message: wppconnect.Message,
  ): Promise<void> {
    this.logger.debug(`Message received in ${sessionName} from ${message.from}`);

    // Transform WPPConnect message to WhatsApp-specific format
    const incomingMessage: IncomingWhatsappMessage = {
      sessionId: sessionName,
      from: typeof message.from === 'object' ? (message.from as any)._serialized : message.from,
      body: message.body,
      timestamp: new Date(),
      isGroup: message.isGroupMsg || false,
      chatId:
        typeof message.chatId === 'object'
          ? (message.chatId as any)._serialized
          : message.chatId || message.from,
    };

    // Emit event via WebhookService (fire and forget)
    this.webhookService.emitMessageReceived(incomingMessage);
  }
}
