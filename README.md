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

#### 2. Arquitetura Modular
O projeto segue uma arquitetura modular para facilitar a manutenção e escalabilidade. Os seguintes módulos já possuem estrutura inicial (Controllers/Services):

- **Chatbot Module**: 
  - Responsável pela lógica principal de conversação e interface com o webhook.
- **Leads Module**: 
  - Estrutura inicial criada para futuro gerenciamento de leads capturados.
  - Controller definido: `/leads` (Endpoints em desenvolvimento).
- **Tickets Module**: 
  - Estrutura inicial criada para gestão de atendimentos.
  - Controller definido: `/tickets` (Endpoints em desenvolvimento).
- **Users Module**: 
  - Estrutura inicial para gestão de usuários do sistema.
  - Controller definido: `/users` (Endpoints em desenvolvimento).
- **Sessions Module**: 
  - Módulo interno (sem controller exposto) focado na gestão de estados e sessões dos usuários/bots.

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
*Documentação gerada automaticamente com base no estado atual do desenvolvimento.*
