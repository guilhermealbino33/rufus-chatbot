import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne } from 'typeorm';
import { Lead } from '../../leads/entities/lead.entity';

export enum TicketStatus {
    OPEN = 'OPEN',
    IN_PROGRESS = 'IN_PROGRESS',
    CLOSED = 'CLOSED',
    RESOLVED = 'RESOLVED',
}

@Entity()
export class Ticket {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    leadId: string;

    @ManyToOne(() => Lead, (lead) => lead.tickets)
    lead: Lead;

    @Column({
        type: 'enum',
        enum: TicketStatus,
        default: TicketStatus.OPEN,
    })
    status: TicketStatus;

    @Column({ nullable: true })
    category: string;

    @Column({ nullable: true })
    assignedTo: string;

    @CreateDateColumn()
    createdAt: Date;

    @Column({ nullable: true })
    closedAt: Date;
}
