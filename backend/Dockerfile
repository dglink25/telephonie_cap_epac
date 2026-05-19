
FROM node:22-alpine

# Dépendances système pour Mediasoup (compilation native)
RUN apk add --no-cache \
    python3 \
    py3-pip \
    make \
    g++ \
    linux-headers \
    curl \
    openssl \
    bash

WORKDIR /app

# Copie des dépendances
COPY package*.json ./
RUN npm ci --omit=dev

# Copie du code source
COPY src/ ./src/

# Dossiers persistants
RUN mkdir -p uploads logs

# Utilisateur non-root
RUN addgroup -g 1001 appgroup && \
    adduser -u 1001 -G appgroup -s /bin/sh -D appuser && \
    chown -R appuser:appgroup /app

USER appuser

EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

CMD ["node", "src/server.js"]
