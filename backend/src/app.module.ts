import { Module, Global, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { CrosscuttingConfigModule } from './crosscutting/config';
import { AuthModule } from './modules/auth';
import { ChatbotModule } from './modules/chatbot/chatbot.module';
import { UsersModule } from './modules/users/users.module';
import { WhatsappModule } from './modules/whatsapp/whatsapp.module';
import { WebhookService } from './shared/services/webhook.service';
import { ExistsConstraint } from './shared/common/decorators/exists-constraint.decorator';

@Global()
@Module({
  imports: [
    CrosscuttingConfigModule,
    EventEmitterModule.forRoot(),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const dbHost = config.get<string>('database.host');
        const dbPort = config.get<number>('database.port');
        const dbName = config.get<string>('database.name');
        const nodeEnv = config.get<string>('nodeEnv');

        Logger.log(
          `TypeORM config → host=${dbHost}, port=${dbPort}, db=${dbName}, nodeEnv=${nodeEnv}`,
          'DatabaseConfig',
        );

        return {
          type: 'postgres',
          host: dbHost,
          port: dbPort,
          username: config.get<string>('database.username'),
          password: config.get<string>('database.password'),
          database: dbName,
          autoLoadEntities: true,
          synchronize: nodeEnv !== 'production',
        };
      },
    }),
    AuthModule,
    ChatbotModule,
    UsersModule,
    WhatsappModule,
  ],
  controllers: [],
  providers: [WebhookService, ExistsConstraint],
  exports: [WebhookService],
})
export class AppModule {}
