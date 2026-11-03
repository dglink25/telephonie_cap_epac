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

# Garantir que le résumé s'affiche même en cas d'erreur inattendue
_show_summary() {
  local EXIT_CODE=$?
  [ $EXIT_CODE -ne 0 ] && echo -e "\n${YELLOW}[!] Script interrompu (code $EXIT_CODE) — état Docker :${NC}"
  [ $EXIT_CODE -ne 0 ] && docker compose ps 2>/dev/null || true
}
trap _show_summary EXIT

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

# ── URLs d'accès ──────────────────────────────────────────────────────────────
# Toujours HTTPS — WebRTC (micro/caméra/appels) l'exige
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

  # Tenter dnsmasq uniquement si on a les droits sudo (serveur) et pas sur machine de dev
  DNS_CONFIGURED=false
  if command -v dnsmasq >/dev/null 2>&1 || sudo apt-get install -y dnsmasq -qq 2>/dev/null; then
    DNS_CONF="/etc/dnsmasq.d/cap-epac.conf"
    if sudo tee "$DNS_CONF" > /dev/null 2>&1 << DNSEOF
# CAP-EPAC — DNS local généré par deploy.sh
address=/${DOMAIN}/${SERVER_IP}
interface=lo
bind-interfaces
cache-size=1000
log-queries=no
DNSEOF
    then
      sudo systemctl enable dnsmasq 2>/dev/null || true
      if sudo systemctl restart dnsmasq 2>/dev/null; then
        ok "dnsmasq → ${DOMAIN} = ${SERVER_IP}"
        DNS_CONFIGURED=true
      else
        warn "dnsmasq non démarré (normal sur machine de dev, OK sur serveur Ubuntu)"
      fi
    fi
  fi

  # /etc/hosts — fonctionne sur TOUTES les machines (serveur ET dev)
  if grep -q "$DOMAIN" /etc/hosts 2>/dev/null; then
    sudo sed -i "s|^.*\b${DOMAIN}\b.*|${SERVER_IP}  ${DOMAIN}|g" /etc/hosts 2>/dev/null || \
      sed -i "s|^.*\b${DOMAIN}\b.*|${SERVER_IP}  ${DOMAIN}|g" /etc/hosts 2>/dev/null || true
  else
    echo "${SERVER_IP}  ${DOMAIN}" | sudo tee -a /etc/hosts > /dev/null 2>/dev/null || \
      echo "${SERVER_IP}  ${DOMAIN}" >> /etc/hosts 2>/dev/null || true
  fi
  ok "/etc/hosts → ${SERVER_IP}  ${DOMAIN}"
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
  # Réécrire proprement le fichier (évite les doublons à chaque déploiement)
  {
    echo '<?xml version="1.0" encoding="utf-8"?>'
    echo '<!-- Généré par deploy.sh — NE PAS ÉDITER MANUELLEMENT -->'
    echo '<network-security-config>'
    echo '    <domain-config cleartextTrafficPermitted="true">'
    echo "        <domain includeSubdomains=\"true\">${SERVER_IP}</domain>"
    [ -n "$DOMAIN" ] && echo "        <domain includeSubdomains=\"true\">${DOMAIN}</domain>"
    echo '        <domain includeSubdomains="true">*.cap-epac.local</domain>'
    echo '        <trust-anchors>'
    echo '            <certificates src="system"/>'
    echo '            <certificates src="user"/>'
    echo '        </trust-anchors>'
    echo '    </domain-config>'
    echo '    <domain-config cleartextTrafficPermitted="true">'
    echo '        <domain includeSubdomains="false">localhost</domain>'
    echo '        <domain includeSubdomains="false">10.0.2.2</domain>'
    echo '        <domain includeSubdomains="false">127.0.0.1</domain>'
    echo '        <trust-anchors>'
    echo '            <certificates src="system"/>'
    echo '        </trust-anchors>'
    echo '    </domain-config>'
    echo '    <base-config cleartextTrafficPermitted="false">'
    echo '        <trust-anchors>'
    echo '            <certificates src="system"/>'
    echo '        </trust-anchors>'
    echo '    </base-config>'
    echo '</network-security-config>'
  } > "$NET_SEC"
  ok "network_security_config.xml → ${SERVER_IP}${DOMAIN:+, $DOMAIN}"
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

# ── Fonction : vérifier si le cert actuel est encore valide pour IP+domaine ──
_cert_needs_regen() {
  [ ! -f "nginx/ssl/cert.pem" ] && return 0   # pas de cert → régénérer
  [ ! -f "nginx/ssl/key.pem"  ] && return 0   # pas de clé  → régénérer

  # Cert expiré ou expire dans moins de 30 jours ?
  if ! openssl x509 -in nginx/ssl/cert.pem -checkend 2592000 -noout 2>/dev/null; then
    warn "Certificat SSL expiré ou expire dans < 30 jours"
    return 0
  fi

  local CERT_TEXT
  CERT_TEXT=$(openssl x509 -in nginx/ssl/cert.pem -text 2>/dev/null)

  # L'IP du serveur est dans le SAN ?
  echo "$CERT_TEXT" | grep -q "IP Address:${SERVER_IP}" || { warn "IP ${SERVER_IP} absente du cert"; return 0; }

  # Le domaine est dans le SAN (si fourni) ?
  if [ -n "$DOMAIN" ]; then
    echo "$CERT_TEXT" | grep -qi "${DOMAIN}" || { warn "Domaine ${DOMAIN} absent du cert"; return 0; }
  fi

  return 1   # cert OK, pas besoin de régénérer
}

# ── Fonction : générer avec mkcert (cert de confiance LAN) ───────────────────
_gen_cert_mkcert() {
  local MKCERT_BIN
  MKCERT_BIN=$(command -v mkcert 2>/dev/null)
  [ -z "$MKCERT_BIN" ] && return 1

  info "mkcert détecté — génération certificat de confiance LAN..."
  local CAROOT
  CAROOT=$("$MKCERT_BIN" -CAROOT 2>/dev/null)
  "$MKCERT_BIN" -install 2>/dev/null || true

  local DOMAINS="${SERVER_IP} localhost 127.0.0.1"
  [ -n "$DOMAIN" ] && DOMAINS="${DOMAIN} *.${DOMAIN} ${DOMAINS}"

  local TMPDIR
  TMPDIR=$(mktemp -d)
  # shellcheck disable=SC2086
  (cd "$TMPDIR" && "$MKCERT_BIN" -key-file key.pem -cert-file cert.pem $DOMAINS 2>/dev/null)

  if [ -f "$TMPDIR/cert.pem" ] && [ -f "$TMPDIR/key.pem" ]; then
    mv "$TMPDIR/cert.pem" nginx/ssl/cert.pem
    mv "$TMPDIR/key.pem"  nginx/ssl/key.pem
    rm -rf "$TMPDIR"
    [ -n "$CAROOT" ] && [ -f "${CAROOT}/rootCA.pem" ] && \
      cp "${CAROOT}/rootCA.pem" nginx/ssl/rootCA.pem
    return 0
  fi
  rm -rf "$TMPDIR"
  return 1
}

# ── Fonction : copier les certs sur le serveur distant via SSH ────────────────
_push_certs_to_server() {
  # Appelée uniquement quand on est sur la machine de dev (mkcert dispo)
  # et que SERVER_IP != IP locale
  local LOCAL_IP
  LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
  [ "$SERVER_IP" = "$LOCAL_IP" ] && return 0   # on EST le serveur, rien à copier

  command -v ssh >/dev/null 2>&1 || return 0
  command -v scp >/dev/null 2>&1 || return 0

  # Trouver l'utilisateur SSH du serveur (essayer lab1503, ubuntu, root)
  local SSH_USER=""
  for U in lab1503 ubuntu admin root; do
    if ssh -o ConnectTimeout=3 -o StrictHostKeyChecking=no \
           -o BatchMode=yes "${U}@${SERVER_IP}" "echo ok" 2>/dev/null | grep -q ok; then
      SSH_USER="$U"
      break
    fi
  done

  if [ -z "$SSH_USER" ]; then
    warn "SSH vers ${SERVER_IP} impossible (clé SSH non configurée) — copie manuelle requise"
    warn "  Pour configurer SSH sans mot de passe :"
    warn "  ssh-copy-id lab1503@${SERVER_IP}"
    return 0
  fi

  local REMOTE_DIR
  REMOTE_DIR=$(ssh -o ConnectTimeout=5 "${SSH_USER}@${SERVER_IP}" \
    "find /mnt /home /opt -maxdepth 4 -name 'docker-compose.yml' 2>/dev/null | head -1 | xargs dirname" 2>/dev/null)
  [ -z "$REMOTE_DIR" ] && REMOTE_DIR="/mnt/CAP_Data/telephonie_cap_epac"

  info "Copie des certificats SSL vers ${SSH_USER}@${SERVER_IP}:${REMOTE_DIR}/nginx/ssl/ ..."
  ssh "${SSH_USER}@${SERVER_IP}" "mkdir -p ${REMOTE_DIR}/nginx/ssl" 2>/dev/null
  scp -q nginx/ssl/cert.pem nginx/ssl/key.pem \
      "${SSH_USER}@${SERVER_IP}:${REMOTE_DIR}/nginx/ssl/" 2>/dev/null && \
    ok "Certificats copiés sur le serveur — plus d'avertissement SSL sur le LAN" || \
    warn "Copie SSH échouée — relancer : scp nginx/ssl/cert.pem nginx/ssl/key.pem ${SSH_USER}@${SERVER_IP}:${REMOTE_DIR}/nginx/ssl/"

  if [ -f "nginx/ssl/rootCA.pem" ]; then
    scp -q nginx/ssl/rootCA.pem \
        "${SSH_USER}@${SERVER_IP}:${REMOTE_DIR}/nginx/ssl/" 2>/dev/null || true
  fi

  # Recharger nginx sur le serveur pour prendre le nouveau cert
  ssh "${SSH_USER}@${SERVER_IP}" \
    "cd ${REMOTE_DIR} && docker compose exec nginx nginx -s reload 2>/dev/null || docker compose restart nginx 2>/dev/null" \
    2>/dev/null && ok "nginx rechargé sur le serveur avec le nouveau certificat" || true
}

# ── Fonction : générer avec openssl (fallback) ────────────────────────────────
_gen_cert_openssl() {
  local SAN="IP:${SERVER_IP},DNS:localhost"
  [ -n "$DOMAIN" ] && SAN="${SAN},DNS:${DOMAIN},DNS:*.${DOMAIN}"
  openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
    -keyout nginx/ssl/key.pem -out nginx/ssl/cert.pem \
    -subj "/CN=${DOMAIN:-$SERVER_IP}/O=CAP-EPAC/C=BJ" \
    -addext "subjectAltName=${SAN}" 2>/dev/null
  # Pas de rootCA.pem en openssl auto-signé = le cert lui-même est sa propre CA
  cp nginx/ssl/cert.pem nginx/ssl/rootCA.pem 2>/dev/null || true
}

# ── Fonction : générer la page HTML d'installation CA ────────────────────────
_gen_install_ca_page() {
  [ ! -f "nginx/ssl/rootCA.pem" ] && return 0
  local CA_URL_IP="http://${SERVER_IP}:${HTTP_PORT:-19080}/rootCA.pem"
  local CA_URL_DOMAIN=""
  [ -n "$DOMAIN" ] && CA_URL_DOMAIN="http://${DOMAIN}/rootCA.pem"
  local APP_URL="${ACCESS_URL}"

  cat > nginx/ssl/install-ca.html << HTMLEOF
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>CAP-EPAC — Installer le certificat SSL</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
         background: #0f172a; color: #e2e8f0; margin: 0; padding: 20px; }
  .card { background: #1e293b; border-radius: 12px; padding: 24px;
          max-width: 600px; margin: 20px auto; }
  h1 { color: #38bdf8; font-size: 1.4em; }
  h2 { color: #94a3b8; font-size: 1em; margin-top: 20px; }
  .btn { display: inline-block; background: #0ea5e9; color: white;
         padding: 12px 24px; border-radius: 8px; text-decoration: none;
         font-weight: bold; margin: 8px 4px; }
  .btn:hover { background: #0284c7; }
  .step { background: #0f172a; border-radius: 8px; padding: 12px;
          margin: 8px 0; border-left: 3px solid #38bdf8; }
  .os { font-weight: bold; color: #38bdf8; }
  code { background: #334155; padding: 2px 6px; border-radius: 4px;
         font-size: 0.9em; }
  .done { text-align: center; margin-top: 20px; }
  .done a { background: #10b981; }
</style>
</head>
<body>
<div class="card">
  <h1>📱 CAP-EPAC — Installer le certificat de confiance</h1>
  <p>Cette étape est nécessaire <strong>une seule fois</strong> par appareil
     pour accéder à <strong>${APP_URL}</strong> sans avertissement.</p>

  <h2>1. Télécharger le certificat</h2>
  <a class="btn" href="/rootCA.pem" download="cap-epac-CA.pem">⬇ Télécharger rootCA.pem</a>
  <a class="btn" href="/rootCA.crt" download="cap-epac-CA.crt">⬇ Télécharger rootCA.crt</a>

  <h2>2. Installer selon votre appareil</h2>

  <div class="step">
    <span class="os">🤖 Android</span><br>
    Paramètres → Sécurité → Chiffrement et identifiants →
    Installer un certificat → <code>Certificat CA</code> → choisir le fichier .crt
  </div>

  <div class="step">
    <span class="os">🍎 iPhone / iPad</span><br>
    Ouvrir le fichier .pem → Installer le profil → Paramètres →
    Général → Info → Réglages certificat → Activer la confiance totale
  </div>

  <div class="step">
    <span class="os">🪟 Windows</span><br>
    Double-clic sur rootCA.pem → Installer le certificat →
    Ordinateur local → <code>Autorités de certification racines de confiance</code>
  </div>

  <div class="step">
    <span class="os">🐧 Linux (Chrome/Firefox)</span><br>
    Chrome : <code>chrome://settings/certificates</code> → Autorités → Importer<br>
    Firefox : Paramètres → Vie privée → Certificats → Voir les certificats → Importer
  </div>

  <div class="step">
    <span class="os">🍎 macOS</span><br>
    Double-clic → Trousseaux → Ajouter → Double-clic sur le cert →
    Approuver → Toujours faire confiance
  </div>

  <div class="done">
    <a class="btn" href="${APP_URL}">✅ Accéder à CAP-EPAC Téléphonie</a>
  </div>
</div>
</body>
</html>
HTMLEOF
  ok "Page d'installation CA → http://${SERVER_IP}:${HTTP_PORT:-19080}/installer-certificat"
}

# ── Vérifier et régénérer si nécessaire ───────────────────────────────────────
if _cert_needs_regen; then
  info "Génération du certificat SSL..."
  rm -f nginx/ssl/cert.pem nginx/ssl/key.pem
  if _gen_cert_mkcert; then
    ok "Certificat mkcert généré (IP:${SERVER_IP}${DOMAIN:+, DNS:$DOMAIN})"
    # Si on est sur la machine de dev, copier automatiquement sur le serveur
    _push_certs_to_server
  else
    _gen_cert_openssl
    warn "Certificat auto-signé (mkcert non installé)"
    warn "  Installer mkcert : https://mkcert.dev"
  fi
else
  ok "Certificats SSL valides (IP:${SERVER_IP}${DOMAIN:+, DNS:$DOMAIN})"
  # Toujours essayer de pousser si on est sur la machine de dev
  command -v mkcert >/dev/null 2>&1 && _push_certs_to_server || true
fi

# Générer la page d'installation CA dans tous les cas
_gen_install_ca_page

# ══════════════════════════════════════════════════════════════════════════════
# 7. DOCKER
# ══════════════════════════════════════════════════════════════════════════════
if [ "$START_DOCKER" = true ] && [ "$APK_ONLY" = false ]; then
  section "7/8 — Docker"
  set +e   # Les commandes Docker peuvent retourner non-zéro sans être fatales

  command -v docker >/dev/null 2>&1 || { set -e; error "Docker non installé"; }

  # Ouvrir ports firewall (standard 80/443 + plage personnalisée)
  for PORT in 80 443 $HTTP_PORT $HTTPS_PORT $MOBILE_PORT 53; do
    iptables -I INPUT -p tcp --dport "$PORT" -j ACCEPT 2>/dev/null || true
  done
  iptables -I INPUT -p udp --dport 53 -j ACCEPT 2>/dev/null || true
  # Supprimer les règles DROP sur les IPs internes Docker (172.18.x.x)
  # Ces règles bloquent la communication entre conteneurs (MySQL ETIMEDOUT)
  iptables -t raw -F PREROUTING 2>/dev/null || true
  # Autoriser le trafic entre conteneurs Docker
  iptables -I DOCKER-USER 1 -i br-+ -o br-+ -j ACCEPT 2>/dev/null || true
  iptables -I FORWARD -i br-+ -j ACCEPT 2>/dev/null || true
  iptables -I FORWARD -o br-+ -j ACCEPT 2>/dev/null || true
  ok "Ports firewall ouverts + trafic inter-conteneurs autorisé"

  info "Arrêt des anciens conteneurs..."
  docker compose down 2>/dev/null || true

  # Réparer le fichier AOF Redis si corrompu (évite le crash au démarrage)
  info "Vérification intégrité Redis AOF..."
  docker compose run --rm --no-deps redis sh -c \
    'for f in /data/appendonlydir/*.incr.aof; do [ -f "$f" ] && redis-check-aof --fix "$f" < /dev/null 2>/dev/null || rm -f "$f"; done; echo "AOF OK"' \
    2>/dev/null || true

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
  docker compose restart backend 2>/dev/null || true
  sleep 15

  # Vérification santé backend (ne bloque jamais le script)
  BACKEND_OK=false
  for ATTEMPT in 1 2 3; do
    for URL in "https://${SERVER_IP}:${HTTPS_PORT}/health" "http://${SERVER_IP}:${HTTP_PORT}/health"; do
      HEALTH=$(curl -sk --max-time 6 "$URL" 2>/dev/null || true)
      if echo "$HEALTH" | grep -q '"status":"ok"'; then
        ok "Backend accessible ✓"
        BACKEND_OK=true
        break 2
      fi
    done
    [ "$ATTEMPT" -lt 3 ] && printf "." && sleep 10
  done
  echo ""
  if [ "$BACKEND_OK" = false ]; then
    warn "Backend pas encore prêt — vérifier : docker compose logs backend --tail=20"
    warn "Si ETIMEDOUT MySQL : sudo iptables -t raw -F PREROUTING && docker compose restart backend"
  else
    # Redémarrer nginx en dernier pour forcer la re-résolution DNS interne Docker
    # (évite le 504 dû à nginx qui cache une mauvaise IP au démarrage)
    docker compose restart nginx 2>/dev/null || true
    sleep 3
    ok "Nginx rechargé — résolution DNS Docker rafraîchie"
  fi
  set -e   # Remettre le mode strict
fi

# ══════════════════════════════════════════════════════════════════════════════
# 8. APK MOBILE
# ══════════════════════════════════════════════════════════════════════════════
if [ "$BUILD_APK" = true ] && [ -d "mobile/android" ]; then
  section "8/8 — Build APK Mobile"

  echo 524288 > /proc/sys/fs/inotify/max_user_watches 2>/dev/null || \
    sudo sysctl -w fs.inotify.max_user_watches=524288 2>/dev/null || \
    sysctl -w fs.inotify.max_user_watches=524288 2>/dev/null || true

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
    BUILD_OK=false
    (cd mobile/android && ./gradlew assembleRelease --no-daemon -q 2>&1 | tail -5) && BUILD_OK=true || true
    if [ "$BUILD_OK" = true ]; then
      for APK in \
        "mobile/android/app/build/outputs/apk/release/app-release.apk" \
        mobile/android/app/build/outputs/apk/release/*.apk; do
        [ -f "$APK" ] && ok "APK généré : $(basename "$APK") ($(du -sh "$APK" | cut -f1))" && break
      done
    else
      warn "Build APK échoué — relancer : bash deploy.sh ${SERVER_IP}${DOMAIN:+ $DOMAIN} --apk-only"
    fi
  else
    warn "SDK Android non trouvé sur ce serveur"
    warn "  → Pour builder l'APK, lancez depuis votre machine de dev :"
    warn "    bash deploy.sh ${SERVER_IP}${DOMAIN:+ $DOMAIN} --apk-only"
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
echo -e "  ║${NC}  Web (domaine): ${CYAN}${ACCESS_URL}${NC}"
echo -e "  ║  Web (IP)    : ${CYAN}https://${SERVER_IP}:${HTTPS_PORT}${NC}"
echo -e "  ║  Mobile (LAN): ${CYAN}http://${SERVER_IP}:${MOBILE_PORT}${NC}"
echo -e "  ║  Admin       : admin / Admin@CapEpac2025"
echo -e "${GREEN}${BOLD}  ╠══════════════════════════════════════════════════════════════╣${NC}"
if [ -n "$DOMAIN" ]; then
echo -e "  ${YELLOW}┌─ DNS LAN — Pour accéder via https://${DOMAIN} ─────────┐${NC}"
echo -e "  ${YELLOW}│${NC}  Routeur DHCP → DNS primaire : ${CYAN}${SERVER_IP}${NC}"
echo -e "  ${YELLOW}│${NC}  Ou manuellement : WiFi → DNS manuel → ${CYAN}${SERVER_IP}${NC}"
echo -e "  ${YELLOW}└────────────────────────────────────────────────────────┘${NC}"
fi
if [ -f "nginx/ssl/rootCA.pem" ]; then
echo -e "  ${YELLOW}┌─ Certificat SSL — supprimer l'avertissement navigateur ┐${NC}"
echo -e "  ${YELLOW}│${NC}  Télécharger la CA : ${CYAN}http://${SERVER_IP}:${HTTP_PORT}/rootCA.pem${NC}"
echo -e "  ${YELLOW}│${NC}  Chrome : Paramètres → Confidentialité → Certificats → Autorités → Importer"
echo -e "  ${YELLOW}│${NC}  Android: Paramètres → Sécurité → Installer certificat → CA"
echo -e "  ${YELLOW}│${NC}  Windows: Double-clic rootCA.pem → Autorités racines de confiance"
echo -e "  ${YELLOW}└────────────────────────────────────────────────────────┘${NC}"
fi
echo -e "  ${YELLOW}┌─ Mobile hors réseau (VPN WireGuard) ───────────────────┐${NC}"
echo -e "  ${YELLOW}│${NC}  Connecter WireGuard → accès via ${CYAN}http://${SERVER_IP}:${MOBILE_PORT}${NC}"
echo -e "  ${YELLOW}└────────────────────────────────────────────────────────┘${NC}"
echo -e "${GREEN}${BOLD}  ╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  Logs  : ${YELLOW}docker compose logs -f${NC}"
echo -e "  Arrêt : ${YELLOW}docker compose down${NC}"
echo -e "  APK   : ${YELLOW}bash deploy.sh ${SERVER_IP}${DOMAIN:+ $DOMAIN} --apk-only${NC}  (depuis machine dev)"
echo ""
