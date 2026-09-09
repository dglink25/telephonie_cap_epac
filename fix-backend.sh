#!/bin/bash
# Synchronise tous les fichiers backend modifiés dans le conteneur
# Usage : bash fix-backend.sh

set -e
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
ok()   { echo -e "${GREEN}[✓]${NC} $1"; }
info() { echo -e "${YELLOW}[→]${NC} $1"; }

cd "$(dirname "$0")"

CONTAINER="cap-epac-backend"

if ! docker ps --format "{{.Names}}" | grep -q "$CONTAINER"; then
  echo "Conteneur $CONTAINER non trouvé — démarrage..."
  docker compose up -d backend
  sleep 15
fi

info "Synchronisation des fichiers backend..."

FILES=(
  "backend/src/routes/index.js"
  "backend/src/routes/meetings.js"
  "backend/src/routes/webhook.js"
  "backend/src/controllers/meetingController.js"
  "backend/src/controllers/webhookController.js"
  "backend/src/controllers/conversationController.js"
  "backend/src/server.js"
)

for f in "${FILES[@]}"; do
  if [ -f "$f" ]; then
    dest="/app/${f#backend/}"
    docker cp "$f" "$CONTAINER:$dest" 2>/dev/null \
      && ok "$f → $dest" \
      || echo "  skip: $f"
  fi
done

info "Redémarrage du backend..."
docker compose restart backend
sleep 12

info "Vérification..."
IP=$(grep '^SERVER_LAN_IP=' .env | cut -d'=' -f2)
PORT=$(grep '^HTTPS_PORT=' .env | cut -d'=' -f2)
RESULT=$(curl -sk "https://${IP}:${PORT}/health" 2>/dev/null)

if echo "$RESULT" | grep -q '"status":"ok"'; then
  ok "Backend opérationnel : $RESULT"
else
  echo "Résultat : $RESULT"
  echo "Voir les logs : docker compose logs backend --tail=20"
fi

# Test route meetings
TOKEN=$(curl -sk -X POST "https://${IP}:${PORT}/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin@CapEpac2025"}' 2>/dev/null \
  | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)

if [ -n "$TOKEN" ]; then
  MEETING=$(curl -sk -X POST "https://${IP}:${PORT}/api/meetings/create" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{}' 2>/dev/null)
  if echo "$MEETING" | grep -q "roomName"; then
    ok "Route /api/meetings/create ✅ : $MEETING"
  else
    echo "Route meetings : $MEETING"
  fi
fi

echo ""
ok "Terminé ! Accès : https://${IP}:${PORT}"
