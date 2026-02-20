import { Module, Global } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { configuration } from './configuration';

@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      // Em produção (Railway), não há arquivo .env, então ignora e usa apenas process.env
      ignoreEnvFile: process.env.NODE_ENV === 'production',
      // Garante que sempre leia de process.env (padrão do NestJS, mas explícito)
      expandVariables: true,
      load: [configuration],
    }),
  ],
  exports: [NestConfigModule],
})
export class CrosscuttingConfigModule {}
