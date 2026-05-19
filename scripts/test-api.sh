#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# Téléphonie CAP-EPAC — Tests d'intégration API (curl)
# ═══════════════════════════════════════════════════════════════
set -e

BASE_URL="${1:-https://localhost}"
TOKEN=""
CONV_ID=""
MSG_ID=""

GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; NC='\033[0m'
PASS=0; FAIL=0

ok()   { echo -e "${GREEN}  ✓${NC} $1"; PASS=$((PASS+1)); }
fail() { echo -e "${RED}  ✗${NC} $1 — $2"; FAIL=$((FAIL+1)); }
step() { echo -e "\n${YELLOW}── $1 ──${NC}"; }

check_status() {
  local EXPECTED="$1"; local ACTUAL="$2"; local LABEL="$3"
  if [ "$ACTUAL" -eq "$EXPECTED" ]; then ok "$LABEL (HTTP $ACTUAL)";
  else fail "$LABEL" "attendu $EXPECTED, reçu $ACTUAL"; fi
}

CURL="curl -sk -w '\n%{http_code}' --cookie-jar /tmp/cap_epac_cookies.txt --cookie /tmp/cap_epac_cookies.txt"

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║    CAP-EPAC — Tests d'intégration API               ║"
echo "╠══════════════════════════════════════════════════════╣"
echo "║  URL de base : $BASE_URL"
echo "╚══════════════════════════════════════════════════════╝"

# ── Phase 1 : Healthcheck ─────────────────────────────────────
step "Phase 1 — Healthcheck"

RESP=$(eval "$CURL '$BASE_URL/health'")
CODE=$(echo "$RESP" | tail -1)
check_status 200 "$CODE" "GET /health"

# ── Phase 2 : Authentification ────────────────────────────────
step "Phase 2 — Authentification"

# Inscription
RESP=$(eval "$CURL -X POST '$BASE_URL/api/auth/register' \
  -H 'Content-Type: application/json' \
  -d '{\"username\":\"testapi\",\"email\":\"testapi@cap-epac.local\",\"password\":\"TestApi123\",\"display_name\":\"Test API\"}'")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | head -1)
if [ "$CODE" -eq 201 ] || [ "$CODE" -eq 409 ]; then ok "POST /api/auth/register (HTTP $CODE)";
else fail "POST /api/auth/register" "HTTP $CODE"; fi

# Connexion
RESP=$(eval "$CURL -X POST '$BASE_URL/api/auth/login' \
  -H 'Content-Type: application/json' \
  -d '{\"username\":\"testapi\",\"password\":\"TestApi123\"}'")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check_status 200 "$CODE" "POST /api/auth/login"

TOKEN=$(echo "$BODY" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
if [ -n "$TOKEN" ]; then ok "Token JWT reçu (${#TOKEN} chars)";
else fail "Token JWT" "token absent de la réponse"; fi

# Me
RESP=$(eval "$CURL -H 'Authorization: Bearer $TOKEN' '$BASE_URL/api/auth/me'")
CODE=$(echo "$RESP" | tail -1)
check_status 200 "$CODE" "GET /api/auth/me"

# Connexion admin
RESP=$(eval "$CURL -X POST '$BASE_URL/api/auth/login' \
  -H 'Content-Type: application/json' \
  -d '{\"username\":\"admin\",\"password\":\"Admin@CapEpac2025\"}'")
CODE=$(echo "$RESP" | tail -1)
check_status 200 "$CODE" "POST /api/auth/login (admin)"

# ── Phase 3 : Utilisateurs ────────────────────────────────────
step "Phase 3 — Annuaire utilisateurs"

RESP=$(eval "$CURL -H 'Authorization: Bearer $TOKEN' '$BASE_URL/api/users'")
CODE=$(echo "$RESP" | tail -1)
check_status 200 "$CODE" "GET /api/users"

RESP=$(eval "$CURL -H 'Authorization: Bearer $TOKEN' '$BASE_URL/api/users?search=test'")
CODE=$(echo "$RESP" | tail -1)
check_status 200 "$CODE" "GET /api/users?search=test"

RESP=$(eval "$CURL -X PUT '$BASE_URL/api/users/me' \
  -H 'Authorization: Bearer $TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{\"display_name\":\"Test API Updated\",\"department\":\"Tests\"}'")
CODE=$(echo "$RESP" | tail -1)
check_status 200 "$CODE" "PUT /api/users/me"

RESP=$(eval "$CURL -X PUT '$BASE_URL/api/users/me/presence' \
  -H 'Authorization: Bearer $TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{\"status\":\"away\"}'")
CODE=$(echo "$RESP" | tail -1)
check_status 200 "$CODE" "PUT /api/users/me/presence"

# ── Phase 4 : Conversations ───────────────────────────────────
step "Phase 4 — Messagerie"

RESP=$(eval "$CURL -H 'Authorization: Bearer $TOKEN' '$BASE_URL/api/conversations'")
CODE=$(echo "$RESP" | tail -1)
check_status 200 "$CODE" "GET /api/conversations"

# Créer une conversation avec l'admin
ADMIN_RESP=$(eval "$CURL -X POST '$BASE_URL/api/auth/login' \
  -H 'Content-Type: application/json' \
  -d '{\"username\":\"admin\",\"password\":\"Admin@CapEpac2025\"}'")
ADMIN_BODY=$(echo "$ADMIN_RESP" | sed '$d')
ADMIN_ID=$(echo "$ADMIN_BODY" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -n "$ADMIN_ID" ]; then
  RESP=$(eval "$CURL -X POST '$BASE_URL/api/conversations' \
    -H 'Authorization: Bearer $TOKEN' \
    -H 'Content-Type: application/json' \
    -d '{\"type\":\"direct\",\"member_ids\":[\"$ADMIN_ID\"]}'")
  CODE=$(echo "$RESP" | tail -1)
  BODY=$(echo "$RESP" | sed '$d')
  if [ "$CODE" -eq 200 ] || [ "$CODE" -eq 201 ]; then
    ok "POST /api/conversations (HTTP $CODE)"
    CONV_ID=$(echo "$BODY" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
  else
    fail "POST /api/conversations" "HTTP $CODE"
  fi
fi

if [ -n "$CONV_ID" ]; then
  # Envoyer un message
  RESP=$(eval "$CURL -X POST '$BASE_URL/api/conversations/$CONV_ID/messages' \
    -H 'Authorization: Bearer $TOKEN' \
    -H 'Content-Type: application/json' \
    -d '{\"content\":\"Test message depuis le script de tests\",\"type\":\"text\"}'")
  CODE=$(echo "$RESP" | tail -1)
  BODY=$(echo "$RESP" | sed '$d')
  check_status 201 "$CODE" "POST /api/conversations/$CONV_ID/messages"
  MSG_ID=$(echo "$BODY" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

  # Lire les messages
  RESP=$(eval "$CURL -H 'Authorization: Bearer $TOKEN' '$BASE_URL/api/conversations/$CONV_ID/messages'")
  CODE=$(echo "$RESP" | tail -1)
  check_status 200 "$CODE" "GET /api/conversations/$CONV_ID/messages"

  # Marquer comme lu
  RESP=$(eval "$CURL -X POST '$BASE_URL/api/conversations/$CONV_ID/read' \
    -H 'Authorization: Bearer $TOKEN'")
  CODE=$(echo "$RESP" | tail -1)
  check_status 200 "$CODE" "POST /api/conversations/$CONV_ID/read"

  if [ -n "$MSG_ID" ]; then
    # Ajouter une réaction
    RESP=$(eval "$CURL -X POST '$BASE_URL/api/conversations/$CONV_ID/messages/$MSG_ID/reactions' \
      -H 'Authorization: Bearer $TOKEN' \
      -H 'Content-Type: application/json' \
      -d '{\"emoji\":\"👍\"}'")
    CODE=$(echo "$RESP" | tail -1)
    check_status 201 "$CODE" "POST réaction emoji"

    # Modifier un message
    RESP=$(eval "$CURL -X PUT '$BASE_URL/api/conversations/$CONV_ID/messages/$MSG_ID' \
      -H 'Authorization: Bearer $TOKEN' \
      -H 'Content-Type: application/json' \
      -d '{\"content\":\"Message modifié\"}'")
    CODE=$(echo "$RESP" | tail -1)
    check_status 200 "$CODE" "PUT message (édition)"

    # Supprimer un message
    RESP=$(eval "$CURL -X DELETE '$BASE_URL/api/conversations/$CONV_ID/messages/$MSG_ID' \
      -H 'Authorization: Bearer $TOKEN'")
    CODE=$(echo "$RESP" | tail -1)
    check_status 200 "$CODE" "DELETE message"
  fi
fi

# ── Phase 5 : Appels ──────────────────────────────────────────
step "Phase 5 — Journal des appels"

RESP=$(eval "$CURL -H 'Authorization: Bearer $TOKEN' '$BASE_URL/api/calls'")
CODE=$(echo "$RESP" | tail -1)
check_status 200 "$CODE" "GET /api/calls"

RESP=$(eval "$CURL -H 'Authorization: Bearer $TOKEN' '$BASE_URL/api/calls?status=completed'")
CODE=$(echo "$RESP" | tail -1)
check_status 200 "$CODE" "GET /api/calls?status=completed"

# ── Phase 6 : Sécurité ───────────────────────────────────────
step "Phase 6 — Tests de sécurité"

# Accès sans token
RESP=$(eval "$CURL '$BASE_URL/api/users'")
CODE=$(echo "$RESP" | tail -1)
check_status 401 "$CODE" "GET /api/users sans token → 401"

# Accès admin depuis user normal
RESP=$(eval "$CURL -H 'Authorization: Bearer $TOKEN' '$BASE_URL/api/calls/stats'")
CODE=$(echo "$RESP" | tail -1)
check_status 403 "$CODE" "GET /api/calls/stats (admin requis) → 403"

# Route inconnue
RESP=$(eval "$CURL '$BASE_URL/api/route-inconnue'")
CODE=$(echo "$RESP" | tail -1)
check_status 404 "$CODE" "Route inconnue → 404"

# Déconnexion
RESP=$(eval "$CURL -X POST '$BASE_URL/api/auth/logout' \
  -H 'Authorization: Bearer $TOKEN'")
CODE=$(echo "$RESP" | tail -1)
check_status 200 "$CODE" "POST /api/auth/logout"

# ── Résumé ────────────────────────────────────────────────────
TOTAL=$((PASS+FAIL))
echo ""
echo "══════════════════════════════════════════════════════"
echo -e "  Résultats : ${GREEN}$PASS passés${NC} / ${RED}$FAIL échoués${NC} / $TOTAL total"
echo "══════════════════════════════════════════════════════"
echo ""

if [ "$FAIL" -gt 0 ]; then exit 1; fi
exit 0
