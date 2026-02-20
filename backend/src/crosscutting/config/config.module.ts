import { Module, Global } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { databaseConfig, serverConfig, authConfig, whatsappConfig } from './namespaces';

@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: process.env.NODE_ENV === 'production',
      load: [databaseConfig, serverConfig, authConfig, whatsappConfig],
    }),
  ],
  exports: [NestConfigModule],
})
export class CrosscuttingConfigModule {}
