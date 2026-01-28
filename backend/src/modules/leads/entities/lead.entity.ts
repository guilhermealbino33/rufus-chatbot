import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { Session } from '../../sessions/entities/session.entity';
import { Ticket } from '../../tickets/entities/ticket.entity';
import { MessageLog } from '../../chat/entities/message-log.entity';

@Entity()
export class Lead {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ unique: true })
    phoneNumber: string;

    @Column({ nullable: true })
    name: string;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    @OneToMany(() => Session, (session) => session.lead)
    sessions: Session[];

    @OneToMany(() => Ticket, (ticket) => ticket.lead)
    tickets: Ticket[];

    @OneToMany(() => MessageLog, (log) => log.lead)
    logs: MessageLog[];
}
