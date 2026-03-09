# =============================================================================
# Stage 1: builder (context = backend/ no Railway)
# =============================================================================
FROM node:20-bookworm-slim AS builder

# Dependências de sistema para Chromium (WPPConnect/Puppeteer) – uma única camada
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

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium
ENV WPPCONNECT_TOKENS_DIR=/usr/src/app/wpp-sessions

WORKDIR /usr/src/app

# Camada de dependências (melhor cache: só invalida se package*.json mudar)
COPY package*.json ./
RUN npm ci --ignore-scripts

# Código e build
COPY . .
RUN npm run build

# =============================================================================
# Stage 2: produção (imagem final enxuta)
# =============================================================================
FROM node:20-bookworm-slim AS runner

# Chromium em produção (mesma lista, sem libnss3-tools se não for necessário)
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

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium
ENV WPPCONNECT_TOKENS_DIR=/usr/src/app/wpp-sessions
ENV NODE_ENV=production

WORKDIR /usr/src/app

# Só artefatos de produção: dist + package.json (para npm ci --omit=dev)
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/package*.json ./

# Apenas dependências de produção (reduz tamanho da imagem)
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

COPY --from=builder /usr/src/app/wait-for-it.sh /usr/local/bin/wait-for-it
RUN chmod +x /usr/local/bin/wait-for-it

RUN mkdir -p /usr/src/app/wpp-sessions && chown -R node:node /usr/src/app
USER node

EXPOSE 3000

CMD ["wait-for-it", "db:5432", "--", "node", "dist/main"]
