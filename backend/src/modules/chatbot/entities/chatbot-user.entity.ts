import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../../shared/entities/base.entity';
import { IsNotEmpty, IsOptional, IsString, IsObject } from 'class-validator';

@Entity('chatbot_users')
export class ChatbotUser extends BaseEntity {
  @Index()
  @Column({ unique: true })
  @IsNotEmpty()
  @IsString()
  phoneNumber: string;

  @Column({ nullable: true })
  @IsOptional()
  @IsString()
  name: string;

  @Column({ default: 'START' })
  @IsString()
  currentStep: string;

  @Column('jsonb', { default: {} })
  @IsObject()
  contextData: Record<string, any>;

  @Column({ name: 'last_interaction_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  lastInteractionAt: Date;
}
