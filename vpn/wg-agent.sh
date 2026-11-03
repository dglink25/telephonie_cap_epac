#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  CAP-EPAC — WireGuard Agent (mini HTTP server sur l'hôte)
#  Écoute sur 127.0.0.1:51821 — accessible uniquement en local
#  Le backend Docker l'appelle via host.docker.internal:51821
#
#  Usage : sudo bash wg-agent.sh
#  Installer comme service : sudo bash wg-agent.sh --install
# ═══════════════════════════════════════════════════════════════

WG_CONF="/etc/wireguard/wg0.conf"
CLIENT_DIR="/etc/wireguard/clients"
VPN_SUBNET="10.8.0"
PORT=51821
HOST="0.0.0.0"

# ── Installer comme service systemd ───────────────────────────
if [ "$1" = "--install" ]; then
  SCRIPT_DIR="$(dirname "$(realpath "$0")")"
  NODE_BIN=$(command -v node || command -v nodejs)
  [ -z "$NODE_BIN" ] && echo "Node.js requis — sudo apt install nodejs -y" && exit 1

  cat > /etc/systemd/system/wg-agent.service << EOF
[Unit]
Description=CAP-EPAC WireGuard Agent
After=network.target

[Service]
Type=simple
ExecStart=${NODE_BIN} ${SCRIPT_DIR}/wg-agent.js
Restart=always
RestartSec=3
User=root

[Install]
WantedBy=multi-user.target
EOF
  systemctl daemon-reload
  systemctl enable wg-agent
  systemctl restart wg-agent
  sleep 2
  systemctl is-active wg-agent && echo "[✓] wg-agent installé et démarré" || echo "[✗] Échec démarrage"
  exit 0
fi

# ── Helpers ───────────────────────────────────────────────────
next_ip() {
  [ ! -f "$WG_CONF" ] && echo "${VPN_SUBNET}.2" && return
  IPS=$(grep -oE "${VPN_SUBNET}\.[0-9]+" "$WG_CONF" | grep -oE '[0-9]+$' | sort -n | tail -1)
  echo "${VPN_SUBNET}.$((${IPS:-1} + 1))"
}

respond() {
  local CODE="$1" BODY="$2"
  printf "HTTP/1.1 %s\r\nContent-Type: application/json\r\nContent-Length: %d\r\nAccess-Control-Allow-Origin: *\r\nConnection: close\r\n\r\n%s" \
    "$CODE" "${#BODY}" "$BODY"
}

handle_request() {
  local METHOD="" PATH_REQ="" BODY=""
  read -r LINE; METHOD=$(echo "$LINE" | awk '{print $1}'); PATH_REQ=$(echo "$LINE" | awk '{print $2}')

  # Lire les headers jusqu'à la ligne vide
  local CONTENT_LENGTH=0
  while IFS= read -r HEADER; do
    HEADER=$(echo "$HEADER" | tr -d '\r')
    [ -z "$HEADER" ] && break
    echo "$HEADER" | grep -qi "^content-length:" && \
      CONTENT_LENGTH=$(echo "$HEADER" | grep -oi '[0-9]*$')
  done

  # Lire le body si POST
  [ "$CONTENT_LENGTH" -gt 0 ] && read -r -n "$CONTENT_LENGTH" BODY

  # Router les requêtes
  case "${METHOD} ${PATH_REQ}" in

    "GET /status")
      WG_RUNNING=false
      wg show wg0 >/dev/null 2>&1 && WG_RUNNING=true
      SERVER_PUB=$(cat /etc/wireguard/server_public.key 2>/dev/null || echo "")
      respond "200 OK" "{\"available\":true,\"running\":${WG_RUNNING},\"serverPubKey\":\"${SERVER_PUB}\"}"
      ;;

    "POST /generate")
      # Extraire userId et username du body JSON
      USER_ID=$(echo "$BODY" | grep -oP '"userId"\s*:\s*"\K[^"]+')
      USERNAME=$(echo "$BODY" | grep -oP '"username"\s*:\s*"\K[^"]+')
      ENDPOINT=$(echo "$BODY" | grep -oP '"endpoint"\s*:\s*"\K[^"]+')
      [ -z "$ENDPOINT" ] && ENDPOINT=$(hostname -I | awk '{print $1}')

      mkdir -p "$CLIENT_DIR"
      CONF_FILE="${CLIENT_DIR}/user_${USER_ID}.conf"

      # Si config existe déjà → la retourner
      if [ -f "$CONF_FILE" ]; then
        EXISTING=$(cat "$CONF_FILE" | sed 's/"/\\"/g' | tr '\n' '|' | sed 's/|/\\n/g')
        respond "200 OK" "{\"config\":\"${EXISTING}\",\"existed\":true}"
        return
      fi

      # Générer nouvelles clés
      CLIENT_PRIV=$(wg genkey)
      CLIENT_PUB=$(echo "$CLIENT_PRIV" | wg pubkey)
      CLIENT_PSK=$(wg genpsk)
      CLIENT_IP=$(next_ip)
      SERVER_PUB=$(cat /etc/wireguard/server_public.key 2>/dev/null)

      # Écrire la config client
      cat > "$CONF_FILE" << CONFEOF
[Interface]
PrivateKey = ${CLIENT_PRIV}
Address = ${CLIENT_IP}/32
DNS = 8.8.8.8

[Peer]
PublicKey = ${SERVER_PUB}
PresharedKey = ${CLIENT_PSK}
Endpoint = ${ENDPOINT}:51820
AllowedIPs = ${VPN_SUBNET}.0/24, 192.168.10.0/24
PersistentKeepalive = 25
CONFEOF
      chmod 600 "$CONF_FILE"

      # Ajouter dans wg0.conf
      cat >> "$WG_CONF" << PEEREOF

# Client: ${USERNAME} (${USER_ID}) — ${CLIENT_IP}
[Peer]
PublicKey = ${CLIENT_PUB}
PresharedKey = ${CLIENT_PSK}
AllowedIPs = ${CLIENT_IP}/32
PEEREOF

      # Ajouter à chaud
      TMPF=$(mktemp)
      cat > "$TMPF" << PEOF
[Peer]
PublicKey = ${CLIENT_PUB}
PresharedKey = ${CLIENT_PSK}
AllowedIPs = ${CLIENT_IP}/32
PEOF
      wg addconf wg0 "$TMPF" 2>/dev/null || true
      rm -f "$TMPF"

      CONF=$(cat "$CONF_FILE" | sed 's/"/\\"/g' | tr '\n' '|' | sed 's/|/\\n/g')
      respond "200 OK" "{\"config\":\"${CONF}\",\"existed\":false}"
      ;;

    "DELETE /revoke/"*)
      USER_ID="${PATH_REQ#/revoke/}"
      CONF_FILE="${CLIENT_DIR}/user_${USER_ID}.conf"
      if [ ! -f "$CONF_FILE" ]; then
        respond "404 Not Found" '{"error":"No config found"}'
        return
      fi
      # Retirer le peer de wg
      PRIV=$(grep "PrivateKey" "$CONF_FILE" | awk '{print $3}')
      if [ -n "$PRIV" ]; then
        PUB=$(echo "$PRIV" | wg pubkey 2>/dev/null)
        [ -n "$PUB" ] && wg set wg0 peer "$PUB" remove 2>/dev/null || true
      fi
      rm -f "$CONF_FILE"
      respond "200 OK" '{"success":true}'
      ;;

    *)
      respond "404 Not Found" '{"error":"Not found"}'
      ;;
  esac
}

# ── Boucle principale ─────────────────────────────────────────
echo "[wg-agent] Démarrage sur ${HOST}:${PORT}"
while true; do
  { handle_request; } | nc -l -p "$PORT" -s "$HOST" -q 1 2>/dev/null || \
  { handle_request; } | ncat --listen "$HOST" "$PORT" --send-only 2>/dev/null || \
  sleep 1
done
