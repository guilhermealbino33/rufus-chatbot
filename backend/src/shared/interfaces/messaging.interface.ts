/**
 * WhatsApp-specific message interfaces for event-driven communication
 * between WhatsApp module and Chatbot module.
 */

/**
 * Represents an incoming message from WhatsApp
 */
export interface IncomingWhatsappMessage {
    /** Nome da sessão WhatsApp */
    sessionId: string;

    /** Número do remetente (ex: 5511999999999@c.us) */
    from: string;

    /** Conteúdo da mensagem */
    body: string;

    /** Timestamp de quando a mensagem foi recebida */
    timestamp: Date;

    /** Se a mensagem veio de um grupo */
    isGroup: boolean;

    /** ID do chat */
    chatId: string;
}

/**
 * Represents an outgoing message to be sent via WhatsApp
 */
export interface OutgoingWhatsappMessage {
    /** Nome da sessão WhatsApp */
    sessionId: string;

    /** Número do destinatário */
    to: string;

    /** Conteúdo da mensagem a enviar */
    body: string;
}
