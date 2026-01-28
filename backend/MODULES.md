# Módulos do Backend

Este documento descreve a responsabilidade de cada módulo presente na aplicação.

## 1. Chatbot Module (`src/modules/chatbot`)
Responsável pela integração com canais de mensagem (ex: WhatsApp) e lógica conversacional.
- **Principais Entidades**: `MessageLog`, `FlowLog`.
- **Funcionalidades**:
  - Webhook para recebimento de mensagens (`/webhook`).
  - Processamento de mensagens de entrada.
  - Logs de mensagens (entrada/saída) e navegação de fluxo.
  - Lógica central de decisão do bot.

## 2. Leads Module (`src/modules/leads`)
Responsável pela gestão de potenciais clientes (Leads) identificados pelo bot ou cadastrados manualmente.
- **Principais Entidades**: `Lead`.
- **Funcionalidades**:
  - Cadastro e listagem de leads.
  - Armazenamento de dados de contato (telefone, email, nome).
  - Gerenciamento de status (novo, contactado, qualificado, convertido).
  - Histórico de interações vinculado.

## 3. Sessions Module (`src/modules/sessions`)
Gerencia o estado da conversa e a sessão ativa dos usuários/leads com o bot. Essencial para manter o contexto do diálogo.
- **Principais Entidades**: `Session`.
- **Funcionalidades**:
  - Controle de estado atual da conversa (`currentState`).
  - Armazenamento de contexto temporário da sessão (variáveis em memória/banco).
  - Rastreamento da última interação e controle de inatividade.

## 4. Tickets Module (`src/modules/tickets`)
Gerencia atendimentos humanos e solicitações de suporte que transbordam do bot ou são criadas internamente.
- **Principais Entidades**: `Ticket`.
- **Funcionalidades**:
  - Criação e gestão de tickets de suporte.
  - Vinculação de tickets a um Lead (cliente) e um User (atendente).
  - Controle de prioridade (baixa, média, alta) e status (aberto, resolvido, etc).

## 5. Users Module (`src/modules/users`)
Gerencia os usuários internos do sistema (administradores e atendentes).
- **Principais Entidades**: `User`.
- **Funcionalidades**:
  - Cadastro e gestão de usuários.
  - Controle de perfil e permissões (Admin vs Atendente).
  - Associação com tickets para distribuição de tarefas.
