import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { FUNNEL_TREE } from './funnel.config';

@Injectable()
export class ChatbotService {
    constructor(private prisma: PrismaService) { }

    async processMessage(phoneNumber: string, messageBody: string) {
        // 1. Identificar ou Criar Lead
        let lead = await this.prisma.lead.findUnique({ where: { phoneNumber } });
        if (!lead) {
            lead = await this.prisma.lead.create({ data: { phoneNumber } });
        }

        // 2. Buscar Sessão Ativa
        let session = await this.prisma.session.findFirst({
            where: { leadId: lead.id, isActive: true },
        });

        // Se não tiver sessão ou a última foi há muito tempo (expirou), cria nova no START
        // Aqui poderíamos checar o tempo de expiração também (ex: > 24h)
        if (!session) {
            session = await this.prisma.session.create({
                data: { leadId: lead.id, currentState: 'START' },
            });
            // Retorna a mensagem inicial imediatamente se for início novo
            // Nota: Em produção, talvez queira esperar o 'Oi' do usuário para mandar isso.
            // Mas se o usuário mandou 'Oi', ele cai aqui.
            return { response: FUNNEL_TREE['START'].message };
        }

        // 3. Processar Máquina de Estados (State Machine)
        const currentStep = FUNNEL_TREE[session.currentState];

        if (!currentStep) {
            // Fallback caso o estado não exista mais
            await this.prisma.session.update({
                where: { id: session.id },
                data: { currentState: 'START' }
            });
            return { response: FUNNEL_TREE['START'].message };
        }

        const nextStepId = currentStep.options?.[messageBody.trim()];

        if (nextStepId) {
            // Transição Válida
            const nextStep = FUNNEL_TREE[nextStepId];

            // Atualiza Estado
            await this.prisma.session.update({
                where: { id: session.id },
                data: { currentState: nextStepId },
            });

            // Verifica Ações Especiais
            if (nextStep.action === 'HANDOFF') {
                await this.prisma.ticket.create({ data: { leadId: lead.id, status: 'OPEN' } });
                // Lógica de notificar dashboard via WebSocket aqui
            } else if (nextStep.action === 'CLOSE') {
                await this.prisma.session.update({
                    where: { id: session.id },
                    data: { isActive: false }
                });
            }

            return { response: nextStep.message };
        } else {
            // Opção Inválida - Mantém estado e repete mensagem ou dá erro
            // Se for HANDOFF, não faz nada ou espera humano
            if (currentStep.action === 'HANDOFF') {
                return { response: null }; // Silêncio, pois está esperando humano
            }
            return { response: `Opção inválida.\n\n${currentStep.message}` };
        }
    }
}
