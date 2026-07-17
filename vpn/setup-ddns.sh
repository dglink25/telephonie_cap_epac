#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  Installation DDNS Dynu — mise à jour automatique IP publique
#  Usage : sudo bash setup-ddns.sh <domaine> <client_id> <secret>
#  Ex    : sudo bash setup-ddns.sh dondiegue.giize.com abc123 xyz789
# ═══════════════════════════════════════════════════════════════

[[ $EUID -ne 0 ]] && { echo "Lancer avec sudo"; exit 1; }
[[ -z "$1" || -z "$2" || -z "$3" ]] && {
    echo "Usage : sudo bash setup-ddns.sh <domaine> <client_id> <secret>"
    echo "Ex    : sudo bash setup-ddns.sh dondiegue.giize.com abc123 xyz789"
    exit 1
}

DOMAIN="$1"
CLIENT_ID="$2"
SECRET="$3"
SCRIPT_PATH="/usr/local/bin/dynu-update.sh"
LOG_PATH="/var/log/dynu-ddns.log"
LAST_IP_FILE="/tmp/dynu_last_ip"

echo "══ Installation DDNS Dynu ══"

# ── Créer le script de mise à jour ────────────────────────────
cat > "$SCRIPT_PATH" << 'SCRIPT'
#!/bin/bash
DOMAIN="PLACEHOLDER_DOMAIN"
CLIENT_ID="PLACEHOLDER_CLIENT_ID"
SECRET="PLACEHOLDER_SECRET"
LOG="PLACEHOLDER_LOG"
LAST_IP_FILE="/tmp/dynu_last_ip"

# Récupérer l'IP publique actuelle
CURRENT_IP=$(curl -s --max-time 10 https://api.ipify.org 2>/dev/null)
if [[ -z "$CURRENT_IP" ]]; then
    CURRENT_IP=$(curl -s --max-time 10 https://ifconfig.me 2>/dev/null)
fi
[[ -z "$CURRENT_IP" ]] && exit 1

# Comparer avec la dernière IP connue
LAST_IP=$(cat "$LAST_IP_FILE" 2>/dev/null)
if [[ "$CURRENT_IP" == "$LAST_IP" ]]; then
    exit 0  # IP n'a pas changé — rien à faire
fi

TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
echo "$TIMESTAMP | IP changée : $LAST_IP → $CURRENT_IP | Mise à jour en cours..." >> "$LOG"

# Obtenir le token OAuth2 Dynu
TOKEN_RESPONSE=$(curl -s -X POST "https://api.dynu.com/v2/oauth2/token" \
    -H "Content-Type: application/json" \
    -d "{\"client_id\":\"$CLIENT_ID\",\"secret\":\"$SECRET\"}")

ACCESS_TOKEN=$(echo "$TOKEN_RESPONSE" | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)

if [[ -z "$ACCESS_TOKEN" ]]; then
    echo "$TIMESTAMP | ERREUR: Impossible d'obtenir le token OAuth2" >> "$LOG"
    exit 1
fi

# Récupérer l'ID du domaine
DOMAINS_RESPONSE=$(curl -s -X GET "https://api.dynu.com/v2/dns" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Accept: application/json")

DOMAIN_ID=$(echo "$DOMAINS_RESPONSE" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)

if [[ -z "$DOMAIN_ID" ]]; then
    echo "$TIMESTAMP | ERREUR: Domaine non trouvé" >> "$LOG"
    exit 1
fi

# Mettre à jour l'IP
UPDATE_RESPONSE=$(curl -s -X POST "https://api.dynu.com/v2/dns/$DOMAIN_ID" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"$DOMAIN\",\"ipv4Address\":\"$CURRENT_IP\",\"ipv4\":true}")

if echo "$UPDATE_RESPONSE" | grep -q '"ipv4Address"'; then
    echo "$TIMESTAMP | OK | IP mise à jour : $CURRENT_IP" >> "$LOG"
    echo "$CURRENT_IP" > "$LAST_IP_FILE"
else
    echo "$TIMESTAMP | ERREUR: $UPDATE_RESPONSE" >> "$LOG"
fi
SCRIPT

# Remplacer les placeholders
sed -i "s|PLACEHOLDER_DOMAIN|$DOMAIN|g" "$SCRIPT_PATH"
sed -i "s|PLACEHOLDER_CLIENT_ID|$CLIENT_ID|g" "$SCRIPT_PATH"
sed -i "s|PLACEHOLDER_SECRET|$SECRET|g" "$SCRIPT_PATH"
sed -i "s|PLACEHOLDER_LOG|$LOG_PATH|g" "$SCRIPT_PATH"

chmod +x "$SCRIPT_PATH"
echo "[✓] Script créé : $SCRIPT_PATH"

# ── Fichier de log ─────────────────────────────────────────────
touch "$LOG_PATH"
chmod 644 "$LOG_PATH"

# ── Cron toutes les 5 minutes ──────────────────────────────────
CRON_LINE="*/5 * * * * $SCRIPT_PATH"
( crontab -l 2>/dev/null | grep -v "dynu-update"; echo "$CRON_LINE" ) | crontab -
echo "[✓] Cron configuré : vérification toutes les 5 minutes"

# ── Premier test immédiat ──────────────────────────────────────
echo ""
echo "── Test initial ──"
PUBLIC_IP=$(curl -s https://api.ipify.org)
echo "[✓] IP publique actuelle : $PUBLIC_IP"

# Lancer le premier update
bash "$SCRIPT_PATH"

# Vérifier le log
sleep 3
LAST_LOG=$(tail -1 "$LOG_PATH" 2>/dev/null)
if [[ -n "$LAST_LOG" ]]; then
    echo "[✓] $LAST_LOG"
else
    echo "[i] Pas de changement d'IP détecté (normal au premier lancement)"
    echo "$PUBLIC_IP" > "$LAST_IP_FILE"
fi

# ── Mettre à jour la config WireGuard ─────────────────────────
echo ""
echo "── Mise à jour de la config WireGuard ──"

SERVER_INFO="/etc/wireguard/server_info.env"
if [[ -f "$SERVER_INFO" ]]; then
    sed -i "s|PUBLIC_IP=.*|PUBLIC_IP=$DOMAIN|g" "$SERVER_INFO"
    echo "[✓] server_info.env → PUBLIC_IP=$DOMAIN"
fi

# Mettre à jour les configs clients existants
CLIENTS_DIR="/etc/wireguard/clients"
COUNT=0
if [[ -d "$CLIENTS_DIR" ]]; then
    for CONF in "$CLIENTS_DIR"/*/*.conf; do
        [[ -f "$CONF" ]] || continue
        sed -i "s|Endpoint = .*:51820|Endpoint = ${DOMAIN}:51820|g" "$CONF"
        COUNT=$((COUNT + 1))
    done
fi

WG_PORT=$(grep "WG_PORT" "$SERVER_INFO" 2>/dev/null | cut -d'=' -f2 || echo "51820")

# ── Résumé ─────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║           DDNS Dynu configuré !                     ║"
echo "╠══════════════════════════════════════════════════════╣"
echo "║  Domaine     : $DOMAIN"
echo "║  IP actuelle : $PUBLIC_IP"
echo "║  Update auto : toutes les 5 minutes"
echo "║  $COUNT config(s) client WireGuard mis à jour"
echo "╠══════════════════════════════════════════════════════╣"
echo "║  IMPORTANT : Port forwarding sur 192.168.100.1      ║"
echo "║  UDP $WG_PORT → 192.168.10.139:$WG_PORT             ║"
echo "╠══════════════════════════════════════════════════════╣"
echo "║  Regénérer les QR codes clients :                   ║"
echo "║  sudo bash add-client.sh <nom>                      ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
echo "  Logs : tail -f $LOG_PATH"
