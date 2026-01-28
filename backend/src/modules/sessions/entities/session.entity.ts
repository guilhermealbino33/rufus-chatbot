import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Lead } from '../../leads/entities/lead.entity';
import { BaseEntity } from '../../../shared/entities/base.entity';

@Entity('sessions')
export class Session extends BaseEntity {
    @Column({ name: 'phone' })
    phone: string;

    @Column({ name: 'current_state', default: 'INITIAL' })
    currentState: string;

    @Column('jsonb', { default: {} })
    context: Record<string, any>;

    @Column({ name: 'last_interaction', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    lastInteraction: Date;

    @Column({ name: 'is_active', default: false })
    isActive: boolean;

    @Column({ name: 'lead_id' })
    leadId: number;

    @ManyToOne(() => Lead, (lead) => lead.sessions)
    @JoinColumn({ name: 'lead_id' })
    @Index()
    lead: Lead;
}
