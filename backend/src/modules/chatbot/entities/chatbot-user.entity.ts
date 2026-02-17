import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../../shared/entities/base.entity';

@Entity('chatbot_users')
export class ChatbotUser extends BaseEntity {
  @Index()
  @Column({ unique: true })
  phoneNumber: string;

  @Column({ nullable: true })
  name: string;

  @Column({ default: 'START' })
  currentStep: string;

  @Column('jsonb', { default: {} })
  contextData: Record<string, any>;

  @Column({ name: 'last_interaction_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  lastInteractionAt: Date;
}
