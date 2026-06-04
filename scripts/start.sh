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
        sed -i "s|CORS_ORIGIN=https://192.168.1.10|CORS_ORIGIN=https://$DETECTED_IP|g" .env
        sed -i "s|VITE_API_URL=https://192.168.1.10|VITE_API_URL=https://$DETECTED_IP|g" .env
        sed -i "s|VITE_SOCKET_URL=https://192.168.1.10|VITE_SOCKET_URL=https://$DETECTED_IP|g" .env
        info "IP mise à jour dans .env"
    fi
fi

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
    # Rebuilder uniquement si les images n'existent pas encore
    if docker image inspect telephonie-cap-epac-backend:latest >/dev/null 2>&1 && \
       docker image inspect telephonie-cap-epac-frontend:latest >/dev/null 2>&1; then
      info "Images existantes — démarrage rapide sans rebuild"
      info "  → Pour forcer le rebuild après un changement de code : bash scripts/start.sh build"
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
    error "Mode inconnu: $MODE. Utiliser: start | dev | restart | stop | logs"
    ;;
esac

# ── Attendre la disponibilité ────────────────────────────────
section "Vérification de la disponibilité"

info "Attente du démarrage complet (jusqu'à 240s)..."
MAX=50; COUNT=0
until curl -sk "https://localhost/health" > /dev/null 2>&1; do
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
SERVER_IP="${DETECTED_IP:-192.168.1.10}"

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║           Téléphonie CAP-EPAC est en ligne !        ║${NC}"
echo -e "${GREEN}╠══════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║${NC}  Application  : https://$SERVER_IP             ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  API Docs     : https://$SERVER_IP/api/docs    ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  Admin        : admin / Admin@CapEpac2025       ${GREEN}║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  Logs    : ${YELLOW}docker compose logs -f${NC}"
echo -e "  Arrêt   : ${YELLOW}bash scripts/start.sh stop${NC}"
echo -e "  Rebuild : ${YELLOW}bash scripts/start.sh build${NC}"
echo ""
