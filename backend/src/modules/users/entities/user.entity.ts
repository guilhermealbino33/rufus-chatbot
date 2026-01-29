import { Entity, Column } from 'typeorm';
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
}

