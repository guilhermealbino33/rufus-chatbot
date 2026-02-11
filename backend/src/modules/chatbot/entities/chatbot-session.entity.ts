import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../../shared/entities/base.entity';

@Entity('chatbot_sessions')
export class ChatbotSession extends BaseEntity {
  @Column({ unique: true })
  phone: string;

  @Column({ name: 'current_node', default: 'START' })
  currentNode: string;

  @Column('jsonb', { default: {} })
  context: Record<string, any>;

  @Column({ name: 'last_interaction', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  lastInteraction: Date;
}
