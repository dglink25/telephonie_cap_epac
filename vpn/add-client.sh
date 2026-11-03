#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  CAP-EPAC — Ajouter un client WireGuard VPN
#
#  Usage : sudo bash add-client.sh <nom_utilisateur>
#  Exemple: sudo bash add-client.sh alice
#           sudo bash add-client.sh mobile-bob
# ═══════════════════════════════════════════════════════════════

set -e

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; BOLD='\033[1m'; NC='\033[0m'

ok()   { echo -e "${GREEN}[✓]${NC} $1"; }
info() { echo -e "${BLUE}[→]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }

[ "$EUID" -ne 0 ] && echo "Lancer avec sudo" && exit 1
[ -z "$1" ] && echo "Usage: sudo bash add-client.sh <nom>" && exit 1

CLIENT_NAME="$1"
CLIENT_DIR="/etc/wireguard/clients"
mkdir -p "$CLIENT_DIR"

# ── Récupérer infos serveur ────────────────────────────────────
SERVER_PUB=$(cat /etc/wireguard/server_public.key)
WAN_IF=$(ip route | grep default | awk '{print $5}' | head -1)
SERVER_IP=$(ip -4 addr show "$WAN_IF" 2>/dev/null | grep -oP '(?<=inet\s)\d+\.\d+\.\d+\.\d+' | head -1)
[ -z "$SERVER_IP" ] && SERVER_IP=$(hostname -I | awk '{print $1}')

# ── Trouver une IP libre dans 10.8.0.x ───────────────────────
LAST_IP=$(grep "AllowedIPs = 10.8.0" /etc/wireguard/wg0.conf 2>/dev/null | \
  grep -oE '10\.8\.0\.[0-9]+' | sort -t. -k4 -n | tail -1 | cut -d. -f4)
[ -z "$LAST_IP" ] && LAST_IP=1
CLIENT_IP="10.8.0.$((LAST_IP + 1))"

# ── Générer les clés client ────────────────────────────────────
CLIENT_PRIV=$(wg genkey)
CLIENT_PUB=$(echo "$CLIENT_PRIV" | wg pubkey)
CLIENT_PSK=$(wg genpsk)

# ── Config client ──────────────────────────────────────────────
cat > "${CLIENT_DIR}/${CLIENT_NAME}.conf" << EOF
[Interface]
PrivateKey = ${CLIENT_PRIV}
Address = ${CLIENT_IP}/32
DNS = 8.8.8.8

[Peer]
PublicKey = ${SERVER_PUB}
PresharedKey = ${CLIENT_PSK}
Endpoint = VOTRE_IP_PUBLIQUE_OU_DDNS:51820
AllowedIPs = 10.8.0.0/24, 192.168.10.0/24
PersistentKeepalive = 25
EOF
chmod 600 "${CLIENT_DIR}/${CLIENT_NAME}.conf"

# ── Ajouter le client dans la config serveur ──────────────────
cat >> /etc/wireguard/wg0.conf << EOF

# Client: ${CLIENT_NAME} — ${CLIENT_IP}
[Peer]
PublicKey = ${CLIENT_PUB}
PresharedKey = ${CLIENT_PSK}
AllowedIPs = ${CLIENT_IP}/32
EOF

# ── Recharger WireGuard sans couper les connexions ────────────
wg addconf wg0 <(cat << EOF
[Peer]
PublicKey = ${CLIENT_PUB}
PresharedKey = ${CLIENT_PSK}
AllowedIPs = ${CLIENT_IP}/32
EOF
) 2>/dev/null || wg-quick down wg0 && wg-quick up wg0

ok "Client '${CLIENT_NAME}' ajouté → ${CLIENT_IP}"

# ── Afficher le QR code ───────────────────────────────────────
echo ""
echo -e "${BOLD}${BLUE}══ Config client : ${CLIENT_NAME} ══${NC}"
echo ""

if command -v qrencode >/dev/null 2>&1; then
  qrencode -t ansiutf8 < "${CLIENT_DIR}/${CLIENT_NAME}.conf"
  echo ""
  ok "Scanner ce QR code avec l'app WireGuard (Android/iOS)"
else
  warn "qrencode non installé — installer avec : sudo apt install qrencode -y"
  info "Puis relancer : sudo bash add-client.sh ${CLIENT_NAME}"
fi

echo ""
echo -e "  Fichier config : ${YELLOW}${CLIENT_DIR}/${CLIENT_NAME}.conf${NC}"
echo ""
echo -e "${YELLOW}⚠  IMPORTANT : éditer la ligne Endpoint dans le fichier :${NC}"
echo -e "   Remplacer ${YELLOW}VOTRE_IP_PUBLIQUE_OU_DDNS${NC} par :"
echo -e "   → Votre IP publique (ex: 197.x.x.x)"
echo -e "   → Ou votre DDNS (ex: mondomaine.dynu.net)"
echo ""
echo -e "  Vérifier votre IP publique : ${BLUE}curl -s ifconfig.me${NC}"
echo ""
