import { Module, Global } from '@nestjs/common';
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
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('database.host'),
        port: config.get<number>('database.port'),
        username: config.get<string>('database.username'),
        password: config.get<string>('database.password'),
        database: config.get<string>('database.name'),
        autoLoadEntities: true,
        synchronize: config.get<string>('nodeEnv') !== 'production', // Apenas para dev, em prod usar migrations
      }),
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
