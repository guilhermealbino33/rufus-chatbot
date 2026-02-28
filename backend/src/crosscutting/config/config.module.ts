import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { databaseConfig, serverConfig, authConfig, whatsappConfig } from './namespaces';
import { validate } from './env.validation';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      validate,
      isGlobal: true,
      envFilePath: '.env',
      ignoreEnvFile: process.env.NODE_ENV === 'production',
      load: [databaseConfig, serverConfig, authConfig, whatsappConfig],
    }),
  ],
  exports: [ConfigModule],
})
export class CrosscuttingConfigModule {}
