import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Lead } from '../../leads/entities/lead.entity';

export enum Direction {
    INBOUND = 'INBOUND',
    OUTBOUND = 'OUTBOUND',
}

@Entity('message_logs')
export class MessageLog {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'lead_id' })
    leadId: string;

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

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;
}
