import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, Index } from 'typeorm';
import { Lead } from '../../leads/entities/lead.entity';

@Entity()
export class Session {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    leadId: string;

    @ManyToOne(() => Lead, (lead) => lead.sessions)
    @Index()
    lead: Lead;

    @Column()
    currentState: string;

    @Column('jsonb', { nullable: true })
    context: any;

    @Column({ default: true })
    isActive: boolean;

    @CreateDateColumn()
    lastInteractionAt: Date;
}
