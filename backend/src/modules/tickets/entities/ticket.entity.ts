import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Lead } from '../../leads/entities/lead.entity';
import { User } from '../../users/entities/user.entity';

@Entity('tickets')
export class Ticket {
    @PrimaryGeneratedColumn('uuid')
    id: string;

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
    leadId: string;

    @ManyToOne(() => Lead, (lead) => lead.tickets)
    @JoinColumn({ name: 'lead_id' })
    lead: Lead;

    @Column({ name: 'assigned_to', nullable: true })
    assignedTo: string; // Temporário até criar User Entity

    @ManyToOne(() => User, { nullable: true })
    @JoinColumn({ name: 'assigned_to' })
    assignedToUser: User;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;

    @Column({ name: 'closed_at', nullable: true })
    closedAt: Date;
}
