import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../../shared/entities/base.entity';

export enum Direction {
  INBOUND = 'INBOUND',
  OUTBOUND = 'OUTBOUND',
}

@Entity('message_logs')
export class MessageLog extends BaseEntity {
  @Column({ name: 'lead_id', nullable: true })
  leadId: number;

  @Column()
  direction: string;

  @Column('text')
  content: string;
}
