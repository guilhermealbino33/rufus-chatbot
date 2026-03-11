import { LogSeverity, LoggerPayload, ILogger } from '../../../shared/interfaces/logger.interface';
import { AppLoggerService } from '@/shared/services/logger.service';
import {
  Injectable,
  NotFoundException,
  RequestTimeoutException,
  InternalServerErrorException,
  HttpException,
  ConflictException,
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
import { Message as WPPConnectMessage } from '@wppconnect-team/wppconnect';
import { isLidJid } from '../utils/jid.utils';

@Injectable()
export class WhatsappSessionsService {
  private readonly logger: ILogger;

  constructor(
    @InjectRepository(WhatsappSession)
    private sessionRepository: Repository<WhatsappSession>,
    private clientManager: WhatsappClientManager,
    private webhookService: WebhookService,
    private readonly loggerService: AppLoggerService,
  ) {
    this.logger = loggerService.forContext(WhatsappSessionsService.name);
  }

  async start({
    sessionName,
    pairingMode,
    phoneNumber,
  }: CreateSessionDTO): Promise<WhatsappSessionStartResponse> {
    const maskedPhone = phoneNumber
      ? `${phoneNumber.slice(0, 4)}****${phoneNumber.slice(-2)}`
      : 'N/A';

    this.logger.log({
      severity: LogSeverity.LOG,
      message: `Entrou método start | session=${sessionName} | mode=${pairingMode ?? 'qrcode'} | phone=${maskedPhone}`,
    });
    // ========== ETAPA 1: Verificação de Singleton ==========
    // Previne múltiplas inicializações simultâneas
    if (this.clientManager.isClientInitializing(sessionName)) {
      throw new ConflictException({
        success: false,
        message: `Sessão ${sessionName} já está em processo de inicialização`,
        error: 'SESSION_ALREADY_INITIALIZING',
      });
    }

    // ========== ETAPA 2: Verificação de Instância em Memória ==========
    if (this.clientManager.hasClient(sessionName)) {
      const isConnected = await this.clientManager.isClientConnected(sessionName);
      if (isConnected) {
        this.logger.log({
          severity: LogSeverity.LOG,
          message: `Session ${sessionName} already connected in memory`,
        });
        return { status: SessionStatus.CONNECTED };
      }

      // Cliente existe mas não está conectado - fazer cleanup
      this.logger.warn({
        severity: LogSeverity.WARNING,
        message: `Sessão ${sessionName} exists in memory but not connected. Cleaning up...`,
      });
      await this.clientManager.forceCloseClient(sessionName);
    }

    // ========== ETAPA 3: Verificação de Estado no Banco ==========
    let session = await this.sessionRepository.findOne({ where: { sessionName } });

    // Se sessão existe e está em estado não-final, fazer cleanup
    if (session) {
      if (session.status === SessionStatus.CONNECTING) {
        // Sessão travada em CONNECTING - provavelmente de uma tentativa anterior que falhou
        this.logger.warn({
          severity: LogSeverity.WARNING,
          message: `Sessão ${sessionName} travada em CONNECTING. Tentando limpar...`,
        });
        await this.cleanupStuckSession(sessionName);
        session = null; // Reset para criar nova
      } else if (session.status !== SessionStatus.CONNECTED) {
        this.logger.log({
          severity: LogSeverity.LOG,
          message: `Sessão ${sessionName} existe com status ${session.status}. Deletando...`,
        });
        await this.delete(sessionName);
        session = null; // Reset para criar nova
      }
    }

    // ========== ETAPA 4: Criar/Atualizar Registro no Banco ==========
    if (!session) {
      session = this.sessionRepository.create({
        sessionName,
        status: SessionStatus.CONNECTING,
        phoneNumber: pairingMode === 'phone' ? phoneNumber : undefined,
      });
      await this.sessionRepository.save(session);
      this.logger.log({
        severity: LogSeverity.LOG,
        message: `Sessão ${sessionName} criada com status CONNECTING`,
      });
    } else {
      await this.sessionRepository.update(
        { sessionName },
        {
          status: SessionStatus.CONNECTING,
          phoneNumber: pairingMode === 'phone' ? phoneNumber : session.phoneNumber,
        },
      );
      this.logger.log({
        severity: LogSeverity.LOG,
        message: `Sessão ${sessionName} atualizada para CONNECTING`,
      });
    }

    // ========== ETAPA 5: Inicializar Cliente WPPConnect ==========
    try {
      this.logger.log({
        severity: LogSeverity.LOG,
        message: `Iniciando sessão: ${sessionName} (Modo: ${pairingMode || 'qrcode'})`,
      });
      return await this.initializeClient(sessionName, pairingMode, phoneNumber);
    } catch (error) {
      // Rollback do estado em caso de erro
      await this.handleInitializationError(sessionName, error);
      throw error; // Re-lança para o controller tratar
    }
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
      this.logger.log({
        severity: LogSeverity.LOG,
        message: `Sessão ${sessionName} encontrada no banco como conectada mas ausente da memória. Tentando recuperação...`,
      });

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
        message: 'Sessão não encontrada',
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
        message: 'Falha ao buscar sessões',
        error: error.message,
      });
    }
  }

  async search({
    page = 1,
    limit = 10,
  }: SearchSessionsDTO): Promise<PaginationResponse<WhatsappSession>> {
    const countAll = await this.sessionRepository.count();
    this.logger.log({
      severity: LogSeverity.LOG,
      message: `Buscando sessões - Página: ${page}, Limite: ${limit} (Total no banco: ${countAll})`,
    });

    const [data, total] = await this.sessionRepository.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' } as any,
    });

    const pages = Math.ceil(total / limit);

    return { data, pages, total };
  }

  async delete(sessionName: string): Promise<ApiResponse> {
    const session = await this.sessionRepository.findOne({ where: { sessionName } });

    if (!session) {
      throw new NotFoundException({
        success: false,
        message: 'Sessão não encontrada',
      });
    }

    try {
      // Delegate client cleanup to Manager
      await this.clientManager.removeClient(sessionName);

      await this.sessionRepository.delete({ sessionName });
      this.logger.log({ severity: LogSeverity.LOG, message: `Sessão ${sessionName} deletada` });
      return {
        success: true,
        message: 'Sessão deletada com sucesso',
      };
    } catch (error) {
      throw new InternalServerErrorException({
        success: false,
        message: 'Falha ao deletar sessão',
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
          message: 'Sessão não encontrada no banco de dados',
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
        message: 'Falha ao obter status da sessão',
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
            message: 'Sessão já está conectada',
          },
        };
      }

      if (!session.qrCode) {
        return {
          success: false,
          message: 'QR Code não disponível. Por favor, inicie uma sessão primeiro.',
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
        message: 'Falha ao obter QR Code',
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
      const timeoutMs = 120000; // Aumentado para 120s para servidores de produção lentos
      let isResolved = false;

      this.logger.log({
        severity: LogSeverity.LOG,
        message: `Iniciando promise initializeClient para: ${sessionName} (Timeout: ${timeoutMs / 1000}s)`,
      });

      const timeoutId = setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          this.logger.error({
            severity: LogSeverity.ERROR,
            message: `[WARNING] Timeout gerando QR/Link Code para ${sessionName} após ${timeoutMs / 1000}s`,
          });
          reject(
            new RequestTimeoutException(`Timeout gerando QR Code para ${sessionName} (120s limit)`),
          );
        }
      }, timeoutMs);

      // [DIAG] Validação de pré-condições antes de criar o cliente
      this.logger.log({
        severity: LogSeverity.LOG,
        message: `[DIAG] initializeClient: pairingMode=${pairingMode} | hasPhoneNumber=${!!phoneNumber}`,
      });
      if (pairingMode === 'phone' && !phoneNumber) {
        this.logger.warn({
          severity: LogSeverity.WARNING,
          message: `[DIAG] pairingMode=phone mas nenhum phoneNumber fornecido para session=${sessionName}. catchLinkCode nunca será acionado!`,
        });
      }

      const config: WhatsappClientConfig = {
        sessionName,
        onQRCode: (base64Qr) => {
          this.logger.log({
            severity: LogSeverity.LOG,
            message: `[DIAG] onQRCode fired | session=${sessionName} | pairingMode=${pairingMode} | isResolved=${isResolved}`,
          });
          if (!isResolved && pairingMode === 'qrcode') {
            this.logger.log({
              severity: LogSeverity.LOG,
              message: `QR Code capturado para ${sessionName}`,
            });
            this.handleQRCode(sessionName, base64Qr);
            isResolved = true;
            clearTimeout(timeoutId);
            resolve({ status: SessionStatus.CONNECTING, qrcode: base64Qr });
          }
        },
        onLinkCode: (code) => {
          this.logger.log({
            severity: LogSeverity.LOG,
            message: `[DIAG] onLinkCode fired | session=${sessionName} | pairingMode=${pairingMode} | isResolved=${isResolved}`,
          });
          if (!isResolved && pairingMode === 'phone') {
            this.logger.log({
              severity: LogSeverity.LOG,
              message: `Código de link capturado para ${sessionName}: ${code}`,
            });
            isResolved = true;
            clearTimeout(timeoutId);
            resolve({ status: SessionStatus.CONNECTING, code });
          }
        },
        phoneNumber: pairingMode === 'phone' ? phoneNumber : undefined,
        onStatusChange: (status, session) => {
          this.logger.log({
            severity: LogSeverity.LOG,
            message: `[STATUS] [onStatusChange] sessão=${session} status=${status}`,
          });
          this.handleStatusChange(sessionName, status).catch((err) => {
            this.logger.error({
              severity: LogSeverity.ERROR,
              message: `[WARNING] Falha ao persistir mudança de status para ${sessionName}: ${err.message}`,
            });
          });
        },
      };

      this.logger.log({
        severity: LogSeverity.LOG,
        message: `[DIAG] Triggering clientManager.createClient for: ${sessionName}...`,
      });

      // Delegate creation to Manager
      this.clientManager
        .createClient(sessionName, config)
        .then(async (client) => {
          this.logger.log({
            severity: LogSeverity.LOG,
            message: `[DIAG] clientManager.createClient resolved for: ${sessionName} | isResolved=${isResolved}`,
          });

          // Register message listener
          client.onMessage(async (message) => {
            await this.handleIncomingMessage(sessionName, message);
          });

          if (!isResolved) {
            isResolved = true;
            clearTimeout(timeoutId);
            this.logger.log({
              severity: LogSeverity.LOG,
              message: `Sessão ${sessionName} conectada com sucesso.`,
            });
            resolve({ status: SessionStatus.CONNECTED });
          }
        })
        .catch((error) => {
          if (!isResolved) {
            isResolved = true;
            clearTimeout(timeoutId);
            // [DIAG] Stack trace completo — expõe erros silenciosos do Puppeteer
            this.logger.error({
              severity: LogSeverity.ERROR,
              message: `[DIAG] clientManager.createClient REJEITADO para ${sessionName}: ${error.message}`,
              stack: error.stack,
            });
            reject(error);
          }
        });
    });
  }

  private async recoverSession(sessionName: string) {
    if (this.clientManager.hasClient(sessionName)) return; // Already recovering or active

    this.logger.log({ severity: LogSeverity.LOG, message: `Recuperando sessão ${sessionName}...` });
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
      this.logger.log({
        severity: LogSeverity.LOG,
        message: `Sessão ${sessionName} recuperada com sucesso.`,
      });
      this.updateSessionStatus(sessionName, SessionStatus.CONNECTED);
    } catch (e) {
      this.logger.error({
        severity: LogSeverity.ERROR,
        message: `Falha ao recuperar sessão ${sessionName}: ${e.message}`,
      });
      this.updateSessionStatus(sessionName, SessionStatus.DISCONNECTED);
    }
  }

  /**
   * Tenta limpar uma sessão travada em estado CONNECTING
   *
   * Esta função é chamada quando detectamos que uma sessão está
   * travada no estado CONNECTING de uma tentativa anterior que falhou.
   *
   * @param sessionName - Nome da sessão
   */
  private async cleanupStuckSession(sessionName: string): Promise<void> {
    try {
      // Tenta forçar fechamento se houver cliente em memória
      if (this.clientManager.hasClient(sessionName)) {
        await this.clientManager.forceCloseClient(sessionName);
      }

      // Atualiza estado para DISCONNECTED
      await this.sessionRepository.update({ sessionName }, { status: SessionStatus.DISCONNECTED });

      this.logger.log({
        severity: LogSeverity.LOG,
        message: `Sessão ${sessionName} limpa com sucesso.`,
      });
    } catch (error) {
      this.logger.error({
        severity: LogSeverity.ERROR,
        message: `Falha ao limpar sessão ${sessionName}: ${error.message}`,
      });
      // Não lança erro - apenas loga
    }
  }

  /**
   * Trata erros de inicialização e faz rollback do estado
   *
   * Quando a inicialização do WPPConnect falha, precisamos:
   * 1. Atualizar o estado da sessão no banco para DISCONNECTED
   * 2. Limpar o QR Code armazenado
   * 3. Remover o cliente da memória se existir
   *
   * @param sessionName - Nome da sessão
   * @param error - Erro que causou a falha
   */
  private async handleInitializationError(sessionName: string, error: any): Promise<void> {
    // [DIAG] Stack trace completo — crítico para diagnóstico de erros Puppeteer/WPPConnect
    this.logger.error({
      severity: LogSeverity.ERROR,
      message: `[DIAG] Falha na inicialização da sessão ${sessionName}: ${error.message}`,
      stack: error.stack,
    });

    try {
      // Atualiza estado para DISCONNECTED
      await this.sessionRepository.update(
        { sessionName },
        {
          status: SessionStatus.DISCONNECTED,
          qrCode: null,
        },
      );

      // Remove cliente da memória se existir
      if (this.clientManager.hasClient(sessionName)) {
        await this.clientManager.forceCloseClient(sessionName);
      }
    } catch (rollbackError) {
      this.logger.error({
        severity: LogSeverity.ERROR,
        message: `Falha ao recuperar sessão ${sessionName}: ${rollbackError.message}`,
      });
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
            this.logger.log({
              severity: LogSeverity.LOG,
              message: `Sessão ${sessionName} conectada com o número: ${updateData.phoneNumber}`,
            });
          }
        }
      } catch (e) {
        this.logger.warn({
          severity: LogSeverity.WARNING,
          message: `Falha ao buscar número oficial para ${sessionName}: ${e.message}`,
        });
      }
    } else if (mappedStatus === SessionStatus.DISCONNECTED) {
      updateData.disconnectedAt = new Date();
    }

    await this.sessionRepository.update({ sessionName }, updateData);
  }

  private async updateSessionStatus(sessionName: string, status: string): Promise<void> {
    await this.sessionRepository.update({ sessionName }, { status });
  }

  /**
   * Safely extracts the remote JID (chat ID) from a WhatsApp message.
   * Prefers @c.us / @g.us over @lid for sendability; falls back to @lid if nothing else.
   */
  private getRemoteJid(message: WPPConnectMessage): string | undefined {
    if (!message) return undefined;

    // Helper function to safely get ID from an object that might have _serialized
    const getId = (obj: unknown): string | undefined => {
      if (!obj) return undefined;
      if (typeof obj === 'string') return obj;
      if (typeof obj === 'object' && obj !== null) {
        const withSerialized = obj as { _serialized?: unknown };
        if (withSerialized._serialized && typeof withSerialized._serialized === 'string') {
          return withSerialized._serialized;
        }
      }
      return undefined;
    };

    const fromId = getId(message.from);
    const chatId = getId(message.chatId);

    // Prefer non-@lid JID (sendable @c.us/@g.us) over @lid to avoid "Invalid WID value"
    if (fromId && !isLidJid(fromId)) return fromId;
    if (chatId && !isLidJid(chatId)) return chatId;
    if (fromId) return fromId;
    if (chatId) return chatId;

    // For group messages or other cases
    // const messageId = message.id || 'unknown';

    // if (messageId && messageId !== 'unknown') {
    //   if (typeof messageId === 'object' && messageId !== null && 'id' in messageId) {
    //     const idValue = (messageId as { id: unknown }).id;
    //     if (idValue !== null && idValue !== undefined) {
    //       const idStr = String(idValue);
    //       const idParts = idStr.split('_');
    //       if (idParts.length >= 2) {
    //         return idParts[0]; // Usually the group/user ID
    //       }
    //     }
    //   } else if (typeof messageId === 'string') {
    //     const idParts = messageId.split('_');
    //     if (idParts.length >= 2) {
    //       return idParts[0];
    //     }
    //   }
    // }

    return undefined;
  }

  private async handleIncomingMessage(
    sessionName: string,
    message: WPPConnectMessage,
  ): Promise<void> {
    try {
      if (!message) {
        this.logger.warn({
          severity: LogSeverity.WARNING,
          message: `[${sessionName}] Recebeu objeto de mensagem 'null' ou 'undefined'`,
        });
        return;
      }

      // 1. Extração simplificada e segura do ID
      const messageId =
        typeof message.id === 'object'
          ? (message.id as any)?._serialized || (message.id as any)?.id?.toString()
          : message.id?.toString() || 'unknown';

      this.logger.debug({
        severity: LogSeverity.DEBUG,
        message: `[${sessionName}] Raw message: ${JSON.stringify(message, null, 2)}`,
      });

      const remoteJid = this.getRemoteJid(message);
      if (!remoteJid) {
        this.logger.warn({
          severity: LogSeverity.WARNING,
          message: `[${sessionName}] Não foi possível determinar a origem da mensagem:`,
          messageId,
        });
        return;
      }

      this.logger.debug({
        severity: LogSeverity.DEBUG,
        message: `[${sessionName}] JID da mensagem extraído: ${remoteJid}`,
      });

      // 2. Transformação com lógica mais clara
      const incomingMessage: IncomingWhatsappMessage = {
        sessionId: sessionName,
        from: remoteJid,
        body: message.body || '',
        timestamp: message.t ? new Date(message.t * 1000) : new Date(),
        isGroup: !!message.isGroupMsg,
        chatId: remoteJid,
        messageId: messageId !== 'unknown' ? messageId : undefined,
        hasMedia: !!message.mediaKey,
        isForwarded: !!message.isForwarded,
      };

      this.webhookService.emitMessageReceived(incomingMessage);
    } catch (error) {
      this.logger.error({
        severity: LogSeverity.ERROR,
        message: `[${sessionName}] Erro ao processar mensagem:`,
        error,
      });
    }
  }
}
