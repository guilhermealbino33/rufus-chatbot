import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../../shared/entities/base.entity';
import { FlowAction } from '../enums/flow-action.enum';

@Entity('flow_logs')
export class FlowLog extends BaseEntity {
  @Index()
  @Column()
  sessionId: string;

  @Index()
  @Column()
  userPhone: string;

  @Column({ name: 'previous_step' })
  previousStep: string;

  @Column({ name: 'new_step' })
  newStep: string;

  @Index()
  @Column({
    type: 'enum',
    enum: FlowAction,
    default: FlowAction.USER_MESSAGE,
  })
  action: FlowAction;

  @Column({ name: 'input_content', type: 'text', nullable: true })
  inputContent: string;

  @Column('jsonb', { nullable: true })
  metadata: Record<string, any>;
}
