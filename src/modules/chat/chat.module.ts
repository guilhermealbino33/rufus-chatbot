import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatService } from './chat.service';
import { MessageLog } from './entities/message-log.entity';

@Module({
  imports: [TypeOrmModule.forFeature([MessageLog])],
  providers: [ChatService],
})
export class ChatModule { }
