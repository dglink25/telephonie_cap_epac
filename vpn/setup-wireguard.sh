#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  CAP-EPAC — Configuration WireGuard VPN
#  À lancer UNE SEULE FOIS sur le serveur Ubuntu
#
#  Usage : sudo bash setup-wireguard.sh
# ═══════════════════════════════════════════════════════════════

set -e

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; BOLD='\033[1m'; NC='\033[0m'

ok()      { echo -e "${GREEN}[✓]${NC} $1"; }
info()    { echo -e "${BLUE}[→]${NC} $1"; }
warn()    { echo -e "${YELLOW}[!]${NC} $1"; }

[ "$EUID" -ne 0 ] && echo "Lancer avec sudo" && exit 1

# ── Détecter l'interface réseau principale ─────────────────────
WAN_IF=$(ip route | grep default | awk '{print $5}' | head -1)
SERVER_IP=$(ip route | grep default | awk '{print $9}' | head -1)
[ -z "$SERVER_IP" ] && SERVER_IP=$(hostname -I | awk '{print $1}')

echo ""
echo -e "${BOLD}${BLUE}╔══════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${BLUE}║   CAP-EPAC — Setup WireGuard VPN            ║${NC}"
echo -e "${BOLD}${BLUE}╚══════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  Interface réseau : ${YELLOW}${WAN_IF}${NC}"
echo -e "  IP serveur LAN   : ${YELLOW}${SERVER_IP}${NC}"
echo ""

# ── Générer les clés serveur si pas encore fait ────────────────
if [ ! -f /etc/wireguard/server_private.key ]; then
  wg genkey | tee /etc/wireguard/server_private.key | wg pubkey > /etc/wireguard/server_public.key
  chmod 600 /etc/wireguard/server_private.key
  ok "Clés serveur générées"
else
  ok "Clés serveur existantes conservées"
fi

SERVER_PRIV=$(cat /etc/wireguard/server_private.key)
SERVER_PUB=$(cat /etc/wireguard/server_public.key)

# ── Créer la config wg0 ────────────────────────────────────────
cat > /etc/wireguard/wg0.conf << EOF
[Interface]
Address = 10.8.0.1/24
ListenPort = 51820
PrivateKey = ${SERVER_PRIV}

# Activer le forwarding IP (accès au LAN depuis VPN)
PostUp   = iptables -A FORWARD -i wg0 -j ACCEPT; iptables -A FORWARD -o wg0 -j ACCEPT; iptables -t nat -A POSTROUTING -o ${WAN_IF} -j MASQUERADE
PostDown = iptables -D FORWARD -i wg0 -j ACCEPT; iptables -D FORWARD -o wg0 -j ACCEPT; iptables -t nat -D POSTROUTING -o ${WAN_IF} -j MASQUERADE

# Les clients seront ajoutés ici par add-client.sh
EOF
chmod 600 /etc/wireguard/wg0.conf
ok "Config wg0.conf créée"

# ── Activer le forwarding IP ───────────────────────────────────
if ! grep -q "^net.ipv4.ip_forward=1" /etc/sysctl.conf; then
  echo "net.ipv4.ip_forward=1" >> /etc/sysctl.conf
fi
sysctl -w net.ipv4.ip_forward=1 >/dev/null 2>&1
ok "IP forwarding activé"

# ── Démarrer WireGuard ─────────────────────────────────────────
systemctl enable wg-quick@wg0 2>/dev/null
systemctl start wg-quick@wg0 2>/dev/null || systemctl restart wg-quick@wg0 2>/dev/null
ok "WireGuard démarré (wg0)"

# ── Ouvrir le port firewall ────────────────────────────────────
iptables -I INPUT -p udp --dport 51820 -j ACCEPT 2>/dev/null || true
ok "Port UDP 51820 ouvert"

echo ""
echo -e "${GREEN}${BOLD}══ WireGuard VPN configuré ══${NC}"
echo -e "  Clé publique serveur : ${YELLOW}${SERVER_PUB}${NC}"
echo -e "  Plage VPN            : 10.8.0.0/24"
echo -e "  Port                 : UDP 51820"
echo ""
echo -e "${YELLOW}⚠  Configurer le port forwarding sur le routeur :${NC}"
echo -e "   UDP 51820 → ${SERVER_IP}"
echo ""
echo -e "  Ajouter des clients : ${BLUE}sudo bash add-client.sh <nom>${NC}"
echo ""
