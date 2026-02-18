# 🐶 Rufus Chatbot

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-18%2B-green.svg" alt="Node.js Version">
  <img src="https://img.shields.io/badge/Framework-NestJS-red.svg" alt="NestJS">
  <img src="https://img.shields.io/badge/Integration-WPPConnect-blue.svg" alt="WPPConnect">
  <img src="https://img.shields.io/badge/Database-PostgreSQL-blue.svg" alt="PostgreSQL">
  <img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License">
</p>

O **Rufus Chatbot** é uma solução inteligente e modular projetada para automação de conversas via WhatsApp. Integrando o poder do **NestJS** com a robustez do **WPPConnect**, o Rufus oferece uma plataforma escalável para gerenciar múltiplas sessões, garantir a entrega de mensagens e automatizar fluxos de atendimento com facilidade.

---

## 🏗️ Estrutura do Monorepo

O projeto utiliza **npm workspaces** para uma gestão eficiente de múltiplos pacotes:

- [**backend/**](file:///home/guilherme/Documentos/dev/rufus-chatbot/backend) - API Core desenvolvida em NestJS.
- [**frontend/**](file:///home/guilherme/Documentos/dev/rufus-chatbot/frontend) - Dashboard administrativo (Em desenvolvimento).
- [**collection.json**](file:///home/guilherme/Documentos/dev/rufus-chatbot/collection.json) - Postman Collection v2.1 para testes de API.

---

## 🚀 Funcionalidades Principais

### 📱 Gestão Avançada de WhatsApp

O Rufus vai além de uma simples integração, oferecendo controle total do ciclo de vida das sessões:

- **Múltiplas Sessões**: Conecte diversos números simultaneamente sob demanda.
- **Sessões Síncronas**: Criação de sessão com retorno imediato do QR Code (timeout de 20s).
- **Recuperação Automática**: Sistema inteligente que recupera conexões perdidas ao reiniciar o servidor, baseando-se no estado persistido.
- **Monitoramento Robusto**: Estados em tempo real (`CONNECTED`, `QRCODE`, `DISCONNECTED`) validados contra a memória e o banco de dados.
- **Validação Antecipada**: Checagem de números válidos no WhatsApp antes do envio para evitar erros.

### 🤖 Webhooks e Processamento

- **Roteamento Inteligente**: Receba e processe mensagens recebidas via webhooks.
- **Logs de Auditoria**: Rastreamento completo de mensagens enviadas e recebidas para fins de depuração e conformidade.

---

## 🛠️ Stack Tecnológica

| Camada             | Tecnologia                           |
| :----------------- | :----------------------------------- |
| **Runtime**        | Node.js (v18+)                       |
| **Framework**      | NestJS                               |
| **Integração WA**  | WPPConnect                           |
| **Banco de Dados** | PostgreSQL (TypeORM)                 |
| **Comunicação**    | RxJS, Event Emitter                  |
| **Qualidade**      | ESLint, Prettier, Husky, lint-staged |

---

## 🏁 Instalação e Configuração

### Pré-requisitos

- Node.js instalada (LTS recomendada)
- Docker & Docker Compose (para banco de dados)

### Setup Rápido

1. **Instale as dependências da raiz:**

   ```bash
   npm install
   ```

2. **Configure o Ambiente:**

   ```bash
   # Dentro da pasta backend/
   cp .env.example .env
   ```

   _Edite o `.env` com suas credenciais do PostgreSQL._

3. **Inicie o Banco de Dados:**

   ```bash
   docker-compose up -d
   ```

4. **Inicie em Modo Desenvolvimento:**
   ```bash
   npm run backend:dev
   ```

---

## 🧪 Testando a API

1. Importe o [**collection.json**](file:///home/guilherme/Documentos/dev/rufus-chatbot/collection.json) no Postman.
2. Defina a variável `base_url` como `http://localhost:3000`.
3. Utilize os endpoints em `/whatsapp/sessions` para criar sua primeira conexão.

---

## 🚂 Deploy (Railway)

Para publicar o backend no Railway com Docker (recomendado para WPPConnect/Chromium), use o guia em [**backend/docs/RAILWAY_DEPLOY.md**](backend/docs/RAILWAY_DEPLOY.md): instalação da CLI, variáveis de ambiente e primeiro deploy.

---

## 📋 Roadmap

- [ ] **Interface Web**: Dashboard completo para gestão de sessões e histórico.
- [ ] **Integração com LLM**: Conexão nativa com modelos de IA (OpenAI/Anthropic) para respostas contextuais.
- [ ] **Gestão de Grupos**: Suporte avançado para leitura e escrita em grupos.
- [ ] **Temas de Mensagens**: Suporte a templates ricos (botões, listas, menções).

---

## 📄 Licença

Este projeto está sob a licença [MIT](file:///home/guilherme/Documentos/dev/rufus-chatbot/LICENSE).

---

<p align="center">
  Desenvolvido com ❤️ pela equipe Rufus.
  <br>
  <i>Última atualização: 10 de fevereiro de 2026</i>
</p>
