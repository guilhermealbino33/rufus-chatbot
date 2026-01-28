import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Lead } from '../../leads/entities/lead.entity';
import { User } from '../../users/entities/user.entity';
import { BaseEntity } from '../../../shared/entities/base.entity';

@Entity('tickets')
export class Ticket extends BaseEntity {
    @Column()
    subject: string;

    @Column('text')
    description: string;

    @Column({
        type: 'enum',
        enum: ['open', 'in_progress', 'resolved', 'closed'],
        default: 'open'
    })
    status: string;

    @Column({
        type: 'enum',
        enum: ['low', 'medium', 'high', 'urgent'],
        default: 'medium'
    })
    priority: string;

    @Column({ name: 'lead_id' })
    leadId: number;

    @ManyToOne(() => Lead, (lead) => lead.tickets)
    @JoinColumn({ name: 'lead_id' })
    lead: Lead;

    @Column({ name: 'assigned_to', nullable: true })
    assignedTo: number; // Temporário até criar User Entity

    @ManyToOne(() => User, { nullable: true })
    @JoinColumn({ name: 'assigned_to' })
    assignedToUser: User;

    @Column({ name: 'closed_at', nullable: true })
    closedAt: Date;
}
