#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  WireGuard — Ajouter un client VPN
#  Usage : sudo bash add-client.sh <nom_client>
#  Ex    : sudo bash add-client.sh jean-mobile
# ═══════════════════════════════════════════════════════════════
set -e

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; NC='\033[0m'
info()    { echo -e "${GREEN}[✓]${NC} $1"; }
warn()    { echo -e "${YELLOW}[!]${NC} $1"; }
error()   { echo -e "${RED}[✗]${NC} $1"; exit 1; }
section() { echo -e "\n${BLUE}══ $1 ══${NC}"; }

[[ $EUID -ne 0 ]] && error "Ce script doit être exécuté en root (sudo)"
[[ -z "$1" ]]     && error "Usage : sudo bash add-client.sh <nom_client>"

CLIENT_NAME="$1"
CONFIG_DIR="/etc/wireguard"
CLIENTS_DIR="$CONFIG_DIR/clients"
SERVER_INFO="$CONFIG_DIR/server_info.env"

[[ ! -f "$SERVER_INFO" ]] && error "Fichier server_info.env introuvable. Lancez d'abord setup-wireguard.sh"

# Charger la config serveur
source "$SERVER_INFO"

mkdir -p "$CLIENTS_DIR/$CLIENT_NAME"

section "Création du client : $CLIENT_NAME"

# ── Trouver la prochaine IP disponible ────────────────────────
# Le serveur est .1, les clients commencent à .2
LAST_IP=$(grep -oP "${WG_SUBNET}\.\K\d+" "$CONFIG_DIR/$WG_IFACE.conf" 2>/dev/null | \
          grep -v "^1$" | sort -n | tail -1)

if [[ -z "$LAST_IP" ]]; then
    CLIENT_IP_LAST=2
else
    CLIENT_IP_LAST=$((LAST_IP + 1))
fi

[[ $CLIENT_IP_LAST -gt 254 ]] && error "Réseau VPN plein (max 253 clients)"

CLIENT_VPN_IP="${WG_SUBNET}.${CLIENT_IP_LAST}"
info "IP VPN attribuée : $CLIENT_VPN_IP"

# ── Génération des clés client ────────────────────────────────
wg genkey | tee "$CLIENTS_DIR/$CLIENT_NAME/private.key" | \
    wg pubkey > "$CLIENTS_DIR/$CLIENT_NAME/public.key"
chmod 600 "$CLIENTS_DIR/$CLIENT_NAME/private.key"

CLIENT_PRIVATE=$(cat "$CLIENTS_DIR/$CLIENT_NAME/private.key")
CLIENT_PUBLIC=$(cat "$CLIENTS_DIR/$CLIENT_NAME/public.key")

info "Clés client générées"

# ── Fichier de config client ──────────────────────────────────
# AllowedIPs = 10.8.0.0/24,192.168.10.0/24
# → permet au client d'accéder au VPN ET au LAN de l'entreprise

cat > "$CLIENTS_DIR/$CLIENT_NAME/${CLIENT_NAME}.conf" << EOF
[Interface]
# Nom : ${CLIENT_NAME}
PrivateKey = ${CLIENT_PRIVATE}
Address    = ${CLIENT_VPN_IP}/24
DNS        = 8.8.8.8, 1.1.1.1

[Peer]
# Serveur CAP-EPAC
PublicKey  = ${SERVER_PUBLIC}
Endpoint   = ${PUBLIC_IP}:${WG_PORT}
AllowedIPs = ${WG_SUBNET}.0/24, 192.168.10.0/24
# Keepalive : maintient la connexion même derrière un NAT
PersistentKeepalive = 25
EOF

info "Fichier de configuration client créé"

# ── Ajouter le client dans la config serveur ──────────────────
cat >> "$CONFIG_DIR/$WG_IFACE.conf" << EOF

[Peer]
# Client : ${CLIENT_NAME}
PublicKey  = ${CLIENT_PUBLIC}
AllowedIPs = ${CLIENT_VPN_IP}/32
EOF

info "Client ajouté dans la configuration serveur"

# ── Appliquer sans redémarrer ─────────────────────────────────
wg set "$WG_IFACE" peer "$CLIENT_PUBLIC" allowed-ips "${CLIENT_VPN_IP}/32"
info "Client activé en temps réel (pas de redémarrage nécessaire)"

# ── Générer le QR code ────────────────────────────────────────
section "QR Code (à scanner avec l'app WireGuard)"

QR_FILE="$CLIENTS_DIR/$CLIENT_NAME/${CLIENT_NAME}-qr.png"

# Afficher dans le terminal
qrencode -t ansiutf8 < "$CLIENTS_DIR/$CLIENT_NAME/${CLIENT_NAME}.conf"

# Sauvegarder en PNG
qrencode -t PNG -o "$QR_FILE" < "$CLIENTS_DIR/$CLIENT_NAME/${CLIENT_NAME}.conf"

# ── Résumé ────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║      Client VPN créé avec succès !                  ║${NC}"
echo -e "${GREEN}╠══════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║${NC}  Nom          : ${CYAN}${CLIENT_NAME}${NC}"
echo -e "${GREEN}║${NC}  IP VPN       : ${CYAN}${CLIENT_VPN_IP}${NC}"
echo -e "${GREEN}║${NC}  Serveur      : ${CYAN}${PUBLIC_IP}:${WG_PORT}${NC}"
echo -e "${GREEN}╠══════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║${NC}  Config  : $CLIENTS_DIR/$CLIENT_NAME/${CLIENT_NAME}.conf"
echo -e "${GREEN}║${NC}  QR Code : $QR_FILE"
echo -e "${GREEN}╠══════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║${NC}  Instructions pour le téléphone :               ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  1. Installer ${YELLOW}WireGuard${NC} (Play Store / App Store)  ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  2. Appuyer sur + → Scanner le QR code          ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  3. Activer le tunnel                            ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  4. L'app CAP-EPAC fonctionnera normalement      ${GREEN}║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  Voir tous les clients : ${YELLOW}sudo wg show${NC}"
echo " "


