#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  Correction automatique du routage VPN → Backend
# ═══════════════════════════════════════════════════════════════
set -e

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
ok()   { echo -e "${GREEN}[✓]${NC} $1"; }
info() { echo -e "${YELLOW}[→]${NC} $1"; }

[[ $EUID -ne 0 ]] && { echo "Lancer avec sudo"; exit 1; }

LAN_IFACE=$(ip route | grep default | awk '{print $5}' | head -1)
WG_IFACE="wg0"
VPN_SUBNET="10.8.0.0/24"

echo -e "\n${GREEN}══ Correction du routage VPN ══${NC}\n"

# 1. IP forwarding
sysctl -w net.ipv4.ip_forward=1 > /dev/null
ok "IP forwarding activé"

# 2. Règles iptables (idempotentes — ne s'ajoutent pas en double)
# FORWARD wg0 → LAN
iptables -C FORWARD -i $WG_IFACE -j ACCEPT 2>/dev/null || \
    iptables -A FORWARD -i $WG_IFACE -j ACCEPT
ok "FORWARD wg0 → LAN"

# FORWARD LAN → wg0
iptables -C FORWARD -o $WG_IFACE -j ACCEPT 2>/dev/null || \
    iptables -A FORWARD -o $WG_IFACE -j ACCEPT
ok "FORWARD LAN → wg0"

# MASQUERADE (NAT sortant)
iptables -t nat -C POSTROUTING -s $VPN_SUBNET -o $LAN_IFACE -j MASQUERADE 2>/dev/null || \
    iptables -t nat -A POSTROUTING -s $VPN_SUBNET -o $LAN_IFACE -j MASQUERADE
ok "MASQUERADE VPN → LAN"

# 3. Autoriser les ports du backend depuis le VPN
# (nécessaire si Docker crée ses propres règles iptables)
for PORT in 80 443 8080 8282; do
    iptables -C FORWARD -s $VPN_SUBNET -p tcp --dport $PORT -j ACCEPT 2>/dev/null || \
        iptables -A FORWARD -s $VPN_SUBNET -p tcp --dport $PORT -j ACCEPT
done
ok "Ports 80, 443, 8080, 8282 ouverts depuis VPN"

# 4. Docker : s'assurer que les conteneurs acceptent les connexions VPN
# Docker bloque parfois le trafic externe via ses propres règles iptables
iptables -C DOCKER-USER -s $VPN_SUBNET -j ACCEPT 2>/dev/null || \
    iptables -I DOCKER-USER 1 -s $VPN_SUBNET -j ACCEPT 2>/dev/null && \
    ok "Docker-USER : VPN autorisé" || \
    info "Chaîne DOCKER-USER absente (pas critique)"

# 5. UFW : autoriser tout le trafic VPN si UFW est actif
if command -v ufw &>/dev/null && ufw status | grep -q "Status: active"; then
    ufw allow from $VPN_SUBNET to any 2>/dev/null || true
    ok "UFW : trafic VPN autorisé"
fi

# 6. Rendre les règles iptables persistantes
if command -v iptables-save &>/dev/null; then
    iptables-save > /etc/iptables/rules.v4 2>/dev/null || \
    iptables-save > /tmp/iptables-backup.rules 2>/dev/null || true
    ok "Règles iptables sauvegardées"
fi

# 7. Test final
echo ""
echo -e "${GREEN}── Test de connectivité ──${NC}"
sleep 1
RESULT=$(curl -s --max-time 5 http://192.168.10.139:8282/api/health 2>/dev/null)
if [[ -n "$RESULT" ]]; then
    echo -e "${GREEN}[✓]${NC} Backend accessible : $RESULT"
else
    echo -e "${YELLOW}[!]${NC} Backend non accessible sur 8282 — vérifier que Docker tourne"
    echo "    docker compose ps"
fi

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  Routage corrigé. Reconnecte le VPN sur le téléphone ║${NC}"
echo -e "${GREEN}║  et relance l'application CAP-EPAC.                  ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════╝${NC}"
echo ""
