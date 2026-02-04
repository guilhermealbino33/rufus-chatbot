# Rufus Chatbot

Bem-vindo ao repositório do Rufus Chatbot. Este projeto visa criar um chatbot inteligente modularizado.

## 🚀 Backend

O backend está localizado na pasta `backend` e foi desenvolvido utilizando [NestJS](https://nestjs.com/).

### Funcionalidades Disponíveis (Backend)

Atualmente, o backend conta com as seguintes funcionalidades implementadas:

#### 1. Webhook de Recebimento de Mensagens
- **Endpoint**: `POST /webhook`
- **Módulo**: `Chatbot`
- **Descrição**: Rota pública para recebimento de webhooks (ex: de integrações com WhatsApp).
- **Fluxo Atual**:
  1. O endpoint recebe um payload JSON via `POST`.
  2. Identifica se o evento é do tipo `message`.
  3. Extrai o conteúdo e remetente.
  4. Encaminha para o `ChatbotService` para processamento da lógica de resposta.
  5. Loga no console a resposta que seria enviada (simulação de envio).
  6. Retorna status `200 OK` rapidamente para o webhook.

#### 2. Whatsapp Integration
- **Módulo**: `Whatsapp`
- **Descrição**: Integração completa com API do WhatsApp via WPPConnect.
- **Funcionalidades**:
  - **Sessões (`/whatsapp/sessions`)**: 
    - Criação de sessões.
    - Geração de QR Code (retornado em Base64).
    - Verificação de status em tempo real (`CONNECTED`, `QRCODE`, `DISCONNECTED`).
    - **Auto-Recuperação**: O sistema tenta recuperar automaticamente sessões desconectadas ao verificar o status.
  - **Mensagens (`/whatsapp/messages/send`)**:
    - Envio de mensagens de texto.
    - Validação automática de números (retorna `400 Bad Request` se número não existir/inválido).

#### 3. Arquitetura Modular
O projeto segue uma arquitetura modular para facilitar a manutenção e escalabilidade:

- **Chatbot Module**: 
  - Responsável pela lógica principal de conversação e interface com o webhook.
- **Whatsapp Module**:
  - Gerenciamento de conexão com WhatsApp, envio e recebimento de mensagens.
- **Users Module**: 
  - Estrutura inicial para gestão de usuários do sistema.

### 🛠️ Como Executar o Backend

Pré-requisitos: Node.js instalado.

1. Navegue até a pasta do backend:
   ```bash
   cd backend
   ```

2. Instale as dependências do projeto:
   ```bash
   npm install
   ```

3. Execute o servidor em modo de desenvolvimento (watch mode):
   ```bash
   npm run start:dev
   ```

4. O servidor estará rodando em `http://localhost:3000` (porta padrão).

---
*Documentação atualizada em 03/02/2026*
