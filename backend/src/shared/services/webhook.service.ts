import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
    IncomingWhatsappMessage,
    OutgoingWhatsappMessage,
} from '../interfaces/messaging.interface';

/**
 * WebhookService - Abstração sobre EventEmitter2 para comunicação entre módulos
 * 
 * Esta classe encapsula o EventEmitter2 e fornece uma interface de domínio
 * específica para mensagens WhatsApp. Isso permite:
 * - Desacoplar módulos do EventEmitter2 (facilita testes e substituição futura)
 * - Interface explícita e tipada para eventos de mensagem
 * - Possibilidade de trocar o mecanismo de eventos (RabbitMQ, Kafka, etc.) sem
 *   modificar os módulos que dependem desta abstração
 */
@Injectable()
export class WebhookService {
    constructor(private readonly eventEmitter: EventEmitter2) { }

    /**
     * Registra um handler para mensagens recebidas do WhatsApp
     * 
     * @param handler - Função assíncrona que processa a mensagem recebida
     */
    onMessageReceived(
        handler: (msg: IncomingWhatsappMessage) => Promise<void>,
    ): void {
        this.eventEmitter.on('message.received', handler);
    }

    /**
     * Emite um evento de mensagem recebida
     * 
     * @param msg - Mensagem recebida do WhatsApp
     */
    emitMessageReceived(msg: IncomingWhatsappMessage): void {
        this.eventEmitter.emit('message.received', msg);
    }

    /**
     * Registra um handler para mensagens a serem enviadas via WhatsApp
     * 
     * @param handler - Função assíncrona que processa o envio da mensagem
     */
    onMessageSend(
        handler: (msg: OutgoingWhatsappMessage) => Promise<void>,
    ): void {
        this.eventEmitter.on('message.send', handler);
    }

    /**
     * Emite um evento de mensagem a ser enviada
     * 
     * @param msg - Mensagem a ser enviada via WhatsApp
     */
    emitMessageSend(msg: OutgoingWhatsappMessage): void {
        this.eventEmitter.emit('message.send', msg);
    }
}
