# Backend Rufus Chatbot - Debian + Chromium para WPPConnect (Railway / App Runner / Cloud Run)
FROM node:20-bookworm-slim

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
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# Evita download do Chromium pelo Puppeteer; usamos o do sistema
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .
RUN npm run build

# Usuário não-root (recomendado; --no-sandbox já está nos browserArgs do app)
RUN chown -R node:node /usr/src/app
USER node

EXPOSE 3000

CMD ["node", "dist/main"]
