# Deploy no Railway (primeiro deploy)

Guia resumido para publicar o backend no Railway usando Docker (recomendado para WPPConnect/Chromium).

## Pré-requisitos

- Conta no [Railway](https://railway.app)
- Projeto com variáveis de ambiente (DB, etc.)

## 1. Instalar a CLI do Railway

```bash
npm i -g @railway/cli
# ou
curl -fsSL https://railway.com/install.sh | sh
```

## 2. Login e linkar o projeto

```bash
railway login
cd backend
railway link   # escolher projeto existente ou criar novo
```

## 3. Variáveis de ambiente

Definir no dashboard do Railway (ou via CLI) as variáveis obrigatórias e opcionais:

**Obrigatórias (exemplo):**

```bash
railway variables set NODE_ENV=production
railway variables set PORT=3000
railway variables set DATABASE_HOST=...
railway variables set DATABASE_PORT=5432
railway variables set DATABASE_USERNAME=...
railway variables set DATABASE_PASSWORD=...
railway variables set DATABASE_NAME=...
```

**Opcionais:**

```bash
# CORS (lista separada por vírgula ou vazio = allow all)
railway variables set CORS_ORIGIN=https://seu-front.vercel.app

# Chromium no Dockerfile já usa /usr/bin/chromium; sobrescrever se necessário
# railway variables set CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium

# Auth (futuro)
# railway variables set JWT_SECRET=seu-secret-forte
```

## 4. Deploy com Docker

Configurar o serviço no Railway para usar **Docker** (root do build = pasta `backend`):

- Em **Settings** do serviço: **Build** → **Dockerfile Path** = `Dockerfile` (ou deixar detectar na raiz do serviço).
- Garantir que o **Root Directory** do serviço seja `backend` (se o repositório for monorepo na raiz).

Deploy a partir da pasta `backend`:

```bash
cd backend
railway up
```

Ou conectar o repositório GitHub ao Railway e configurar o build para a pasta `backend` com Dockerfile.

## 5. Verificação

Após o deploy, a API fica em `https://<seu-app>.railway.app`. Prefixo global: `/api`.

- Health (exemplo): `GET https://<seu-app>.railway.app/api/...`
- O Railway define `PORT` automaticamente; a app usa `ConfigService.get('port')`.

## Trocar de provedor (AWS App Runner / Google Cloud Run)

A lógica de porta e CORS está em `main.ts` via `ConfigService`. Basta definir as mesmas variáveis de ambiente (`PORT`, `CORS_ORIGIN`, `DATABASE_*`, etc.) no novo provedor e usar o mesmo `Dockerfile` (ou um equivalente com base Debian + Chromium).
