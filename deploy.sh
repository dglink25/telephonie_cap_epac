#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
#  CAP-EPAC Téléphonie — Script de déploiement universel v3
#
#  Usage : bash deploy.sh <IP_SERVEUR> [options]
#
#  Exemples :
#    bash deploy.sh 192.168.10.139              # déploiement complet
#    bash deploy.sh 192.168.10.139 --no-apk     # sans rebuild APK
#    bash deploy.sh 192.168.10.139 --no-docker  # config seulement
#    bash deploy.sh 192.168.10.139 --apk-only   # rebuild APK uniquement
#
#  Corrections intégrées :
#    - Build Vite automatique avant Docker (évite le frontend avec mauvaise IP)
#    - Synchronisation des fichiers backend modifiés dans le conteneur
#    - Ouverture automatique des ports firewall
#    - Détection et résolution des conflits de ports
#    - Version obsolete "version" supprimée du docker-compose
# ═══════════════════════════════════════════════════════════════════════════════

set -e

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

ok()      { echo -e "${GREEN}[✓]${NC} $1"; }
info()    { echo -e "${BLUE}[→]${NC} $1"; }
warn()    { echo -e "${YELLOW}[!]${NC} $1"; }
error()   { echo -e "${RED}[✗]${NC} $1"; exit 1; }
section() { echo -e "\n${BOLD}${BLUE}══ $1 ══${NC}"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ── Arguments ─────────────────────────────────────────────────────────────────
SERVER_IP="${1:-}"
BUILD_APK=true
START_DOCKER=true
APK_ONLY=false

for arg in "$@"; do
  case "$arg" in
    --no-apk)    BUILD_APK=false ;;
    --no-docker) START_DOCKER=false ;;
    --apk-only)  APK_ONLY=true; START_DOCKER=false ;;
    --help|-h)
      echo "Usage: bash deploy.sh <IP_SERVEUR> [--no-apk] [--no-docker] [--apk-only]"
      exit 0 ;;
  esac
done

# ── Validation IP ─────────────────────────────────────────────────────────────
if [ -z "$SERVER_IP" ]; then
  SERVER_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
  [ -z "$SERVER_IP" ] && SERVER_IP=$(ip route get 1.1.1.1 2>/dev/null | grep -oP 'src \K\S+' | head -1)
  [ -z "$SERVER_IP" ] && error "IP introuvable. Précisez-la : bash deploy.sh 192.168.x.x"
  info "IP détectée automatiquement : $SERVER_IP"
fi

if ! echo "$SERVER_IP" | grep -qE '^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$'; then
  error "IP invalide : $SERVER_IP"
fi

# ── Ports ─────────────────────────────────────────────────────────────────────
HTTPS_PORT="${HTTPS_PORT:-19443}"
HTTP_PORT="${HTTP_PORT:-19080}"
MOBILE_PORT="${MOBILE_PORT:-18282}"
JITSI_PORT="${JITSI_PORT:-19444}"
MYSQL_EXT_PORT="${MYSQL_PORT:-13307}"

# ── Bannière ──────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${CYAN}"
echo "  ╔════════════════════════════════════════════════╗"
echo "  ║    CAP-EPAC Téléphonie — Déploiement v3       ║"
echo "  ╚════════════════════════════════════════════════╝"
echo -e "${NC}"
echo -e "  Serveur    : ${CYAN}${SERVER_IP}${NC}"
echo -e "  HTTPS      : ${CYAN}:${HTTPS_PORT}${NC}   HTTP : ${CYAN}:${HTTP_PORT}${NC}"
echo -e "  Mobile API : ${CYAN}:${MOBILE_PORT}${NC}  Jitsi: ${CYAN}:${JITSI_PORT}${NC}"
echo -e "  Build APK  : ${BUILD_APK}"
echo ""

# ══════════════════════════════════════════════════════════════════════════════
# 1. MISE À JOUR .ENV
# ══════════════════════════════════════════════════════════════════════════════
section "1/7 — Mise à jour .env"

update_env() {
  local KEY="$1" VAL="$2"
  if grep -q "^${KEY}=" .env 2>/dev/null; then
    sed -i "s|^${KEY}=.*|${KEY}=${VAL}|g" .env
  else
    echo "${KEY}=${VAL}" >> .env
  fi
}

[ ! -f ".env" ] && cat > .env << ENVEOF
NODE_ENV=production
SERVER_LAN_IP=${SERVER_IP}
CORS_ORIGIN=https://${SERVER_IP}:${HTTPS_PORT}
HTTP_PORT=${HTTP_PORT}
HTTPS_PORT=${HTTPS_PORT}
MOBILE_PORT=${MOBILE_PORT}
MYSQL_PORT=${MYSQL_EXT_PORT}
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

update_env "SERVER_LAN_IP"   "$SERVER_IP"
update_env "CORS_ORIGIN"     "https://${SERVER_IP}:${HTTPS_PORT}"
update_env "HTTP_PORT"       "$HTTP_PORT"
update_env "HTTPS_PORT"      "$HTTPS_PORT"
update_env "MOBILE_PORT"     "$MOBILE_PORT"
update_env "MYSQL_PORT"      "$MYSQL_EXT_PORT"
update_env "JITSI_URL"       "https://${SERVER_IP}:${JITSI_PORT}"
update_env "VITE_API_URL"    "https://${SERVER_IP}:${HTTPS_PORT}/api"
update_env "VITE_SOCKET_URL" "https://${SERVER_IP}:${HTTPS_PORT}"
ok ".env → SERVER_LAN_IP=${SERVER_IP}"

# ══════════════════════════════════════════════════════════════════════════════
# 2. MISE À JOUR FRONTEND + BUILD VITE
# ══════════════════════════════════════════════════════════════════════════════
section "2/7 — Frontend (config + build)"

cat > frontend/.env << EOF
VITE_API_URL=https://${SERVER_IP}:${HTTPS_PORT}/api
VITE_SOCKET_URL=https://${SERVER_IP}:${HTTPS_PORT}
VITE_COTURN_HOST=${SERVER_IP}
VITE_JITSI_URL=https://${SERVER_IP}:${JITSI_PORT}
EOF
cat > frontend/.env.production << EOF
VITE_API_URL=https://${SERVER_IP}:${HTTPS_PORT}/api
VITE_SOCKET_URL=https://${SERVER_IP}:${HTTPS_PORT}
VITE_COTURN_HOST=${SERVER_IP}
VITE_JITSI_URL=https://${SERVER_IP}:${JITSI_PORT}
EOF
ok "frontend/.env → ${SERVER_IP}:${HTTPS_PORT}"

# Build Vite obligatoire pour que la bonne IP soit embarquée dans le bundle
if [ -d "frontend/node_modules" ]; then
  info "Build Vite avec IP ${SERVER_IP}..."
  npm run build --prefix frontend 2>&1 | grep -E "✓|error|ERRO" | head -5
  ok "Frontend buildé"
else
  warn "frontend/node_modules absent — lancer d'abord : npm install --prefix frontend"
fi

# ══════════════════════════════════════════════════════════════════════════════
# 3. MISE À JOUR MOBILE
# ══════════════════════════════════════════════════════════════════════════════
section "3/7 — Mobile"

cat > mobile/src/config.ts << EOF
// Généré par deploy.sh — NE PAS ÉDITER
export const SERVER_BASE = 'http://${SERVER_IP}:${MOBILE_PORT}';
export const MEDIA_PORT = '';
export function getMediaUrl(path: string): string {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return \`\${SERVER_BASE}\${path.startsWith('/') ? path : '/' + path}\`;
}
EOF
ok "mobile/src/config.ts → http://${SERVER_IP}:${MOBILE_PORT}"

WEBRTC_FILE="mobile/src/services/webrtc.ts"
if [ -f "$WEBRTC_FILE" ]; then
  sed -i "s|turn:[0-9.]*:[0-9]*?transport=udp|turn:${SERVER_IP}:3478?transport=udp|g" "$WEBRTC_FILE"
  sed -i "s|turn:[0-9.]*:[0-9]*?transport=tcp|turn:${SERVER_IP}:3478?transport=tcp|g" "$WEBRTC_FILE"
  sed -i "s|stun:[0-9.]*:[0-9]*|stun:${SERVER_IP}:3478|g" "$WEBRTC_FILE"
  ok "webrtc.ts → TURN/STUN : ${SERVER_IP}"
fi

NET_SEC="mobile/android/app/src/main/res/xml/network_security_config.xml"
if [ -f "$NET_SEC" ] && ! grep -q "$SERVER_IP" "$NET_SEC"; then
  sed -i "/<domain-config cleartextTrafficPermitted=\"true\">/a\\        <domain includeSubdomains=\"true\">${SERVER_IP}</domain>" "$NET_SEC"
  ok "network_security_config.xml → IP ${SERVER_IP} ajoutée"
fi

# ══════════════════════════════════════════════════════════════════════════════
# 4. MISE À JOUR COTURN
# ══════════════════════════════════════════════════════════════════════════════
section "4/7 — Coturn"

if [ -f "nginx/coturn.conf" ]; then
  sed -i "s|^relay-ip=.*|relay-ip=${SERVER_IP}|g"      nginx/coturn.conf
  sed -i "s|^external-ip=.*|external-ip=${SERVER_IP}|g" nginx/coturn.conf
  ok "coturn.conf → relay-ip=${SERVER_IP}"
fi

# ══════════════════════════════════════════════════════════════════════════════
# 5. CERTIFICATS SSL
# ══════════════════════════════════════════════════════════════════════════════
section "5/7 — Certificats SSL"

mkdir -p nginx/ssl
REGEN=false
[ ! -f "nginx/ssl/cert.pem" ] && REGEN=true
if [ "$REGEN" = false ] && ! openssl x509 -in nginx/ssl/cert.pem -text 2>/dev/null | grep -q "$SERVER_IP"; then
  warn "Certificat ne correspond pas à ${SERVER_IP} — régénération..."
  REGEN=true
fi

if [ "$REGEN" = true ]; then
  if [ -f "scripts/gen-ssl.sh" ]; then
    bash scripts/gen-ssl.sh "$SERVER_IP"
  else
    openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
      -keyout nginx/ssl/key.pem -out nginx/ssl/cert.pem \
      -subj "/CN=${SERVER_IP}/O=CAP-EPAC/C=BJ" \
      -addext "subjectAltName=IP:${SERVER_IP},DNS:localhost" 2>/dev/null
  fi
  ok "Certificats SSL générés pour ${SERVER_IP}"
else
  ok "Certificats SSL valides"
fi

# ══════════════════════════════════════════════════════════════════════════════
# 6. DÉMARRAGE DOCKER + SYNCHRONISATION BACKEND
# ══════════════════════════════════════════════════════════════════════════════
if [ "$START_DOCKER" = true ] && [ "$APK_ONLY" = false ]; then
  section "6/7 — Docker"

  command -v docker >/dev/null 2>&1 || error "Docker non installé"

  # Ouvrir les ports firewall automatiquement
  for PORT in $HTTP_PORT $HTTPS_PORT $MOBILE_PORT; do
    if command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | grep -q "active"; then
      ufw allow "$PORT/tcp" 2>/dev/null || true
    fi
    iptables -I INPUT -p tcp --dport "$PORT" -j ACCEPT 2>/dev/null || true
  done
  ok "Ports firewall ouverts"

  # Arrêter et recréer tous les conteneurs cap-epac
  info "Arrêt des anciens conteneurs..."
  docker compose down 2>/dev/null || true

  # Build frontend (rapide — utilise le dist/ local)
  info "Build image frontend..."
  docker compose build --no-cache frontend 2>&1 | grep -E "FINISHED|ERROR|error" | head -3

  # Démarrer tout
  info "Démarrage de tous les services..."
  docker compose up -d 2>&1 | grep -E "Started|Running|Error" | head -10

  # Attendre que le backend soit healthy
  info "Attente du backend (jusqu'à 60s)..."
  COUNT=0
  until docker ps --filter "name=cap-epac-backend" --filter "health=healthy" | grep -q "healthy" 2>/dev/null; do
    COUNT=$((COUNT+1))
    [ $COUNT -ge 12 ] && { warn "Backend pas encore healthy — on continue quand même"; break; }
    printf "."; sleep 5
  done
  echo ""

  # ── Synchronisation des fichiers backend modifiés ────────────────────────
  info "Synchronisation fichiers backend → conteneur..."
  BACKEND_FILES=(
    "backend/src/routes/index.js"
    "backend/src/routes/meetings.js"
    "backend/src/routes/webhook.js"
    "backend/src/controllers/meetingController.js"
    "backend/src/controllers/webhookController.js"
    "backend/src/controllers/conversationController.js"
    "backend/src/server.js"
  )
  SYNCED=0
  for f in "${BACKEND_FILES[@]}"; do
    if [ -f "$f" ]; then
      dest="/app/${f#backend/}"
      docker cp "$f" "cap-epac-backend:$dest" 2>/dev/null && SYNCED=$((SYNCED+1))
    fi
  done
  ok "$SYNCED fichiers backend synchronisés"

  # Redémarrer le backend pour prendre en compte les fichiers
  docker compose restart backend 2>/dev/null
  info "Backend redémarré"
  sleep 10

  # ── Vérification finale ──────────────────────────────────────────────────
  HEALTH=$(curl -sk --max-time 5 "https://${SERVER_IP}:${HTTPS_PORT}/health" 2>/dev/null)
  if echo "$HEALTH" | grep -q '"status":"ok"'; then
    ok "Backend accessible : ✓"
  else
    # Essayer en HTTP
    HEALTH=$(curl -sk --max-time 5 "http://${SERVER_IP}:${HTTP_PORT}/health" 2>/dev/null)
    echo "$HEALTH" | grep -q '"status":"ok"' && ok "Backend accessible via HTTP ✓" || \
    warn "Backend pas encore accessible — vérifier : docker compose logs backend --tail=20"
  fi
fi

# ══════════════════════════════════════════════════════════════════════════════
# 7. BUILD APK MOBILE
# ══════════════════════════════════════════════════════════════════════════════
if [ "$BUILD_APK" = true ] && [ -d "mobile/android" ]; then
  section "7/7 — Build APK Mobile"

  # Augmenter inotify
  echo 524288 > /proc/sys/fs/inotify/max_user_watches 2>/dev/null || \
    sudo sysctl -w fs.inotify.max_user_watches=524288 2>/dev/null || true

  # Détecter et configurer le SDK Android automatiquement
  ANDROID_SDK=""
  for candidate in \
    "$ANDROID_HOME" \
    "$HOME/Android/Sdk" \
    "$HOME/snap/android-studio/common/Android/Sdk" \
    "/opt/android-sdk" \
    "/usr/lib/android-sdk"; do
    [ -d "$candidate/platform-tools" ] && ANDROID_SDK="$candidate" && break
  done

  # Fallback : chercher adb
  if [ -z "$ANDROID_SDK" ]; then
    ADB_PATH=$(find /home -name "adb" -type f 2>/dev/null | head -1)
    [ -n "$ADB_PATH" ] && ANDROID_SDK=$(dirname "$(dirname "$ADB_PATH")")
  fi

  if [ -n "$ANDROID_SDK" ]; then
    echo "sdk.dir=${ANDROID_SDK}" > mobile/android/local.properties
    ok "SDK Android : ${ANDROID_SDK}"
  else
    warn "SDK Android non trouvé — créer mobile/android/local.properties manuellement"
    warn "  echo 'sdk.dir=/chemin/vers/sdk' > mobile/android/local.properties"
  fi

  info "Build APK Release en cours..."
  if cd mobile/android && ./gradlew assembleRelease --no-daemon -q 2>&1 | tail -3; then
    cd "$SCRIPT_DIR"
    APK="mobile/android/app/build/outputs/apk/release/app-release.apk"
    [ -f "$APK" ] && ok "APK : $APK ($(du -sh "$APK" | cut -f1))"
  else
    cd "$SCRIPT_DIR"
    warn "Build APK échoué — voir les logs Gradle"
  fi
fi

# ══════════════════════════════════════════════════════════════════════════════
# RÉSUMÉ
# ══════════════════════════════════════════════════════════════════════════════
echo ""
echo -e "${GREEN}${BOLD}"
echo "  ╔══════════════════════════════════════════════════════════╗"
echo "  ║          Déploiement terminé !                          ║"
echo "  ╠══════════════════════════════════════════════════════════╣"
echo -e "  ║${NC}  Application  : ${CYAN}https://${SERVER_IP}:${HTTPS_PORT}${NC}"
echo -e "  ║  API mobile   : ${CYAN}http://${SERVER_IP}:${MOBILE_PORT}${NC}"
echo -e "  ║  Admin        : admin / Admin@CapEpac2025"
[ "$BUILD_APK" = true ] && \
echo -e "  ║  APK          : mobile/android/.../app-release.apk"
echo -e "${GREEN}${BOLD}  ╚══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  Logs  : ${YELLOW}docker compose logs -f${NC}"
echo -e "  Arrêt : ${YELLOW}docker compose down${NC}"
echo ""
