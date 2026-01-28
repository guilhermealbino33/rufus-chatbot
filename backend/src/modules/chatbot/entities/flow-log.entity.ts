import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('flow_logs')
export class FlowLog {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    phone: string;

    @Column({ name: 'from_state' })
    fromState: string;

    @Column({ name: 'to_state' })
    toState: string;

    @Column({ name: 'user_input' })
    userInput: string;

    @Column('jsonb', { nullable: true })
    metadata: Record<string, any>;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;
}
