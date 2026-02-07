import { BaseEntity } from 'src/shared/entities/base.entity';
import { Entity, Column } from 'typeorm';

@Entity('whatsapp_sessions')
export class WhatsappSession extends BaseEntity {

    @Column({ unique: true, name: 'session_name' })
    sessionName: string;

    @Column({ default: 'disconnected' })
    status: string; // disconnected, connecting, qrcode, connected

    @Column({ type: 'text', nullable: true, name: 'qr_code' })
    qrCode: string;

    @Column({ type: 'timestamp', nullable: true, name: 'connected_at' })
    connectedAt: Date;

    @Column({ type: 'timestamp', nullable: true, name: 'disconnected_at' })
    disconnectedAt: Date;
}
