import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { CrosscuttingConfigModule } from './crosscutting/config';
import { AuthModule } from './modules/auth';
import { ChatbotModule } from './modules/chatbot/chatbot.module';
import { HealthModule } from './modules/health';
import { UsersModule } from './modules/users/users.module';
import { WhatsappModule } from './modules/whatsapp/whatsapp.module';
import { ExistsConstraint } from './shared/common/decorators/exists-constraint.decorator';
import { SharedModule } from './shared/shared.module';
import { LoggerModule } from './shared/logger.module';
import { AppDataSource } from './crosscutting/database/data-source';

@Module({
  imports: [
    LoggerModule,
    CrosscuttingConfigModule,
    EventEmitterModule.forRoot(),
    TypeOrmModule.forRoot({
      ...AppDataSource.options,
      autoLoadEntities: true,
      retryAttempts: 10,
      retryDelay: 3000,
    }),

    AuthModule,
    ChatbotModule,
    HealthModule,
    UsersModule,
    WhatsappModule,
    SharedModule,
  ],
  controllers: [],
  providers: [ExistsConstraint],
})
export class AppModule {}
