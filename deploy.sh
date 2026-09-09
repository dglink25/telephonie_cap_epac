#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
#  CAP-EPAC Téléphonie — Script de déploiement universel
#
#  Usage : bash deploy.sh <IP_SERVEUR> [options]
#
#  Exemples :
#    bash deploy.sh 192.168.10.139              # déploiement complet
#    bash deploy.sh 192.168.10.139 --no-apk     # sans rebuild APK
#    bash deploy.sh 192.168.10.139 --no-docker  # config seulement
#    bash deploy.sh 192.168.10.139 --apk-only   # rebuild APK uniquement
#
#  Ce script met à jour TOUS les fichiers de configuration automatiquement.
#  Plus besoin d'éditer quoi que ce soit manuellement.
# ═══════════════════════════════════════════════════════════════════════════════

set -e

# ── Couleurs ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

ok()      { echo -e "${GREEN}[✓]${NC} $1"; }
info()    { echo -e "${BLUE}[→]${NC} $1"; }
warn()    { echo -e "${YELLOW}[!]${NC} $1"; }
error()   { echo -e "${RED}[✗]${NC} $1"; exit 1; }
section() { echo -e "\n${BOLD}${BLUE}══ $1 ══${NC}"; }

# ── Répertoire du projet ──────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"
PROJECT_DIR="$SCRIPT_DIR"

# ── Arguments ─────────────────────────────────────────────────────────────────
SERVER_IP="${1:-}"
BUILD_APK=true
START_DOCKER=true
APK_ONLY=false

for arg in "$@"; do
  case "$arg" in
    --no-apk)     BUILD_APK=false ;;
    --no-docker)  START_DOCKER=false ;;
    --apk-only)   APK_ONLY=true; START_DOCKER=false ;;
    --help|-h)
      echo "Usage: bash deploy.sh <IP_SERVEUR> [--no-apk] [--no-docker] [--apk-only]"
      echo ""
      echo "  <IP_SERVEUR>  IP LAN du serveur (ex: 192.168.10.139)"
      echo "  --no-apk      Ne pas rebuilder l'APK mobile"
      echo "  --no-docker   Mettre à jour les configs sans démarrer Docker"
      echo "  --apk-only    Rebuilder uniquement l'APK (sans toucher au serveur)"
      exit 0
      ;;
  esac
done

# ── Validation de l'IP ────────────────────────────────────────────────────────
if [ -z "$SERVER_IP" ]; then
  warn "Aucune IP fournie — détection automatique..."
  SERVER_IP=$(ip route get 1.1.1.1 2>/dev/null | grep -oP 'src \K\S+' | head -1)
  if [ -z "$SERVER_IP" ]; then
    error "Impossible de détecter l'IP. Précisez-la : bash deploy.sh 192.168.x.x"
  fi
  info "IP détectée : $SERVER_IP"
fi

if ! echo "$SERVER_IP" | grep -qE '^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$'; then
  error "IP invalide : $SERVER_IP"
fi

# ── Ports (configurables via arguments ou valeurs par défaut) ─────────────────
HTTPS_PORT="${HTTPS_PORT:-19443}"
HTTP_PORT="${HTTP_PORT:-19080}"
MOBILE_PORT="${MOBILE_PORT:-18282}"
JITSI_PORT="${JITSI_PORT:-19444}"

# ── Bannière ──────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${CYAN}"
echo "  ╔════════════════════════════════════════════════╗"
echo "  ║    CAP-EPAC Téléphonie — Déploiement          ║"
echo "  ╚════════════════════════════════════════════════╝"
echo -e "${NC}"
echo -e "  Serveur      : ${CYAN}${SERVER_IP}${NC}"
echo -e "  HTTPS        : ${CYAN}:${HTTPS_PORT}${NC}"
echo -e "  HTTP         : ${CYAN}:${HTTP_PORT}${NC}"
echo -e "  Mobile API   : ${CYAN}:${MOBILE_PORT}${NC}"
echo -e "  Jitsi        : ${CYAN}:${JITSI_PORT}${NC}"
echo -e "  Build APK    : ${BUILD_APK}"
echo ""

# ══════════════════════════════════════════════════════════════════════════════
# 1. MISE À JOUR DU .ENV PRINCIPAL
# ══════════════════════════════════════════════════════════════════════════════
section "1/6 — Mise à jour .env"

# Créer le .env s'il n'existe pas
if [ ! -f ".env" ]; then
  info "Création du fichier .env..."
fi

# Mettre à jour ou créer chaque variable
update_env() {
  local KEY="$1" VAL="$2"
  if grep -q "^${KEY}=" .env 2>/dev/null; then
    sed -i "s|^${KEY}=.*|${KEY}=${VAL}|g" .env
  else
    echo "${KEY}=${VAL}" >> .env
  fi
}

# Créer un .env complet si absent
if [ ! -f ".env" ]; then
cat > .env << ENVEOF
NODE_ENV=production
SERVER_LAN_IP=${SERVER_IP}
CORS_ORIGIN=https://${SERVER_IP}:${HTTPS_PORT}
HTTP_PORT=${HTTP_PORT}
HTTPS_PORT=${HTTPS_PORT}
MOBILE_PORT=${MOBILE_PORT}
MYSQL_ROOT_PASSWORD=CapEpac@Root2025
MYSQL_DATABASE=db_telephonie_cap_epac
MYSQL_USER=cap_epac_user
MYSQL_PASSWORD=CapEpac@2025
REDIS_PASSWORD=CapEpacRedis2025
JWT_SECRET=abNgsP6YAaxeFPkjcY5CNQXQulGabKbMkdHdcUkmmfcGg0kMKSA4OeCohypsASNhfmWZEDUtyiXwldBtahlZ0A==
JWT_REFRESH_SECRET=dcS4SicATkXy6DU5CdnmiyesfgZ64f/3a2ZsF8jz9Nh+FQHh8Qcoe1aQKOe7dKVGCpB6p+KUcPZYDXZumq2aGQ==
WEBHOOK_SECRET=CapEpacWebhook@Secret2025
JITSI_URL=https://${SERVER_IP}:${JITSI_PORT}
JITSI_APP_ID=cap-epac
VITE_API_URL=https://${SERVER_IP}:${HTTPS_PORT}/api
VITE_SOCKET_URL=https://${SERVER_IP}:${HTTPS_PORT}
ENVEOF
else
  update_env "SERVER_LAN_IP"  "$SERVER_IP"
  update_env "CORS_ORIGIN"    "https://${SERVER_IP}:${HTTPS_PORT},https://${SERVER_IP}"
  update_env "HTTP_PORT"      "$HTTP_PORT"
  update_env "HTTPS_PORT"     "$HTTPS_PORT"
  update_env "MOBILE_PORT"    "$MOBILE_PORT"
  update_env "MYSQL_PORT"     "${MYSQL_PORT:-13307}"
  update_env "JITSI_URL"      "https://${SERVER_IP}:${JITSI_PORT}"
  update_env "VITE_API_URL"   "https://${SERVER_IP}:${HTTPS_PORT}/api"
  update_env "VITE_SOCKET_URL" "https://${SERVER_IP}:${HTTPS_PORT}"
fi

ok ".env mis à jour → SERVER_LAN_IP=${SERVER_IP}"

# ══════════════════════════════════════════════════════════════════════════════
# 2. MISE À JOUR FRONTEND
# ══════════════════════════════════════════════════════════════════════════════
section "2/6 — Mise à jour Frontend"

cat > frontend/.env << EOF
# Généré automatiquement par deploy.sh — NE PAS ÉDITER MANUELLEMENT
VITE_API_URL=https://${SERVER_IP}:${HTTPS_PORT}/api
VITE_SOCKET_URL=https://${SERVER_IP}:${HTTPS_PORT}
VITE_COTURN_HOST=${SERVER_IP}
VITE_JITSI_URL=https://${SERVER_IP}:${JITSI_PORT}
EOF

cat > frontend/.env.production << EOF
# Généré automatiquement par deploy.sh — NE PAS ÉDITER MANUELLEMENT
VITE_API_URL=https://${SERVER_IP}:${HTTPS_PORT}/api
VITE_SOCKET_URL=https://${SERVER_IP}:${HTTPS_PORT}
VITE_COTURN_HOST=${SERVER_IP}
VITE_JITSI_URL=https://${SERVER_IP}:${JITSI_PORT}
EOF

ok "frontend/.env → ${SERVER_IP}:${HTTPS_PORT}"

# ── Build Vite automatique ────────────────────────────────────────
info "Build du frontend avec la nouvelle IP..."
if [ -d "frontend/node_modules" ]; then
  npm run build --prefix frontend 2>&1 | tail -3
  ok "Frontend buildé avec IP ${SERVER_IP}"
else
  warn "node_modules absent — installer d'abord : npm install --prefix frontend"
  warn "Le build Docker utilisera le dist/ existant s'il est présent"
fi

# ══════════════════════════════════════════════════════════════════════════════
# 3. MISE À JOUR MOBILE (config.ts, webrtc.ts, network_security_config.xml)
# ══════════════════════════════════════════════════════════════════════════════
section "3/6 — Mise à jour Mobile"

# config.ts — URL API mobile
cat > mobile/src/config.ts << EOF
// Généré automatiquement par deploy.sh — NE PAS ÉDITER MANUELLEMENT
// Pour changer le serveur : bash deploy.sh <nouvelle_ip>

export const SERVER_BASE = 'http://${SERVER_IP}:${MOBILE_PORT}';
export const MEDIA_PORT = '';

export function getMediaUrl(path: string): string {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return \`\${SERVER_BASE}\${path.startsWith('/') ? path : '/' + path}\`;
}
EOF
ok "mobile/src/config.ts → http://${SERVER_IP}:${MOBILE_PORT}"
# webrtc.ts — TURN/STUN servers
WEBRTC_FILE="mobile/src/services/webrtc.ts"
if [ -f "$WEBRTC_FILE" ]; then
  # Remplacer les IPs TURN/STUN par l'IP actuelle du serveur
  sed -i "s|turn:[0-9.]*:[0-9]*\?transport=udp|turn:${SERVER_IP}:3478?transport=udp|g" "$WEBRTC_FILE"
  sed -i "s|turn:[0-9.]*:[0-9]*\?transport=tcp|turn:${SERVER_IP}:3478?transport=tcp|g" "$WEBRTC_FILE"
  sed -i "s|stun:[0-9.]*:[0-9]*|stun:${SERVER_IP}:3478|g" "$WEBRTC_FILE"
  ok "mobile/src/services/webrtc.ts → TURN/STUN : ${SERVER_IP}:3478"
fi

# network_security_config.xml — ajouter l'IP si absente
NET_SEC="mobile/android/app/src/main/res/xml/network_security_config.xml"
if [ -f "$NET_SEC" ]; then
  if ! grep -q "$SERVER_IP" "$NET_SEC"; then
    sed -i "/<domain-config cleartextTrafficPermitted=\"true\">/a\\        <domain includeSubdomains=\"true\">${SERVER_IP}</domain>" "$NET_SEC"
    ok "network_security_config.xml → IP ${SERVER_IP} ajoutée"
  else
    ok "network_security_config.xml → IP ${SERVER_IP} déjà présente"
  fi
fi

# ══════════════════════════════════════════════════════════════════════════════
# 4. MISE À JOUR COTURN
# ══════════════════════════════════════════════════════════════════════════════
section "4/6 — Mise à jour Coturn"

COTURN_CONF="nginx/coturn.conf"
if [ -f "$COTURN_CONF" ]; then
  sed -i "s|^relay-ip=.*|relay-ip=${SERVER_IP}|g"     "$COTURN_CONF"
  sed -i "s|^external-ip=.*|external-ip=${SERVER_IP}|g" "$COTURN_CONF"
  # Mettre à jour la plage d'IPs autorisées
  SUBNET=$(echo "$SERVER_IP" | sed 's/\.[0-9]*$/.0/')
  sed -i "s|^allowed-peer-ip=[0-9.]*-[0-9.]*$|allowed-peer-ip=${SUBNET}-${SERVER_IP%.*}.255|g" "$COTURN_CONF"
  ok "nginx/coturn.conf → relay-ip=${SERVER_IP}"
fi

# ══════════════════════════════════════════════════════════════════════════════
# 5. CERTIFICATS SSL
# ══════════════════════════════════════════════════════════════════════════════
section "5/6 — Certificats SSL"

mkdir -p nginx/ssl

# Régénérer si l'IP a changé ou si les certs n'existent pas
REGEN=false
if [ ! -f "nginx/ssl/cert.pem" ]; then
  REGEN=true
elif ! openssl x509 -in nginx/ssl/cert.pem -text 2>/dev/null | grep -q "$SERVER_IP"; then
  warn "Certificat SSL ne correspond pas à l'IP ${SERVER_IP} — régénération..."
  REGEN=true
fi

if [ "$REGEN" = true ]; then
  if [ -f "scripts/gen-ssl.sh" ]; then
    bash scripts/gen-ssl.sh "$SERVER_IP"
  else
    # Génération directe si le script n'existe pas
    openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
      -keyout nginx/ssl/key.pem \
      -out    nginx/ssl/cert.pem \
      -subj   "/CN=${SERVER_IP}/O=CAP-EPAC/C=BJ" \
      -addext "subjectAltName=IP:${SERVER_IP},DNS:localhost" 2>/dev/null
  fi
  ok "Certificats SSL générés pour ${SERVER_IP}"
else
  ok "Certificats SSL valides pour ${SERVER_IP}"
fi

# ══════════════════════════════════════════════════════════════════════════════
# 6A. DÉMARRAGE DOCKER
# ══════════════════════════════════════════════════════════════════════════════
if [ "$START_DOCKER" = true ] && [ "$APK_ONLY" = false ]; then
  section "6/6 — Démarrage Docker"

  command -v docker >/dev/null 2>&1 || error "Docker non installé"

  # Vérifier les conflits de ports
  for PORT in $HTTP_PORT $HTTPS_PORT $MOBILE_PORT; do
    if ss -tlnp 2>/dev/null | grep -q ":${PORT} "; then
      warn "Port ${PORT} occupé — vérifiez qu'aucun autre service ne l'utilise"
    fi
  done

  # Rebuilder le frontend obligatoirement si l'IP a changé
  CURRENT_IP=$(grep '^SERVER_LAN_IP=' .env 2>/dev/null | cut -d'=' -f2)
  CACHED_IP=$(docker inspect telephonie-cap-epac-frontend 2>/dev/null | \
    grep -o 'VITE_API_URL=[^"]*' | head -1 | grep -oP '(?<=https://)[^:/]+' | head -1)

  if [ "$CACHED_IP" != "$CURRENT_IP" ] || [ "$CACHED_IP" = "" ]; then
    info "IP changée ($CACHED_IP → $CURRENT_IP) — rebuild complet obligatoire..."
    docker compose build --no-cache frontend
    docker compose up -d --force-recreate
  else
    info "Même IP — démarrage sans rebuild..."
    docker compose up -d
  fi

  # Attendre la disponibilité
  info "Attente du démarrage (jusqu'à 120s)..."
  COUNT=0
  until curl -sk "https://${SERVER_IP}:${HTTPS_PORT}/health" > /dev/null 2>&1; do
    COUNT=$((COUNT + 1))
    [ $COUNT -ge 24 ] && { warn "Timeout — vérifiez : docker compose logs"; break; }
    printf "."; sleep 5
  done
  echo ""
  ok "Serveur opérationnel"
fi

# ══════════════════════════════════════════════════════════════════════════════
# 6B. BUILD APK MOBILE
# ══════════════════════════════════════════════════════════════════════════════
if [ "$BUILD_APK" = true ]; then
  section "Build APK Mobile"

  if [ ! -d "mobile/android" ]; then
    warn "Dossier mobile/android absent — APK ignoré"
  else
    # Augmenter la limite inotify
    if [ -w /proc/sys/fs/inotify/max_user_watches ]; then
      echo 524288 > /proc/sys/fs/inotify/max_user_watches 2>/dev/null || \
        sudo sysctl fs.inotify.max_user_watches=524288 2>/dev/null || true
    fi

    info "Build APK Release..."
    cd mobile/android
    if ./gradlew assembleRelease --no-daemon 2>&1 | tail -5; then
      cd "$PROJECT_DIR"
      APK_PATH="mobile/android/app/build/outputs/apk/release/app-release.apk"
      if [ -f "$APK_PATH" ]; then
        APK_SIZE=$(du -sh "$APK_PATH" | cut -f1)
        ok "APK généré : $APK_PATH ($APK_SIZE)"
      fi
    else
      cd "$PROJECT_DIR"
      warn "Échec du build APK — vérifiez les logs Gradle"
    fi
  fi
fi

# ══════════════════════════════════════════════════════════════════════════════
# RÉSUMÉ FINAL
# ══════════════════════════════════════════════════════════════════════════════
echo ""
echo -e "${GREEN}${BOLD}"
echo "  ╔══════════════════════════════════════════════════════════╗"
echo "  ║          Déploiement terminé avec succès !              ║"
echo "  ╠══════════════════════════════════════════════════════════╣"
echo -e "  ║${NC}  Serveur IP    : ${CYAN}${SERVER_IP}${NC}"
echo -e "  ║  Application  : ${CYAN}https://${SERVER_IP}:${HTTPS_PORT}${NC}"
echo -e "  ║  API mobile   : ${CYAN}http://${SERVER_IP}:${MOBILE_PORT}${NC}"
echo -e "  ║  Jitsi        : ${CYAN}https://${SERVER_IP}:${JITSI_PORT}${NC}"
if [ "$BUILD_APK" = true ] && [ -f "mobile/android/app/build/outputs/apk/release/app-release.apk" ]; then
echo -e "  ║  APK mobile   : ${CYAN}mobile/android/.../app-release.apk${NC}"
fi
echo -e "${GREEN}${BOLD}  ╠══════════════════════════════════════════════════════════╣"
echo "  ║  Identifiants : admin / Admin@CapEpac2025              ║"
echo "  ╚══════════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo -e "  Logs    : ${YELLOW}docker compose logs -f${NC}"
echo -e "  Arrêt   : ${YELLOW}docker compose down${NC}"
echo ""
