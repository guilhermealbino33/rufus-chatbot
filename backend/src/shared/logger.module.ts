import { Global, Module } from '@nestjs/common';
import { AppLoggerService } from './services/logger.service';

@Global()
@Module({
  providers: [AppLoggerService],
  exports: [AppLoggerService],
})
export class LoggerModule {}
