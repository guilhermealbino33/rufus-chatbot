# Etapa de construção
FROM node:20-bookworm-slim AS builder

# Dependências de sistema para Chromium (lista completa para Debian Bookworm)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    chromium \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libx11-xcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxfixes3 \
    libxi6 \
    libxkbcommon0 \
    libxrandr2 \
    libxss1 \
    libxtst6 \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# Evita download do Chromium pelo Puppeteer; usamos o do sistema
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium
# Diretório padrão onde o WPPConnect armazenará os tokens de sessão
ENV WPPCONNECT_TOKENS_DIR=/usr/src/app/wpp-sessions

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts

COPY . .
RUN npm run build

# Etapa de produção
FROM node:20-bookworm-slim

WORKDIR /usr/src/app

# Dependências de sistema para Chromium (evita "Chromium not found" em produção)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    chromium \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libnss3-tools \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libx11-xcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxfixes3 \
    libxi6 \
    libxkbcommon0 \
    libxrandr2 \
    libxss1 \
    libxtst6 \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# Evita download do Chromium pelo Puppeteer; usamos o do sistema
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium
ENV WPPCONNECT_TOKENS_DIR=/usr/src/app/wpp-sessions

# Copia apenas os arquivos necessários da etapa de construção
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/package*.json ./

RUN npm ci --omit=dev --ignore-scripts

# Script de 'Wait-for-it' para garantir que o banco de dados esteja pronto
COPY --from=builder /usr/src/app/wait-for-it.sh /usr/local/bin/wait-for-it
RUN chmod +x /usr/local/bin/wait-for-it

# Cria o diretório de sessões e garante permissões para o usuário não-root
RUN mkdir -p /usr/src/app/wpp-sessions && chown -R node:node /usr/src/app
USER node

EXPOSE 3000

CMD ["wait-for-it", "db:5432", "--", "node", "dist/main"]
