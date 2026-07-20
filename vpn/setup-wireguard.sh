#!/bin/bash

set -e

# ── Couleurs ──────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; NC='\033[0m'
info()    { echo -e "${GREEN}[✓]${NC} $1"; }
warn()    { echo -e "${YELLOW}[!]${NC} $1"; }
error()   { echo -e "${RED}[✗]${NC} $1"; exit 1; }
section() { echo -e "\n${BLUE}══ $1 ══${NC}"; }

# ── Vérifications ─────────────────────────────────────────────
[[ $EUID -ne 0 ]] && error "Ce script doit être exécuté en root (sudo)"

section "Configuration"

# Interface réseau principale (ex: eth0, ens3, enp0s3)
LAN_IFACE=$(ip route | grep default | awk '{print $5}' | head -1)
info "Interface réseau détectée : $LAN_IFACE"

# IP publique du routeur
PUBLIC_IP=$(curl -s --max-time 10 https://api.ipify.org 2>/dev/null || \
            curl -s --max-time 10 https://ifconfig.me 2>/dev/null || \
            echo "")

if [[ -z "$PUBLIC_IP" ]]; then
    warn "Impossible de détecter l'IP publique automatiquement."
    read -p "Entrez l'IP publique du routeur : " PUBLIC_IP
fi
info "IP publique : $PUBLIC_IP"

# Port WireGuard (UDP)
WG_PORT=51820
WG_IFACE="wg0"
WG_SUBNET="10.8.0"       # réseau VPN : 10.8.0.0/24
SERVER_VPN_IP="${WG_SUBNET}.1"
CONFIG_DIR="/etc/wireguard"
CLIENTS_DIR="$CONFIG_DIR/clients"

mkdir -p "$CLIENTS_DIR"

# ── Installation ──────────────────────────────────────────────
section "Installation de WireGuard"

apt-get update -qq
apt-get install -y wireguard wireguard-tools qrencode iptables

info "WireGuard installé"

# ── Génération des clés serveur ───────────────────────────────
section "Génération des clés serveur"

if [[ ! -f "$CONFIG_DIR/server_private.key" ]]; then
    wg genkey | tee "$CONFIG_DIR/server_private.key" | \
        wg pubkey > "$CONFIG_DIR/server_public.key"
    chmod 600 "$CONFIG_DIR/server_private.key"
    info "Clés serveur générées"
else
    info "Clés serveur existantes conservées"
fi

SERVER_PRIVATE=$(cat "$CONFIG_DIR/server_private.key")
SERVER_PUBLIC=$(cat "$CONFIG_DIR/server_public.key")

# ── Configuration serveur WireGuard ──────────────────────────
section "Configuration du serveur WireGuard"

cat > "$CONFIG_DIR/$WG_IFACE.conf" << EOF
[Interface]
Address    = ${SERVER_VPN_IP}/24
ListenPort = ${WG_PORT}
PrivateKey = ${SERVER_PRIVATE}

# Routage : permettre aux clients VPN d'accéder au LAN
PostUp   = iptables -A FORWARD -i ${WG_IFACE} -j ACCEPT
PostUp   = iptables -A FORWARD -o ${WG_IFACE} -j ACCEPT
PostUp   = iptables -t nat -A POSTROUTING -o ${LAN_IFACE} -j MASQUERADE
PostDown = iptables -D FORWARD -i ${WG_IFACE} -j ACCEPT
PostDown = iptables -D FORWARD -o ${WG_IFACE} -j ACCEPT
PostDown = iptables -t nat -D POSTROUTING -o ${LAN_IFACE} -j MASQUERADE

# ── Clients (ajoutés automatiquement par add-client.sh) ──────
EOF

chmod 600 "$CONFIG_DIR/$WG_IFACE.conf"
info "Fichier de configuration serveur créé : $CONFIG_DIR/$WG_IFACE.conf"

# ── Activation du forwarding IP ───────────────────────────────
section "Activation du forwarding IP"

# Immédiat
sysctl -w net.ipv4.ip_forward=1 > /dev/null

# Permanent
if ! grep -q "net.ipv4.ip_forward=1" /etc/sysctl.conf; then
    echo "net.ipv4.ip_forward=1" >> /etc/sysctl.conf
fi

# ── Désactiver les logs WireGuard dans le kernel ──────────────
# Par défaut le module kernel peut écrire dans dmesg — on désactive
if ! grep -q "wireguard.disable_roaming_workaround" /etc/sysctl.conf 2>/dev/null; then
    echo "# WireGuard — désactiver les logs kernel" >> /etc/sysctl.conf
fi
# Supprimer les logs WireGuard existants dans journald
journalctl --vacuum-time=1s 2>/dev/null || true

info "IP forwarding activé, logs WireGuard désactivés"

# ── Démarrage du service ──────────────────────────────────────
section "Démarrage de WireGuard"

systemctl enable wg-quick@${WG_IFACE}
systemctl start  wg-quick@${WG_IFACE} || true
info "Service WireGuard démarré et activé au boot"

# ── Ouverture du port firewall ────────────────────────────────
section "Configuration du firewall"

if command -v ufw &>/dev/null; then
    ufw allow ${WG_PORT}/udp comment "WireGuard VPN" 2>/dev/null || true
    info "Règle UFW ajoutée (port ${WG_PORT}/udp)"
fi

# ── Sauvegarde de la config publique pour les clients ─────────
cat > "$CONFIG_DIR/server_info.env" << EOF
PUBLIC_IP=${PUBLIC_IP}
WG_PORT=${WG_PORT}
SERVER_VPN_IP=${SERVER_VPN_IP}
WG_SUBNET=${WG_SUBNET}
SERVER_PUBLIC=${SERVER_PUBLIC}
LAN_IFACE=${LAN_IFACE}
WG_IFACE=${WG_IFACE}
EOF


# Afficher le statut
wg show
