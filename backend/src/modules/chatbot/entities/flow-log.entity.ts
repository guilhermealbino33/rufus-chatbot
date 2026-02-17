import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../../shared/entities/base.entity';
import { IsString, IsOptional } from 'class-validator';

@Entity('flow_logs')
export class FlowLog extends BaseEntity {
  @Column()
  @IsString()
  sessionId: string;

  @Column()
  @IsString()
  userPhone: string;

  @Column({ name: 'previous_step' })
  @IsString()
  previousStep: string;

  @Column({ name: 'new_step' })
  @IsString()
  newStep: string;

  @Column({ name: 'action', default: 'USER_MESSAGE' })
  @IsString()
  action: string;

  @Column({ name: 'input_content', type: 'text', nullable: true })
  @IsOptional()
  @IsString()
  inputContent: string;

  @Column('jsonb', { nullable: true })
  metadata: Record<string, any>;
}
