# ── Étape 1 : Build React ────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

# Copier public/ en premier pour que Vite inclue les assets (sons, logo)
COPY public/ ./public/
COPY . .

ARG VITE_API_URL=/api
ARG VITE_SOCKET_URL=""
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_SOCKET_URL=$VITE_SOCKET_URL

RUN npm run build

# ── Étape 2 : Serveur Nginx ───────────────────────────────────────
FROM nginx:1.26-alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx-frontend.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
