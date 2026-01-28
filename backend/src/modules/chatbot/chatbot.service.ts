import { Injectable } from '@nestjs/common';

@Injectable()
export class ChatbotService {
    constructor() { }

    async processMessage(phoneNumber: string, messageBody: string) {
        // TODO: Re-implement using custom modules (Leads, Sessions, Tickets)
        return { response: 'Chatbot em manutenção para migração de arquitetura.' };
    }
}
