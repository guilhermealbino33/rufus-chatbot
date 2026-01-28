import { Entity, Column, OneToMany } from 'typeorm';
import { Session } from '../../sessions/entities/session.entity';
import { Ticket } from '../../tickets/entities/ticket.entity';
import { MessageLog } from '../../chatbot/entities/message-log.entity';
import { BaseEntity } from '../../../shared/entities/base.entity';

@Entity('leads')
export class Lead extends BaseEntity {
    @Column({ name: 'phone', unique: true })
    phone: string;

    @Column({ nullable: true })
    name: string;

    @Column({ nullable: true })
    email: string;

    @Column('jsonb', { nullable: true })
    metadata: Record<string, any>;

    @Column({
        type: 'enum',
        enum: ['new', 'contacted', 'qualified', 'converted'],
        default: 'new'
    })
    status: string;

    @OneToMany(() => Session, (session) => session.lead)
    sessions: Session[];

    @OneToMany(() => Ticket, (ticket) => ticket.lead)
    tickets: Ticket[];

    @OneToMany(() => MessageLog, (log) => log.lead)
    logs: MessageLog[];
}
