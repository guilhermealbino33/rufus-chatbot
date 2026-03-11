import { ChatbotState, FlowAction } from './enums';

export interface FunnelStep {
  id: string;
  message: string;
  type?: 'text' | 'image' | 'video' | 'audio';
  mediaUrl?: string;
  options?: Record<string, string>; // User Input -> Next Step ID
  fallbackNodeId?: string;
  action?: FlowAction;
}

export const FUNNEL_TREE: Record<string, FunnelStep> = {
  [ChatbotState.START]: {
    id: ChatbotState.START,
    message:
      'Olá! Bem-vindo ao Suporte da Rufus. Como podemos ajudar hoje?\n\n1. Financeiro 💰\n2. Suporte Técnico 🛠️\n3. Fale com um atendente 👩‍💼\n0. Encerrar atendimento',
    options: {
      '1': 'FINANCEIRO_MENU',
      '2': 'SUPORTE_MENU',
      '3': 'HUMAN_HANDOFF',
      '0': 'CLOSE_CONVERSATION',
    },
    fallbackNodeId: ChatbotState.START,
  },
  FINANCEIRO_MENU: {
    id: 'FINANCEIRO_MENU',
    message:
      'Setor Financeiro. Por favor, escolha uma opção:\n\n1. 2ª via de boleto 📄\n2. Status de pagamento 💳\n3. Voltar ao menu principal 🔙\n0. Encerrar atendimento',
    options: {
      '1': 'BOLETO_ACTION',
      '2': 'PAYMENT_STATUS',
      '3': ChatbotState.START,
      '0': 'CLOSE_CONVERSATION',
    },
    fallbackNodeId: 'FINANCEIRO_MENU',
  },
  SUPORTE_MENU: {
    id: 'SUPORTE_MENU',
    message:
      'Suporte Técnico. Como podemos ajudar?\n\n1. Problemas de acesso 🔐\n2. Dúvidas sobre o sistema ❓\n3. Voltar ao menu principal 🔙\n0. Encerrar atendimento',
    options: {
      '1': 'ACCESS_ISSUE',
      '2': 'SYSTEM_FAQ',
      '3': ChatbotState.START,
      '0': 'CLOSE_CONVERSATION',
    },
    fallbackNodeId: 'SUPORTE_MENU',
  },
  HUMAN_HANDOFF: {
    id: 'HUMAN_HANDOFF',
    message:
      'Entendido. Estou transferindo seu atendimento para um de nossos especialistas. Por favor, aguarde um momento...',
    action: FlowAction.HANDOFF,
  },
  ACCESS_ISSUE: {
    id: 'ACCESS_ISSUE',
    message:
      'Para redefinir sua senha, acesse o portal do cliente e clique em "Esqueci minha senha".\n\nIsso resolveu seu problema?\n1. Sim 👍\n2. Não, preciso de mais ajuda 👎\n0. Encerrar atendimento',
    options: {
      '1': 'FEEDBACK_POSITIVE',
      '2': 'HUMAN_HANDOFF',
      '0': 'CLOSE_CONVERSATION',
    },
    fallbackNodeId: 'ACCESS_ISSUE',
  },
  SYSTEM_FAQ: {
    id: 'SYSTEM_FAQ',
    message:
      'Você pode consultar nosso FAQ completo em: https://ajuda.rufus.com.br\n\nDeseja voltar ao menu?\n1. Sim\n2. Encerrar atendimento\n0. Sair',
    options: {
      '1': ChatbotState.START,
      '2': 'CLOSE_CONVERSATION',
      '0': 'CLOSE_CONVERSATION',
    },
  },
  BOLETO_ACTION: {
    id: 'BOLETO_ACTION',
    message:
      'Enviamos a 2ª via do boleto para o seu e-mail cadastrado. Verifique sua caixa de entrada (e spam).',
    action: FlowAction.CLOSE,
  },
  PAYMENT_STATUS: {
    id: 'PAYMENT_STATUS',
    message: 'Seu último pagamento foi processado com sucesso em 10/02/2026.',
    action: FlowAction.CLOSE,
  },
  FEEDBACK_POSITIVE: {
    id: 'FEEDBACK_POSITIVE',
    message: 'Ótimo! Fico feliz em ter ajudado. Até a próxima! 👋',
    action: FlowAction.CLOSE,
  },
  CLOSE_CONVERSATION: {
    id: 'CLOSE_CONVERSATION',
    message: 'Obrigado pelo contato. Tenha um ótimo dia!',
    action: FlowAction.CLOSE,
  },
};

/**
 * Reusable main menu message for greeting normalization and fallback.
 */
export function getMainMenuMessage(): string {
  return FUNNEL_TREE[ChatbotState.START].message;
}
