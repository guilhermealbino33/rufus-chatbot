# =============================================================================
# Stage 1: builder (context = raiz do monorepo, railway.json: "context": ".")
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
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

RUN npm ci --ignore-scripts

COPY . .

# Build do backend
RUN cd backend && npm run build

# Remove devDependencies para reduzir tamanho da imagem de produção
RUN npm prune --omit=dev --ignore-scripts && npm cache clean --force

# =============================================================================
# Stage 2: produção (imagem final enxuta)
# =============================================================================
FROM node:20-bookworm-slim AS runner

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

# Artefatos de produção: dist do backend + package.json + node_modules já podado
COPY --from=builder /usr/src/app/backend/dist ./dist
COPY --from=builder /usr/src/app/backend/package.json ./package.json
COPY --from=builder /usr/src/app/node_modules ./node_modules

RUN mkdir -p /usr/src/app/wpp-sessions && chown -R node:node /usr/src/app
USER node

EXPOSE 3000

CMD ["node", "dist/main"]
