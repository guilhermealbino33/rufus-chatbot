import { Module, Global } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { databaseConfig, serverConfig, authConfig, whatsappConfig } from './namespaces';

@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      // Em produção (Railway), não há arquivo .env — usa apenas process.env
      ignoreEnvFile: process.env.NODE_ENV === 'production',
      // Carrega os namespaces tipados por domínio
      load: [databaseConfig, serverConfig, authConfig, whatsappConfig],
    }),
  ],
  exports: [NestConfigModule],
})
export class CrosscuttingConfigModule {}
