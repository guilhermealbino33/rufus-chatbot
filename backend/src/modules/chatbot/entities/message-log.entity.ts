import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Lead } from '../../leads/entities/lead.entity';
import { BaseEntity } from '../../../shared/entities/base.entity';

export enum Direction {
    INBOUND = 'INBOUND',
    OUTBOUND = 'OUTBOUND',
}

@Entity('message_logs')
export class MessageLog extends BaseEntity {
    @Column({ name: 'lead_id' })
    leadId: number;

    @ManyToOne(() => Lead, (lead) => lead.logs)
    @JoinColumn({ name: 'lead_id' })
    lead: Lead;

    @Column({
        type: 'enum',
        enum: Direction,
    })
    direction: Direction;

    @Column('text')
    content: string;
}
