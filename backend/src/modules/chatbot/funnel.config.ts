export interface FunnelStep {
    id: string;
    message: string;
    options?: Record<string, string>; // Opção (1, 2) -> Próximo ID do Passo
    action?: 'HANDOFF' | 'CLOSE'; // Ações especiais
}

export const FUNNEL_TREE: Record<string, FunnelStep> = {
    START: {
        id: 'START',
        message: 'Olá! Bem-vindo ao Suporte. Escolha uma opção:\n1. Financeiro\n2. Suporte Técnico\n3. Fale com um de nossos atendentes',
        options: {
            '1': 'FINANCEIRO_MENU',
            '2': 'SUPORTE_MENU',
            '3': 'HUMAN_HANDOFF',
        },
    },
    FINANCEIRO_MENU: {
        id: 'FINANCEIRO_MENU',
        message: 'Setor Financeiro. Digite:\n1. 2ª via de boleto\n2. Voltar',
        options: {
            '1': 'BOLETO_ACTION',
            '2': 'START'
        }
    },
    SUPORTE_MENU: {
        id: 'SUPORTE_MENU',
        message: 'Suporte Técnico. Digite:\n1. Problemas de acesso\n2. Voltar',
        options: {
            '1': 'ACCESS_ISSUE',
            '2': 'START'
        }
    },
    HUMAN_HANDOFF: {
        id: 'HUMAN_HANDOFF',
        message: 'Aguarde, estamos transferindo para um atendente...',
        action: 'HANDOFF'
    },
    ACCESS_ISSUE: {
        id: 'ACCESS_ISSUE',
        message: 'Para resetar sua senha, acesse nosso portal. Deseja algo mais?',
        options: {
            '1': 'START'
        }
    },
    BOLETO_ACTION: {
        id: 'BOLETO_ACTION',
        message: 'Seu boleto foi enviado para o email cadastrado. Obrigado!',
        action: 'CLOSE'
    }
};
