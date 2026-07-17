#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  Diagnostic VPN WireGuard + Backend CAP-EPAC
# ═══════════════════════════════════════════════════════════════

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; NC='\033[0m'
ok()   { echo -e "${GREEN}[✓]${NC} $1"; }
fail() { echo -e "${RED}[✗]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
info() { echo -e "${BLUE}[i]${NC} $1"; }

echo -e "\n${BLUE}══ Diagnostic WireGuard + Backend ══${NC}\n"

# 1. WireGuard actif ?
if wg show wg0 &>/dev/null; then
    ok "Interface wg0 active"
    wg show wg0
else
    fail "Interface wg0 NON active"
    echo "  → Relancer : sudo systemctl start wg-quick@wg0"
fi

echo ""

# 2. IP forwarding activé ?
FWD=$(cat /proc/sys/net/ipv4/ip_forward)
if [[ "$FWD" == "1" ]]; then
    ok "IP forwarding activé"
else
    fail "IP forwarding DÉSACTIVÉ"
    echo "  → Corriger : sudo sysctl -w net.ipv4.ip_forward=1"
fi

# 3. Règles iptables MASQUERADE présentes ?
if iptables -t nat -L POSTROUTING -n | grep -q "MASQUERADE"; then
    ok "Règle iptables MASQUERADE présente"
else
    fail "Règle iptables MASQUERADE MANQUANTE"
    LAN_IFACE=$(ip route | grep default | awk '{print $5}' | head -1)
    echo "  → Corriger :"
    echo "    sudo iptables -t nat -A POSTROUTING -o $LAN_IFACE -j MASQUERADE"
    echo "    sudo iptables -A FORWARD -i wg0 -j ACCEPT"
    echo "    sudo iptables -A FORWARD -o wg0 -j ACCEPT"
fi

# 4. Règle FORWARD pour wg0 ?
if iptables -L FORWARD -n | grep -q "ACCEPT"; then
    ok "Règles FORWARD présentes"
else
    fail "Règles FORWARD manquantes"
fi

echo ""

# 5. Backend accessible localement ?
echo -e "${BLUE}── Test backend local ──${NC}"
for PORT in 80 443 8080 8282; do
    RESULT=$(curl -sk --max-time 3 http://localhost:$PORT/api/health 2>/dev/null | head -c 50)
    if [[ -n "$RESULT" ]]; then
        ok "Port $PORT répond : $RESULT"
    else
        RESULT2=$(curl -sk --max-time 3 https://localhost:$PORT/health 2>/dev/null | head -c 50)
        if [[ -n "$RESULT2" ]]; then
            ok "Port $PORT (HTTPS) répond : $RESULT2"
        else
            warn "Port $PORT ne répond pas"
        fi
    fi
done

echo ""

# 6. Backend accessible depuis l'IP VPN serveur ?
VPN_SERVER_IP="10.8.0.1"
echo -e "${BLUE}── Test depuis IP VPN ($VPN_SERVER_IP) ──${NC}"
for PORT in 8080 8282; do
    RESULT=$(curl -sk --max-time 3 --interface $VPN_SERVER_IP http://192.168.10.139:$PORT/api/health 2>/dev/null | head -c 50)
    if [[ -n "$RESULT" ]]; then
        ok "Backend accessible via VPN sur port $PORT"
    else
        fail "Backend NON accessible via VPN sur port $PORT"
        echo "  → Problème de routage entre wg0 et le backend"
    fi
done

echo ""

# 7. Docker expose les ports sur 0.0.0.0 ?
echo -e "${BLUE}── Ports Docker ──${NC}"
docker ps --format "table {{.Names}}\t{{.Ports}}" 2>/dev/null || warn "Docker non disponible"

echo ""

# 8. UFW bloque-t-il ?
echo -e "${BLUE}── Firewall UFW ──${NC}"
if command -v ufw &>/dev/null; then
    UFW_STATUS=$(ufw status 2>/dev/null | head -3)
    echo "$UFW_STATUS"
    if ufw status | grep -q "Status: active"; then
        warn "UFW actif — vérifier les règles ci-dessus"
        echo "  → Autoriser les ports Docker depuis VPN :"
        echo "    sudo ufw allow from 10.8.0.0/24 to any"
    else
        ok "UFW inactif (pas de blocage)"
    fi
else
    ok "UFW non installé (pas de blocage)"
fi

echo ""

# 9. Résumé et solution
echo -e "${BLUE}══ Solution si le backend n'est pas accessible via VPN ══${NC}"
echo ""
echo "Lancer la correction automatique :"
echo -e "  ${YELLOW}sudo bash fix-vpn-routing.sh${NC}"
echo ""
