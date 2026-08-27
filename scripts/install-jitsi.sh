#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  Installation Jitsi Meet — Visioconférence pour CAP-EPAC
#  Serveur : Ubuntu, port 8443
#  Usage   : sudo bash scripts/install-jitsi.sh
# ═══════════════════════════════════════════════════════════════
set -e

[[ $EUID -ne 0 ]] && { echo "Lancer avec sudo"; exit 1; }

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
ok()   { echo -e "${GREEN}[✓]${NC} $1"; }
info() { echo -e "${YELLOW}[→]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; exit 1; }

# ── Détecter l'IP LAN ─────────────────────────────────────────
LAN_IP=$(ip route get 1.1.1.1 2>/dev/null | grep -oP 'src \K\S+' | head -1)
LAN_IP=${LAN_IP:-192.168.10.139}

echo ""
echo "══════════════════════════════════════════════"
echo "  Installation Jitsi Meet pour CAP-EPAC"
echo "  IP : $LAN_IP  Port : 8443"
echo "══════════════════════════════════════════════"
echo ""

# ── 1. Pré-requis ──────────────────────────────────────────────
info "Installation des pré-requis..."
apt-get update -qq
apt-get install -y gnupg2 nginx-full curl wget apt-transport-https
ok "Pré-requis installés"

# ── 2. Configurer le hostname ──────────────────────────────────
info "Configuration hostname..."
JITSI_HOST="jitsi.cap-epac.local"
echo "127.0.0.1 $JITSI_HOST" >> /etc/hosts
hostnamectl set-hostname "$JITSI_HOST" 2>/dev/null || true
ok "Hostname : $JITSI_HOST"

# ── 3. Ajouter le dépôt Jitsi ─────────────────────────────────
info "Ajout du dépôt Jitsi..."
curl -fsSL https://download.jitsi.org/jitsi-key.gpg.key \
    | gpg --dearmor > /usr/share/keyrings/jitsi-keyring.gpg

echo "deb [signed-by=/usr/share/keyrings/jitsi-keyring.gpg] \
https://download.jitsi.org stable/" \
    > /etc/apt/sources.list.d/jitsi-stable.list

apt-get update -qq
ok "Dépôt Jitsi ajouté"

# ── 4. Pré-configuration debconf ──────────────────────────────
info "Pré-configuration Jitsi..."
# Hostname Jitsi
echo "jitsi-videobridge2 jitsi-videobridge/jvb-hostname string $JITSI_HOST" \
    | debconf-set-selections
echo "jitsi-meet jitsi-meet/jvb-hostname string $JITSI_HOST" \
    | debconf-set-selections
# Certificat : auto-signé (on configure SSL après)
echo "jitsi-meet-web-config jitsi-meet/cert-choice select Generate a new self-signed certificate" \
    | debconf-set-selections
ok "Pré-configuration faite"

# ── 5. Installation Jitsi Meet ────────────────────────────────
info "Installation de Jitsi Meet (peut prendre quelques minutes)..."
DEBIAN_FRONTEND=noninteractive apt-get install -y jitsi-meet
ok "Jitsi Meet installé"

# ── 6. Configurer nginx sur port 8443 ────────────────────────
info "Configuration nginx Jitsi sur port 8443..."

# Arrêter nginx système si en conflit
systemctl stop nginx 2>/dev/null || true

# Modifier la config nginx Jitsi pour écouter sur 8443
NGINX_CONF="/etc/nginx/sites-available/$JITSI_HOST.conf"
if [ -f "$NGINX_CONF" ]; then
    # Remplacer les ports 80→18080 et 443→8443
    sed -i 's/listen 80;/listen 18080;/g'   "$NGINX_CONF"
    sed -i 's/listen \[::\]:80;/listen [::]:18080;/g' "$NGINX_CONF"
    sed -i 's/listen 443 ssl;/listen 8443 ssl;/g' "$NGINX_CONF"
    sed -i 's/listen \[::\]:443 ssl;/listen [::]:8443 ssl;/g' "$NGINX_CONF"
    ok "Nginx Jitsi configuré sur port 8443"
fi

# ── 7. Générer certificat SSL auto-signé pour Jitsi ──────────
info "Génération certificat SSL pour Jitsi..."
SSL_DIR="/etc/jitsi/meet"
mkdir -p "$SSL_DIR"

openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
    -keyout "$SSL_DIR/$JITSI_HOST.key" \
    -out    "$SSL_DIR/$JITSI_HOST.crt" \
    -subj "/CN=$JITSI_HOST/O=CAP-EPAC/C=BJ" \
    -addext "subjectAltName=IP:$LAN_IP,DNS:$JITSI_HOST" 2>/dev/null

ok "Certificat SSL généré"

# ── 8. Configurer Jitsi pour l'IP LAN ────────────────────────
info "Configuration Jitsi pour IP $LAN_IP..."

JITSI_CONFIG="/etc/jitsi/meet/$JITSI_HOST-config.js"
if [ -f "$JITSI_CONFIG" ]; then
    # Désactiver le lobby par défaut (configurable depuis l'UI)
    sed -i "s|// lobbyRooms|lobbyRooms|g" "$JITSI_CONFIG" 2>/dev/null || true
fi

# JVB (videobridge) — IP publique pour les clients
JVB_CONFIG="/etc/jitsi/videobridge/jvb.conf"
if [ -f "$JVB_CONFIG" ]; then
    sed -i "s|//.*ice4j.harvester.NAT.*|nat-harvester { local-address = \"$LAN_IP\"; public-address = \"$LAN_IP\"; }|g" \
        "$JVB_CONFIG" 2>/dev/null || true
fi

# Configurer l'adresse locale dans sip-communicator.properties
SIP_CONFIG="/etc/jitsi/videobridge/sip-communicator.properties"
if [ -f "$SIP_CONFIG" ]; then
    echo "org.ice4j.ice.harvest.NAT_HARVESTER_LOCAL_ADDRESS=$LAN_IP" >> "$SIP_CONFIG"
    echo "org.ice4j.ice.harvest.NAT_HARVESTER_PUBLIC_ADDRESS=$LAN_IP" >> "$SIP_CONFIG"
fi

ok "Configuration Jitsi mise à jour"

# ── 9. Ouvrir le firewall ──────────────────────────────────────
info "Configuration firewall..."
ufw allow 8443/tcp comment "Jitsi Meet HTTPS" 2>/dev/null || true
ufw allow 10000/udp comment "Jitsi JVB media"  2>/dev/null || true
ufw allow 4443/tcp comment "Jitsi JVB fallback" 2>/dev/null || true
ok "Ports ouverts : 8443/tcp, 10000/udp, 4443/tcp"

# ── 10. Démarrer les services ─────────────────────────────────
info "Démarrage des services Jitsi..."
systemctl enable nginx jicofo jitsi-videobridge2 prosody 2>/dev/null || true
systemctl restart nginx prosody jicofo jitsi-videobridge2 2>/dev/null || true
ok "Services Jitsi démarrés"

# ── 11. Sauvegarder la config pour l'app ─────────────────────
cat > "/etc/jitsi/cap-epac-jitsi.env" << EOF
JITSI_URL=https://$LAN_IP:8443
JITSI_HOST=$JITSI_HOST
JITSI_IP=$LAN_IP
JITSI_PORT=8443
EOF

ok "Config sauvegardée dans /etc/jitsi/cap-epac-jitsi.env"

# ── Résumé ────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║      Jitsi Meet installé avec succès !              ║${NC}"
echo -e "${GREEN}╠══════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║${NC}  URL : https://$LAN_IP:8443"
echo -e "${GREEN}║${NC}  Test : ouvrir dans un navigateur sur le LAN"
echo -e "${GREEN}╠══════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║${NC}  Étape suivante :"
echo -e "${GREEN}║${NC}  Ajouter dans .env du projet :"
echo -e "${GREEN}║${NC}  JITSI_URL=https://$LAN_IP:8443"
echo -e "${GREEN}╚══════════════════════════════════════════════════════╝${NC}"
echo ""
