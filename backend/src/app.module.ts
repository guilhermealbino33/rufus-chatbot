import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { CrosscuttingConfigModule } from './crosscutting/config';
import { AuthModule } from './modules/auth';
import { ChatbotModule } from './modules/chatbot/chatbot.module';
import { HealthModule } from './modules/health';
import { UsersModule } from './modules/users/users.module';
import { WhatsappModule } from './modules/whatsapp/whatsapp.module';
import { WebhookService } from './shared/services/webhook.service';
import { ExistsConstraint } from './shared/common/decorators/exists-constraint.decorator';
import { SharedModule } from './shared/shared.module';
import { AppDataSource } from './crosscutting/database/data-source';

@Module({
  imports: [
    CrosscuttingConfigModule,
    EventEmitterModule.forRoot(),
    TypeOrmModule.forRoot({
      ...AppDataSource.options,
      autoLoadEntities: true,
    }),

    AuthModule,
    ChatbotModule,
    HealthModule,
    UsersModule,
    WhatsappModule,
    SharedModule,
  ],
  controllers: [],
  providers: [WebhookService, ExistsConstraint],
})
export class AppModule {}
