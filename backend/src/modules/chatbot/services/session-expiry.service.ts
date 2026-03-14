import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppLoggerService } from '@/shared/services/logger.service';
import { ILogger, LogSeverity } from '@/shared/interfaces/logger.interface';
import { WebhookService } from '@/shared/services/webhook.service';
import { OutgoingWhatsappMessage } from '@/shared/interfaces/messaging.interface';
import { ChatbotUserService } from './chatbot-user.service';
import { FlowLog } from '../entities/flow-log.entity';
import { ChatbotState, FlowAction } from '../enums';

const SESSION_TIMEOUT_MINUTES_DEFAULT = 15;
const SESSION_EXPIRY_FAREWELL =
  'Por inatividade, encerramos seu atendimento. Quando precisar, é só nos chamar novamente.';

@Injectable()
export class SessionExpiryService {
  private readonly logger: ILogger;

  constructor(
    private readonly chatbotUserService: ChatbotUserService,
    private readonly webhookService: WebhookService,
    private readonly configService: ConfigService,
    @InjectRepository(FlowLog)
    private readonly flowLogRepository: Repository<FlowLog>,
    private readonly loggerService: AppLoggerService,
  ) {
    this.logger = loggerService.forContext(SessionExpiryService.name);
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async expireInactiveSessions(): Promise<void> {
    const rawTimeout = this.configService.get<string>('SESSION_TIMEOUT_MINUTES');
    const timeoutMinutes = rawTimeout
      ? parseInt(rawTimeout, 10) || SESSION_TIMEOUT_MINUTES_DEFAULT
      : SESSION_TIMEOUT_MINUTES_DEFAULT;
    const defaultSession =
      this.configService.get<string>('SESSION_EXPIRY_DEFAULT_SESSION') ?? 'default';

    const threshold = new Date(Date.now() - timeoutMinutes * 60 * 1000);
    const staleUsers = await this.chatbotUserService.findInactiveUsers(threshold);

    if (staleUsers.length === 0) {
      return;
    }

    this.logger.log({
      severity: LogSeverity.LOG,
      message: `[SessionExpiry] Processing ${staleUsers.length} inactive session(s)`,
    });

    for (const user of staleUsers) {
      try {
        const sessionId =
          user.contextData?.lastSessionId ??
          (await this.getLastSessionForUser(user.phoneNumber)) ??
          defaultSession;
        const targetJid = user.lidIdentifier || `${user.phoneNumber.replace(/\D/g, '')}@c.us`;

        this.webhookService.emitMessageSend({
          sessionId,
          to: targetJid,
          body: SESSION_EXPIRY_FAREWELL,
        } as OutgoingWhatsappMessage);

        await this.chatbotUserService.updateState(user.id, ChatbotState.START);
        await this.logFlow(user.phoneNumber, user.currentStep, ChatbotState.START, sessionId);

        this.logger.debug({
          severity: LogSeverity.DEBUG,
          message: `[SessionExpiry] Expired session for ${user.phoneNumber}, reset to START`,
        });
      } catch (error) {
        this.logger.error({
          severity: LogSeverity.ERROR,
          message: `[SessionExpiry] Failed to expire session for ${user.phoneNumber}: ${error?.message}`,
          stack: (error as Error)?.stack,
        });
      }
    }
  }

  private async getLastSessionForUser(userPhone: string): Promise<string | null> {
    const log = await this.flowLogRepository
      .createQueryBuilder('log')
      .where('log.userPhone = :userPhone', { userPhone: userPhone.replace(/\D/g, '') })
      .orderBy('log.createdAt', 'DESC')
      .limit(1)
      .getOne();

    return log?.sessionId ?? null;
  }

  private async logFlow(
    userPhone: string,
    previousStep: string,
    newStep: string,
    sessionId: string,
  ): Promise<void> {
    try {
      const log = this.flowLogRepository.create({
        sessionId,
        userPhone: userPhone.replace(/\D/g, ''),
        previousStep,
        newStep,
        action: FlowAction.TIMEOUT,
        inputContent: '[SESSION_EXPIRY]',
      });
      await this.flowLogRepository.save(log);
    } catch (e) {
      this.logger.error({
        severity: LogSeverity.ERROR,
        message: `[SessionExpiry] Failed to log flow: ${(e as Error).message}`,
        stack: (e as Error).stack,
      });
    }
  }
}
