import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('whatsapp_sessions')
export class WhatsappSession {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ unique: true })
    sessionName: string;

    @Column({ default: 'disconnected' })
    status: string; // disconnected, connecting, qrcode, connected

    @Column({ type: 'text', nullable: true })
    qrCode: string;

    @Column({ type: 'timestamp', nullable: true })
    connectedAt: Date;

    @Column({ type: 'timestamp', nullable: true })
    disconnectedAt: Date;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
