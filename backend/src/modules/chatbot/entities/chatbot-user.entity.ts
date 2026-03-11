import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../../shared/entities/base.entity';
import { ChatbotState } from '../enums';

@Entity('chatbot_users')
export class ChatbotUser extends BaseEntity {
  @Index()
  @Column({ unique: true })
  phoneNumber: string;

  @Column({ nullable: true, name: 'lid_identifier' })
  lidIdentifier?: string; // e.g. "257431800180973@lid" — for LID→@c.us reverse mapping (incoming from FB/IG ads)

  @Column({ nullable: true })
  name: string;

  @Index()
  @Column({ default: ChatbotState.START })
  currentStep: string;

  @Column('jsonb', { default: {} })
  contextData: Record<string, any>;

  @Column({ name: 'last_interaction_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  lastInteractionAt: Date;
}
