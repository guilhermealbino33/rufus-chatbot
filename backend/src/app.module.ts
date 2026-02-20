import { Module, Logger } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import {
  authConfig,
  CrosscuttingConfigModule,
  databaseConfig,
  serverConfig,
  whatsappConfig,
} from './crosscutting/config';
import { AuthModule } from './modules/auth';
import { ChatbotModule } from './modules/chatbot/chatbot.module';
import { UsersModule } from './modules/users/users.module';
import { WhatsappModule } from './modules/whatsapp/whatsapp.module';
import { WebhookService } from './shared/services/webhook.service';
import { ExistsConstraint } from './shared/common/decorators/exists-constraint.decorator';

@Module({
  imports: [
    CrosscuttingConfigModule,
    EventEmitterModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      load: [databaseConfig, authConfig, serverConfig, whatsappConfig],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const dbHost = config.get<string>('database.host');
        const dbPort = config.get<number>('database.port');
        const dbName = config.get<string>('database.name');
        const nodeEnv = config.get<string>('nodeEnv');

        // Logando as variáveis de ambiente
        Logger.log(`Environment Variables:`, 'DatabaseConfig');
        Logger.log(`DATABASE_HOST: ${dbHost}`, 'DatabaseConfig');
        Logger.log(`DATABASE_PORT: ${dbPort}`, 'DatabaseConfig');
        Logger.log(`DATABASE_NAME: ${dbName}`, 'DatabaseConfig');
        Logger.log(`NODE_ENV: ${nodeEnv}`, 'DatabaseConfig');

        return {
          type: 'postgres',
          host: dbHost,
          port: dbPort,
          username: config.get<string>('database.username'),
          password: config.get<string>('database.password'),
          database: dbName,
          autoLoadEntities: true,
        };
      }, // <-- Chave de fechamento do useFactory que estava faltando
    }),
    AuthModule,
    ChatbotModule,
    UsersModule,
    WhatsappModule,
  ],
  controllers: [],
  providers: [WebhookService, ExistsConstraint],
})
export class AppModule {}
