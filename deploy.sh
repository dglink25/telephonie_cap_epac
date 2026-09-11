#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
#  CAP-EPAC Téléphonie — Script de déploiement universel v4
#
#  Usage :
#    bash deploy.sh <IP>                          # IP seulement
#    bash deploy.sh <IP> <domaine>                # IP + domaine DNS local
#    bash deploy.sh <IP> <domaine> --no-apk       # sans APK
#    bash deploy.sh <IP> <domaine> --no-docker    # config seulement
#    bash deploy.sh <IP> <domaine> --apk-only     # APK seulement
#
#  Exemples :
#    bash deploy.sh 192.168.18.103
#    bash deploy.sh 192.168.18.103 telephonie-cap.bj
#    bash deploy.sh 192.168.10.139 cap-epac.local --no-apk
#
#  Le domaine DNS local permet d'accéder via https://telephonie-cap.bj
#  depuis n'importe quel appareil du LAN (configure dnsmasq automatiquement)
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

# ── Parsing des arguments ──────────────────────────────────────────────────────
SERVER_IP=""
DOMAIN=""
BUILD_APK=true
START_DOCKER=true
APK_ONLY=false

for arg in "$@"; do
  case "$arg" in
    --no-apk)    BUILD_APK=false ;;
    --no-docker) START_DOCKER=false ;;
    --apk-only)  APK_ONLY=true; START_DOCKER=false ;;
    --help|-h)
      echo "Usage: bash deploy.sh <IP> [domaine] [--no-apk] [--no-docker] [--apk-only]"
      echo ""
      echo "  bash deploy.sh 192.168.18.103"
      echo "  bash deploy.sh 192.168.18.103 telephonie-cap.bj"
      echo "  bash deploy.sh 192.168.18.103 telephonie-cap.bj --no-apk"
      exit 0 ;;
    *.*.*.*) SERVER_IP="$arg" ;;   # IP détectée
    *.*)     DOMAIN="$arg" ;;      # domaine détecté (contient un point mais pas 4 octets)
  esac
done

# ── Validation/détection IP ────────────────────────────────────────────────────
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
JITSI_URL="${JITSI_URL:-https://meet.jit.si}"

# ── URLs d'accès (domaine prioritaire sur IP si fourni) ───────────────────────
if [ -n "$DOMAIN" ]; then
  ACCESS_URL="https://${DOMAIN}"
  API_URL="https://${DOMAIN}/api"
  SOCKET_URL="https://${DOMAIN}"
  CORS_ORIGINS="https://${DOMAIN},https://${SERVER_IP}:${HTTPS_PORT}"
else
  ACCESS_URL="https://${SERVER_IP}:${HTTPS_PORT}"
  API_URL="https://${SERVER_IP}:${HTTPS_PORT}/api"
  SOCKET_URL="https://${SERVER_IP}:${HTTPS_PORT}"
  CORS_ORIGINS="https://${SERVER_IP}:${HTTPS_PORT}"
fi

# ── Bannière ──────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${CYAN}"
echo "  ╔════════════════════════════════════════════════╗"
echo "  ║    CAP-EPAC Téléphonie — Déploiement v4       ║"
echo "  ╚════════════════════════════════════════════════╝"
echo -e "${NC}"
echo -e "  Serveur  : ${CYAN}${SERVER_IP}${NC}"
[ -n "$DOMAIN" ] && echo -e "  Domaine  : ${CYAN}${DOMAIN}${NC}"
echo -e "  URL      : ${CYAN}${ACCESS_URL}${NC}"
echo -e "  Mobile   : ${CYAN}http://${SERVER_IP}:${MOBILE_PORT}${NC}"
echo -e "  Build APK: ${BUILD_APK}"
echo ""

# ══════════════════════════════════════════════════════════════════════════════
# 1. MISE À JOUR .ENV
# ══════════════════════════════════════════════════════════════════════════════
section "1/8 — Mise à jour .env"

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
DOMAIN=${DOMAIN}
CORS_ORIGIN=${CORS_ORIGINS}
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
JITSI_URL=${JITSI_URL}
JITSI_APP_ID=cap-epac
VITE_API_URL=${API_URL}
VITE_SOCKET_URL=${SOCKET_URL}
ENVEOF

update_env "SERVER_LAN_IP"   "$SERVER_IP"
update_env "DOMAIN"          "${DOMAIN:-}"
update_env "CORS_ORIGIN"     "$CORS_ORIGINS"
update_env "HTTP_PORT"       "$HTTP_PORT"
update_env "HTTPS_PORT"      "$HTTPS_PORT"
update_env "MOBILE_PORT"     "$MOBILE_PORT"
update_env "MYSQL_PORT"      "$MYSQL_EXT_PORT"
update_env "JITSI_URL"       "$JITSI_URL"
update_env "VITE_API_URL"    "$API_URL"
update_env "VITE_SOCKET_URL" "$SOCKET_URL"

ok ".env mis à jour"

# ══════════════════════════════════════════════════════════════════════════════
# 2. DNS LOCAL (dnsmasq) — seulement si domaine fourni
# ══════════════════════════════════════════════════════════════════════════════
if [ -n "$DOMAIN" ]; then
  section "2/8 — Configuration DNS local (${DOMAIN})"

  if ! command -v dnsmasq >/dev/null 2>&1; then
    info "Installation de dnsmasq..."
    apt-get install -y dnsmasq 2>/dev/null || \
    sudo apt-get install -y dnsmasq 2>/dev/null || \
    warn "Impossible d'installer dnsmasq — DNS non configuré"
  fi

  if command -v dnsmasq >/dev/null 2>&1; then
    # Fichier de config dnsmasq pour CAP-EPAC
    DNS_CONF="/etc/dnsmasq.d/cap-epac.conf"
    sudo tee "$DNS_CONF" > /dev/null << DNSEOF
# CAP-EPAC — DNS local généré par deploy.sh
# Tous les appareils du LAN qui utilisent ce serveur comme DNS
# résoudront ${DOMAIN} vers ${SERVER_IP}

address=/${DOMAIN}/${SERVER_IP}

# Interface réseau (écouter sur toutes les interfaces LAN)
interface=lo
bind-interfaces

# Cache DNS
cache-size=1000
log-queries=no
DNSEOF

    # Redémarrer dnsmasq
    sudo systemctl enable dnsmasq 2>/dev/null || true
    sudo systemctl restart dnsmasq 2>/dev/null && \
      ok "dnsmasq redémarré → ${DOMAIN} pointe vers ${SERVER_IP}" || \
      warn "dnsmasq n'a pas pu redémarrer — vérifier : sudo systemctl status dnsmasq"

    # Ajouter au /etc/hosts du serveur lui-même
    if ! grep -q "$DOMAIN" /etc/hosts 2>/dev/null; then
      echo "${SERVER_IP}  ${DOMAIN}" | sudo tee -a /etc/hosts > /dev/null
      ok "/etc/hosts → ${SERVER_IP} ${DOMAIN}"
    else
      sudo sed -i "s|^.*${DOMAIN}.*|${SERVER_IP}  ${DOMAIN}|g" /etc/hosts
      ok "/etc/hosts mis à jour"
    fi

    # Afficher l'IP du serveur DNS pour configuration des appareils clients
    echo ""
    echo -e "  ${YELLOW}┌─ Configuration DNS sur les appareils clients ──────────────┐${NC}"
    echo -e "  ${YELLOW}│${NC} Dans les paramètres WiFi/réseau de chaque appareil,"
    echo -e "  ${YELLOW}│${NC} configurer le DNS manuel vers : ${CYAN}${SERVER_IP}${NC}"
    echo -e "  ${YELLOW}│${NC} ou configurer le routeur pour distribuer ce DNS via DHCP"
    echo -e "  ${YELLOW}│${NC}"
    echo -e "  ${YELLOW}│${NC} Accès après configuration : ${CYAN}https://${DOMAIN}${NC}"
    echo -e "  ${YELLOW}└────────────────────────────────────────────────────────────┘${NC}"
    echo ""
  fi
else
  section "2/8 — DNS (ignoré — pas de domaine fourni)"
  info "Pour activer le DNS : bash deploy.sh ${SERVER_IP} mon-domaine.local"
fi

# ══════════════════════════════════════════════════════════════════════════════
# 3. FRONTEND + BUILD VITE
# ══════════════════════════════════════════════════════════════════════════════
section "3/8 — Frontend (config + build)"

cat > frontend/.env << EOF
VITE_API_URL=${API_URL}
VITE_SOCKET_URL=${SOCKET_URL}
VITE_COTURN_HOST=${SERVER_IP}
VITE_JITSI_URL=${JITSI_URL}
VITE_DOMAIN=${DOMAIN}
EOF
cat > frontend/.env.production << EOF
VITE_API_URL=${API_URL}
VITE_SOCKET_URL=${SOCKET_URL}
VITE_COTURN_HOST=${SERVER_IP}
VITE_JITSI_URL=${JITSI_URL}
VITE_DOMAIN=${DOMAIN}
EOF
ok "frontend/.env → ${ACCESS_URL}"

if [ -d "frontend/node_modules" ]; then
  info "Build Vite..."
  npm run build --prefix frontend 2>&1 | grep -E "✓ built|error|ERRO" | head -3
  ok "Frontend buildé"
else
  warn "frontend/node_modules absent — npm install --prefix frontend requis"
fi

# ══════════════════════════════════════════════════════════════════════════════
# 4. MOBILE
# ══════════════════════════════════════════════════════════════════════════════
section "4/8 — Mobile"

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
ok "config.ts → http://${SERVER_IP}:${MOBILE_PORT}"

WEBRTC_FILE="mobile/src/services/webrtc.ts"
if [ -f "$WEBRTC_FILE" ]; then
  sed -i "s|turn:[0-9.]*:[0-9]*?transport=udp|turn:${SERVER_IP}:3478?transport=udp|g" "$WEBRTC_FILE"
  sed -i "s|turn:[0-9.]*:[0-9]*?transport=tcp|turn:${SERVER_IP}:3478?transport=tcp|g" "$WEBRTC_FILE"
  sed -i "s|stun:[0-9.]*:[0-9]*|stun:${SERVER_IP}:3478|g" "$WEBRTC_FILE"
  ok "webrtc.ts → TURN/STUN : ${SERVER_IP}"
fi

NET_SEC="mobile/android/app/src/main/res/xml/network_security_config.xml"
if [ -f "$NET_SEC" ]; then
  if ! grep -q "$SERVER_IP" "$NET_SEC"; then
    sed -i "/<domain-config cleartextTrafficPermitted=\"true\">/a\\        <domain includeSubdomains=\"true\">${SERVER_IP}</domain>" "$NET_SEC"
  fi
  if [ -n "$DOMAIN" ] && ! grep -q "$DOMAIN" "$NET_SEC"; then
    sed -i "/<domain-config cleartextTrafficPermitted=\"true\">/a\\        <domain includeSubdomains=\"true\">${DOMAIN}</domain>" "$NET_SEC"
    ok "network_security_config.xml → domaine ${DOMAIN} ajouté"
  fi
  ok "network_security_config.xml mis à jour"
fi

# ══════════════════════════════════════════════════════════════════════════════
# 5. COTURN
# ══════════════════════════════════════════════════════════════════════════════
section "5/8 — Coturn"

if [ -f "nginx/coturn.conf" ]; then
  sed -i "s|^relay-ip=.*|relay-ip=${SERVER_IP}|g"       nginx/coturn.conf
  sed -i "s|^external-ip=.*|external-ip=${SERVER_IP}|g" nginx/coturn.conf
  ok "coturn.conf → relay-ip=${SERVER_IP}"
fi

# ══════════════════════════════════════════════════════════════════════════════
# 6. CERTIFICATS SSL
# ══════════════════════════════════════════════════════════════════════════════
section "6/8 — Certificats SSL"

mkdir -p nginx/ssl
REGEN=false
[ ! -f "nginx/ssl/cert.pem" ] && REGEN=true

# Vérifier si le cert couvre l'IP et éventuellement le domaine
if [ "$REGEN" = false ]; then
  CERT_TEXT=$(openssl x509 -in nginx/ssl/cert.pem -text 2>/dev/null)
  ! echo "$CERT_TEXT" | grep -q "$SERVER_IP" && REGEN=true
  [ -n "$DOMAIN" ] && ! echo "$CERT_TEXT" | grep -qi "$DOMAIN" && REGEN=true
  [ "$REGEN" = true ] && warn "Certificat SSL ne couvre pas l'IP/domaine — régénération..."
fi

if [ "$REGEN" = true ]; then
  SAN="IP:${SERVER_IP},DNS:localhost"
  [ -n "$DOMAIN" ] && SAN="${SAN},DNS:${DOMAIN},DNS:*.${DOMAIN}"

  if [ -f "scripts/gen-ssl.sh" ]; then
    bash scripts/gen-ssl.sh "$SERVER_IP" "$DOMAIN"
  else
    openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
      -keyout nginx/ssl/key.pem -out nginx/ssl/cert.pem \
      -subj "/CN=${DOMAIN:-$SERVER_IP}/O=CAP-EPAC/C=BJ" \
      -addext "subjectAltName=${SAN}" 2>/dev/null
  fi
  ok "Certificats SSL générés (IP:${SERVER_IP}${DOMAIN:+, DNS:$DOMAIN})"
else
  ok "Certificats SSL valides"
fi

# ══════════════════════════════════════════════════════════════════════════════
# 7. DOCKER
# ══════════════════════════════════════════════════════════════════════════════
if [ "$START_DOCKER" = true ] && [ "$APK_ONLY" = false ]; then
  section "7/8 — Docker"

  command -v docker >/dev/null 2>&1 || error "Docker non installé"

  # Ouvrir ports firewall
  for PORT in $HTTP_PORT $HTTPS_PORT $MOBILE_PORT 53; do
    iptables -I INPUT -p tcp --dport "$PORT" -j ACCEPT 2>/dev/null || true
  done
  iptables -I INPUT -p udp --dport 53 -j ACCEPT 2>/dev/null || true
  ok "Ports firewall ouverts"

  info "Arrêt des anciens conteneurs..."
  docker compose down 2>/dev/null || true

  info "Build image frontend..."
  touch frontend/dist/index.html 2>/dev/null || true
  docker compose build --no-cache frontend 2>&1 | grep -E "FINISHED|ERROR" | head -2

  info "Démarrage des services..."
  docker compose up -d 2>&1 | grep -E "Started|Running|Error" | head -8

  info "Attente du backend..."
  COUNT=0
  until docker ps --filter "name=cap-epac-backend" --filter "health=healthy" | grep -q "healthy" 2>/dev/null; do
    COUNT=$((COUNT+1)); [ $COUNT -ge 12 ] && break; printf "."; sleep 5
  done
  echo ""

  # Synchronisation backend
  info "Synchronisation backend..."
  SYNCED=0
  for f in \
    backend/src/routes/index.js \
    backend/src/routes/meetings.js \
    backend/src/routes/webhook.js \
    backend/src/controllers/meetingController.js \
    backend/src/controllers/webhookController.js \
    backend/src/controllers/conversationController.js \
    backend/src/server.js; do
    [ -f "$f" ] && docker cp "$f" "cap-epac-backend:/app/${f#backend/}" 2>/dev/null && SYNCED=$((SYNCED+1))
  done
  ok "$SYNCED fichiers backend synchronisés"
  docker compose restart backend 2>/dev/null; sleep 10

  # Vérification
  for URL in "https://${SERVER_IP}:${HTTPS_PORT}/health" "http://${SERVER_IP}:${HTTP_PORT}/health"; do
    HEALTH=$(curl -sk --max-time 5 "$URL" 2>/dev/null)
    echo "$HEALTH" | grep -q '"status":"ok"' && ok "Backend accessible ✓" && break
  done
fi

# ══════════════════════════════════════════════════════════════════════════════
# 8. APK MOBILE
# ══════════════════════════════════════════════════════════════════════════════
if [ "$BUILD_APK" = true ] && [ -d "mobile/android" ]; then
  section "8/8 — Build APK Mobile"

  echo 524288 > /proc/sys/fs/inotify/max_user_watches 2>/dev/null || \
    sudo sysctl -w fs.inotify.max_user_watches=524288 2>/dev/null || true

  # Détecter SDK Android
  ANDROID_SDK=""
  for c in "$ANDROID_HOME" "$HOME/Android/Sdk" "$HOME/snap/android-studio/common/Android/Sdk" "/opt/android-sdk"; do
    [ -d "$c/platform-tools" ] && ANDROID_SDK="$c" && break
  done
  if [ -z "$ANDROID_SDK" ]; then
    ADB=$(find /home -name "adb" -type f 2>/dev/null | head -1)
    [ -n "$ADB" ] && ANDROID_SDK=$(dirname "$(dirname "$ADB")")
  fi

  if [ -n "$ANDROID_SDK" ]; then
    echo "sdk.dir=${ANDROID_SDK}" > mobile/android/local.properties
    ok "SDK Android : ${ANDROID_SDK}"

    info "Build APK Release..."
    if cd mobile/android && ./gradlew assembleRelease --no-daemon -q 2>&1 | tail -3; then
      cd "$SCRIPT_DIR"
      for APK in \
        "mobile/android/app/build/outputs/apk/release/app-release.apk" \
        mobile/android/app/build/outputs/apk/release/*.apk; do
        [ -f "$APK" ] && ok "APK généré : $(basename "$APK") ($(du -sh "$APK" | cut -f1))" && break
      done
    else
      cd "$SCRIPT_DIR"
      warn "Build APK échoué — relancer : bash deploy.sh ${SERVER_IP}${DOMAIN:+ $DOMAIN} --apk-only"
    fi
  else
    warn "SDK Android non trouvé — APK ignoré"
  fi
fi

# ══════════════════════════════════════════════════════════════════════════════
# RÉSUMÉ
# ══════════════════════════════════════════════════════════════════════════════
echo ""
echo -e "${GREEN}${BOLD}"
echo "  ╔══════════════════════════════════════════════════════════════╗"
echo "  ║           Déploiement terminé !                             ║"
echo "  ╠══════════════════════════════════════════════════════════════╣"
echo -e "  ║${NC}  Application  : ${CYAN}${ACCESS_URL}${NC}"
[ -n "$DOMAIN" ] && \
echo -e "  ║  Alt URL      : ${CYAN}https://${SERVER_IP}:${HTTPS_PORT}${NC}"
echo -e "  ║  API mobile   : ${CYAN}http://${SERVER_IP}:${MOBILE_PORT}${NC}"
echo -e "  ║  Admin        : admin / Admin@CapEpac2025"
if [ -n "$DOMAIN" ]; then
echo -e "  ╠══════════════════════════════════════════════════════════════╣"
echo -e "  ║  DNS local    : configurez les appareils avec DNS=${CYAN}${SERVER_IP}${NC}"
echo -e "  ║  Accès domaine: ${CYAN}https://${DOMAIN}${NC} (après config DNS)"
fi
echo -e "${GREEN}${BOLD}  ╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  Logs  : ${YELLOW}docker compose logs -f${NC}"
echo -e "  Arrêt : ${YELLOW}docker compose down${NC}"
echo ""
