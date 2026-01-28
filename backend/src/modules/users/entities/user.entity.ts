import { Entity, Column, OneToMany } from 'typeorm';
import { Ticket } from '../../tickets/entities/ticket.entity';
import { BaseEntity } from '../../../shared/entities/base.entity';

@Entity('users')
export class User extends BaseEntity {
    @Column({ unique: true })
    email: string;

    @Column()
    password: string;

    @Column()
    name: string;

    @Column({
        type: 'enum',
        enum: ['admin', 'attendant'],
        default: 'attendant'
    })
    role: string;

    @Column({ name: 'is_active', default: true })
    isActive: boolean;

    // Relacionamento inverso com Tickets (Atendente)
    @OneToMany(() => Ticket, (ticket) => ticket.assignedToUser)
    tickets: Ticket[];
}
