import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne } from 'typeorm';
import { Lead } from '../../leads/entities/lead.entity';

export enum Direction {
    INBOUND = 'INBOUND',
    OUTBOUND = 'OUTBOUND',
}

@Entity()
export class MessageLog {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    leadId: string;

    @ManyToOne(() => Lead, (lead) => lead.logs)
    lead: Lead;

    @Column({
        type: 'enum',
        enum: Direction,
    })
    direction: Direction;

    @Column('text')
    content: string;

    @CreateDateColumn()
    createdAt: Date;
}
