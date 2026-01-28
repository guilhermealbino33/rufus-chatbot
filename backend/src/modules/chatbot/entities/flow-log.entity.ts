import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../../shared/entities/base.entity';

@Entity('flow_logs')
export class FlowLog extends BaseEntity {
    @Column()
    phone: string;

    @Column({ name: 'from_state' })
    fromState: string;

    @Column({ name: 'to_state' })
    toState: string;

    @Column({ name: 'user_input' })
    userInput: string;

    @Column('jsonb', { nullable: true })
    metadata: Record<string, any>;
}
