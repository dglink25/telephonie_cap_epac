#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  CAP-EPAC — Mise à jour DDNS automatique (Dynu)
#  Met à jour l'IP publique toutes les 5 minutes via cron
#  Supporte aussi No-IP et DuckDNS
#
#  Usage : sudo bash ddns-update.sh --install <provider> <domain> <user> <password>
#  Exemples :
#    sudo bash ddns-update.sh --install dynu cap-epac.dynu.net MON_USER MON_PASS
#    sudo bash ddns-update.sh --install duckdns mon-domaine MON_TOKEN ""
#    sudo bash ddns-update.sh --install noip mon-domaine.ddns.net MON_USER MON_PASS
# ═══════════════════════════════════════════════════════════════

CONF_FILE="/etc/cap-epac-ddns.conf"
LOG_FILE="/var/log/cap-epac-ddns.log"
ENV_FILE="/mnt/CAP_Data/telephonie_cap_epac/.env"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"; }

# ── Installation ──────────────────────────────────────────────
if [ "$1" = "--install" ]; then
  PROVIDER="${2:-dynu}"
  DOMAIN="$3"
  USER="$4"
  PASS="$5"

  [ -z "$DOMAIN" ] && echo "Usage: sudo bash ddns-update.sh --install <dynu|duckdns|noip> <domain> <user> <pass>" && exit 1

  # Sauvegarder la config
  cat > "$CONF_FILE" << EOF
DDNS_PROVIDER=${PROVIDER}
DDNS_DOMAIN=${DOMAIN}
DDNS_USER=${USER}
DDNS_PASS=${PASS}
EOF
  chmod 600 "$CONF_FILE"

  # Installer dans crontab (toutes les 5 min)
  SCRIPT_PATH="$(realpath "$0")"
  CRON_LINE="*/5 * * * * /bin/bash ${SCRIPT_PATH} >> ${LOG_FILE} 2>&1"
  (crontab -l 2>/dev/null | grep -v "ddns-update"; echo "$CRON_LINE") | crontab -

  # Premier run immédiat
  bash "$0"

  echo "[✓] DDNS configuré : ${DOMAIN} → mis à jour toutes les 5 min"
  echo "[✓] Logs : tail -f ${LOG_FILE}"
  exit 0
fi

# ── Mise à jour DDNS ──────────────────────────────────────────
[ ! -f "$CONF_FILE" ] && echo "Config manquante — lancer avec --install" && exit 1
source "$CONF_FILE"

# Obtenir l'IP publique actuelle
CURRENT_IP=$(curl -s --max-time 10 https://api.ipify.org 2>/dev/null || \
             curl -s --max-time 10 https://ifconfig.me 2>/dev/null || \
             curl -s --max-time 10 https://icanhazip.com 2>/dev/null)

[ -z "$CURRENT_IP" ] && log "ERREUR: Impossible d'obtenir l'IP publique" && exit 1

# Vérifier si l'IP a changé (évite les updates inutiles)
LAST_IP_FILE="/tmp/ddns_last_ip"
LAST_IP=$(cat "$LAST_IP_FILE" 2>/dev/null)
if [ "$CURRENT_IP" = "$LAST_IP" ]; then
  exit 0   # Pas de changement, rien à faire
fi

log "IP changée : ${LAST_IP:-inconnue} → ${CURRENT_IP}"

# ── Mettre à jour selon le provider ──────────────────────────
case "$DDNS_PROVIDER" in

  dynu)
    RESULT=$(curl -s --max-time 10 \
      "https://api.dynu.com/nic/update?hostname=${DDNS_DOMAIN}&myip=${CURRENT_IP}&username=${DDNS_USER}&password=${DDNS_PASS}")
    echo "$RESULT" | grep -qE "^good|^nochg" && \
      log "✓ Dynu mis à jour : ${DDNS_DOMAIN} → ${CURRENT_IP}" || \
      log "✗ Dynu erreur : ${RESULT}"
    ;;

  duckdns)
    RESULT=$(curl -s --max-time 10 \
      "https://www.duckdns.org/update?domains=${DDNS_DOMAIN}&token=${DDNS_USER}&ip=${CURRENT_IP}")
    [ "$RESULT" = "OK" ] && \
      log "✓ DuckDNS mis à jour : ${DDNS_DOMAIN}.duckdns.org → ${CURRENT_IP}" || \
      log "✗ DuckDNS erreur : ${RESULT}"
    ;;

  noip)
    RESULT=$(curl -s --max-time 10 \
      -u "${DDNS_USER}:${DDNS_PASS}" \
      "https://dynupdate.no-ip.com/nic/update?hostname=${DDNS_DOMAIN}&myip=${CURRENT_IP}")
    echo "$RESULT" | grep -qE "^good|^nochg" && \
      log "✓ No-IP mis à jour : ${DDNS_DOMAIN} → ${CURRENT_IP}" || \
      log "✗ No-IP erreur : ${RESULT}"
    ;;

  *)
    log "✗ Provider inconnu : ${DDNS_PROVIDER}"
    exit 1
    ;;
esac

# ── Mettre à jour le .env avec la nouvelle IP publique ────────
echo "$CURRENT_IP" > "$LAST_IP_FILE"

if [ -f "$ENV_FILE" ]; then
  if grep -q "^VPN_ENDPOINT=" "$ENV_FILE"; then
    sed -i "s|^VPN_ENDPOINT=.*|VPN_ENDPOINT=${DDNS_DOMAIN}|" "$ENV_FILE"
  else
    echo "VPN_ENDPOINT=${DDNS_DOMAIN}" >> "$ENV_FILE"
  fi
fi

# ── Redémarrer le wg-agent si nécessaire ────────────────────
systemctl is-active wg-agent >/dev/null 2>&1 || systemctl start wg-agent 2>/dev/null || true
