#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

info()    { echo -e "${GREEN}[INFO]${NC}  $1"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $1"; }
error()   { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }
section() { echo -e "\n${BLUE}══ $1 ══${NC}"; }

cd "$PROJECT_DIR"

# ── Vérifications préalables ──────────────────────────────────
section "Vérifications"

command -v docker    >/dev/null 2>&1 || error "Docker n'est pas installé"
command -v docker-compose >/dev/null 2>&1 || \
  docker compose version >/dev/null 2>&1 || error "Docker Compose n'est pas disponible"
command -v openssl   >/dev/null 2>&1 || error "OpenSSL n'est pas installé"

info "Docker : $(docker --version)"
info "Docker Compose disponible"

# ── Fichier .env ──────────────────────────────────────────────
section "Configuration"

if [ ! -f ".env" ]; then
    warn ".env introuvable — copie depuis .env.example"
    cp .env .env.bak 2>/dev/null || true
fi

# Détecter l'IP LAN automatiquement
DETECTED_IP=$(ip route get 1.1.1.1 2>/dev/null | grep -oP 'src \K\S+' | head -1)
if [ -n "$DETECTED_IP" ]; then
    info "IP LAN détectée : $DETECTED_IP"
    # Mettre à jour le .env si l'IP est encore la valeur par défaut
    if grep -q "SERVER_LAN_IP=192.168.1.10" .env 2>/dev/null; then
        sed -i "s|SERVER_LAN_IP=192.168.1.10|SERVER_LAN_IP=$DETECTED_IP|g" .env
        info "IP mise à jour dans .env"
    fi
fi

# Charger les ports depuis .env (avec valeurs par défaut)
HTTPS_PORT=$(grep '^HTTPS_PORT=' .env 2>/dev/null | cut -d'=' -f2 | tr -d ' ' || echo "9443")
HTTP_PORT=$(grep '^HTTP_PORT='   .env 2>/dev/null | cut -d'=' -f2 | tr -d ' ' || echo "9080")
MOBILE_PORT=$(grep '^MOBILE_PORT=' .env 2>/dev/null | cut -d'=' -f2 | tr -d ' ' || echo "8282")

# Valeurs par défaut si vides
HTTPS_PORT=${HTTPS_PORT:-9443}
HTTP_PORT=${HTTP_PORT:-9080}
MOBILE_PORT=${MOBILE_PORT:-8282}

info "Ports → HTTPS:${HTTPS_PORT}  HTTP:${HTTP_PORT}  Mobile:${MOBILE_PORT}"

# Vérifier les conflits de ports
for PORT in $HTTP_PORT $HTTPS_PORT $MOBILE_PORT; do
    if ss -tlnp 2>/dev/null | grep -q ":${PORT} " || \
       netstat -tlnp 2>/dev/null | grep -q ":${PORT} "; then
        warn "Port ${PORT} déjà utilisé — vérifiez les conflits dans .env"
    fi
done

# ── Certificats SSL ───────────────────────────────────────────
section "Certificats SSL"

if [ ! -f "nginx/ssl/cert.pem" ] || [ ! -f "nginx/ssl/key.pem" ]; then
    info "Génération des certificats SSL auto-signés..."
    bash scripts/gen-ssl.sh "$DETECTED_IP"
else
    info "Certificats SSL existants détectés"
fi

# ── Démarrage Docker Compose ──────────────────────────────────
section "Démarrage des services"

MODE="${1:-start}"

case "$MODE" in
  start|"")
    info "Démarrage en mode production..."
    if docker image inspect telephonie-cap-epac-backend:latest >/dev/null 2>&1 && \
       docker image inspect telephonie-cap-epac-frontend:latest >/dev/null 2>&1; then
      info "Images existantes — démarrage rapide sans rebuild"
      info "  → Pour forcer le rebuild : bash scripts/start.sh build"
      docker compose up -d
    else
      info "Images absentes — premier build (peut prendre quelques minutes)..."
      docker compose up -d --build
    fi
    ;;
  build)
    info "Rebuild forcé des images et redémarrage..."
    docker compose up -d --build
    ;;
  dev)
    info "Démarrage en mode développement..."
    docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
    ;;
  restart)
    info "Redémarrage des services..."
    docker compose restart
    ;;
  stop)
    info "Arrêt des services..."
    docker compose down
    exit 0
    ;;
  logs)
    docker compose logs -f
    exit 0
    ;;
  *)
    error "Mode inconnu: $MODE. Utiliser: start | build | restart | stop | logs"
    ;;
esac

# ── Attendre la disponibilité ────────────────────────────────
section "Vérification de la disponibilité"

SERVER_IP="${DETECTED_IP:-192.168.1.10}"
info "Attente du démarrage complet (jusqu'à 250s)..."
MAX=50; COUNT=0
until curl -sk "https://${SERVER_IP}:${HTTPS_PORT}/health" > /dev/null 2>&1; do
    COUNT=$((COUNT + 1))
    if [ $COUNT -ge $MAX ]; then
        warn "Timeout — vérifiez les logs: docker compose logs"
        break
    fi
    printf "."
    sleep 5
done
echo ""

# ── Résumé ───────────────────────────────────────────────────
echo ""

echo ""
echo -e "  Logs    : ${YELLOW}docker compose logs -f${NC}"
echo -e "  Arrêt   : ${YELLOW}bash scripts/start.sh stop${NC}"
echo -e "  Rebuild : ${YELLOW}bash scripts/start.sh build${NC}"
echo ""
