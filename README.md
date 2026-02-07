# 🐶 Rufus Chatbot

Bem-vindo ao repositório do **Rufus Chatbot**. Este é um projeto monorepo desenvolvido para fornecer um sistema de chatbot modular e inteligente, com foco principal na integração robusta com o WhatsApp.

---

## 🏗️ Estrutura do Projeto

O projeto é organizado como um monorepo utilizando **npm workspaces**:

- **[backend](file:///home/guilherme/Documentos/dev/rufus-chatbot/backend)**: API robusta desenvolvida com [NestJS](https://nestjs.com/).
- **[frontend](file:///home/guilherme/Documentos/dev/rufus-chatbot/frontend)**: (Em desenvolvimento) Interface administrativa.
- **[Postman Collection](file:///home/guilherme/Documentos/dev/rufus-chatbot/collection.json)**: Coleção completa de rotas para testes rápidos.

---

## 🚀 Funcionalidades do Backend

O backend é o coração do Rufus, oferecendo uma integração avançada com o WhatsApp via **WPPConnect**.

### 📱 Integração WhatsApp (`/whatsapp`)

O sistema gerencia o ciclo de vida completo de sessões do WhatsApp:

- **Gerenciamento de Sessões**:
  - **Criação Dinâmica**: Inicialize múltiplas sessões simultâneas.
  - **QR Code Real-time**: Obtenha o QR Code em Base64 para autenticação instantânea.
  - **Monitoramento de Status**: Verifique se o cliente está `CONNECTED`, `QRCODE` ou `DISCONNECTED`.
  - **Auto-Recuperação**: Sistema inteligente que tenta reconectar sessões perdidas automaticamente.
- **Mensageria**:
  - **Envio Validado**: Antes de enviar, o sistema valida se o número de destino é real no WhatsApp, evitando erros de "Session not found" ou números inválidos.
  - **Suporte a Filas**: (Em breve) Processamento assíncrono de mensagens.

### 🤖 Core do Chatbot (`/webhook`)

- **Processamento de Mensagens**: Recebe webhooks e processa a lógica de conversação.
- **Logs de Auditoria**: (Implementado) Rastreabilidade de mensagens recebidas e enviadas.

---

## 🛠️ Tecnologias Utilizadas

- **Runtime**: Node.js (v18+)
- **Framework**: NestJS
- **Integração WA**: WPPConnect
- **Banco de Dados**: PostgreSQL (TypeORM)
- **Qualidade de Código**: ESLint, Prettier, Husky & lint-staged

---

## 🏁 Como Começar

### Pré-requisitos

- Node.js instalado
- Docker (opcional, para o banco de dados)

### Instalação

Na raiz do projeto, instale todas as dependências (backend e frontend) de uma vez:

```bash
npm install
```

### Configuração

1. Vá para `backend/` e copie o arquivo de exemplo:
   ```bash
   cp backend/.env.example backend/.env
   ```
2. Ajuste as credenciais do banco de dados no `.env`.

### Executando em Desenvolvimento

Você pode rodar os módulos diretamente da raiz usando os scripts de workspace:

- **Rodar Backend**: `npm run backend:dev`
- **Rodar Frontend**: `npm run frontend:dev` (se disponível)
- **Lint & Formatação**: `npm run lint` ou `npm run format`

---

## 🧪 Testes e API

Para facilitar o desenvolvimento, utilize a coleção do Postman inclusa:

1. Importe o arquivo `collection.json` no Postman.
2. Configure a variável `base_url` (padrão: `http://localhost:3000`).

---

## 📋 Roadmap / Próximos Passos

- [ ] Implementar interface de dashboard no frontend.
- [ ] Adicionar suporte a templates de mensagens.
- [ ] Integração com IA para respostas contextuais.
- [ ] Dockerização completa do ambiente de desenvolvimento.

---

_Documentação atualizada em: 07 de fevereiro de 2026_
