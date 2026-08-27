

SERVER="https://192.168.10.139:9443"
SECRET="CapEpacWebhook@Secret2025"
CALLBACK_URL="http://192.168.10.116:5678/webhook/4c958b62-260e-4c8c-a640-b58c42881585"

# ── Couleurs ──────────────────────────────────────────────────
GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; NC='\033[0m'
ok()   { echo -e "${GREEN}[✓]${NC} $1"; }
fail() { echo -e "${RED}[✗]${NC} $1"; }
info() { echo -e "${YELLOW}[→]${NC} $1"; }

echo ""
echo "═══════════════════════════════════════════════"
echo "  Test Webhook CAP-EPAC"
echo "  Serveur   : $SERVER"
echo "  Callback  : $CALLBACK_URL"
echo "═══════════════════════════════════════════════"
echo ""

# ── ÉTAPE 1 : Santé du backend ────────────────────────────────
info "Étape 1 : Vérification du backend..."
HEALTH=$(curl -sk "$SERVER/health" 2>/dev/null)
if echo "$HEALTH" | grep -q '"status":"ok"'; then
    ok "Backend opérationnel : $HEALTH"
else
    fail "Backend non disponible : $HEALTH"
    exit 1
fi
echo ""

# ── ÉTAPE 2 : Login pour obtenir un JWT ──────────────────────
info "Étape 2 : Connexion admin..."
LOGIN=$(curl -sk -X POST "$SERVER/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"username":"admin","password":"Admin@CapEpac2025"}')
JWT=$(echo "$LOGIN" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)

if [ -z "$JWT" ]; then
    fail "Login échoué : $LOGIN"
    exit 1
fi
ok "JWT obtenu : ${JWT:0:30}..."
echo ""

# ── ÉTAPE 3 : Envoyer le message entrant (webhook incoming) ───
info "Étape 3 : Envoi message entrant avec callback_url..."
INCOMING=$(curl -sk -X POST "$SERVER/api/webhook/incoming" \
    -H "Content-Type: application/json" \
    -H "X-Webhook-Secret: $SECRET" \
    -d "{
        \"message\": \"Test automatique webhook $(date)\",
        \"callback_url\": \"$CALLBACK_URL\",
        \"metadata\": {\"ref\": \"test-auto-$(date +%s)\"}
    }")

echo "Réponse incoming : $INCOMING"
MSG_ID=$(echo "$INCOMING" | grep -o '"message_id":"[^"]*"' | cut -d'"' -f4)

if [ -z "$MSG_ID" ]; then
    fail "Échec message entrant"
    exit 1
fi
ok "Message entrant créé : $MSG_ID"
echo ""

# ── ÉTAPE 4 : Répondre au message ────────────────────────────
info "Étape 4 : Envoi de la réponse (devrait poster vers $CALLBACK_URL)..."
REPLY=$(curl -sk -X POST "$SERVER/api/webhook/reply/$MSG_ID" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $JWT" \
    -d '{"reply": "Réponse de test automatique CAP-EPAC"}')

echo "Réponse reply : $REPLY"

CALLBACK_STATUS=$(echo "$REPLY" | grep -o '"callback_status":"[^"]*"' | cut -d'"' -f4)
CALLBACK_HTTP=$(echo "$REPLY" | grep -o '"callback_http":[0-9]*' | cut -d':' -f2)

echo ""
if [ "$CALLBACK_STATUS" = "sent" ] && [ "$CALLBACK_HTTP" -ge 200 ] 2>/dev/null && [ "$CALLBACK_HTTP" -lt 300 ] 2>/dev/null; then
    ok "CALLBACK ENVOYÉ AVEC SUCCÈS !"
    ok "HTTP status : $CALLBACK_HTTP"
    echo ""
    echo -e "${GREEN}╔══════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║  Le callback fonctionne !                 ║${NC}"
    echo -e "${GREEN}║  Le problème est côté service externe.       ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════╝${NC}"
else
    fail "CALLBACK ÉCHOUÉ"
    fail "Status : $CALLBACK_STATUS  HTTP : $CALLBACK_HTTP"
    echo ""

    # ── ÉTAPE 5 : Tester le callback directement ─────────────
    info "Étape 5 : Test direct du callback_url depuis cette machine..."
    DIRECT=$(curl -s --max-time 5 -X POST "$CALLBACK_URL" \
        -H "Content-Type: application/json" \
        -d '{"message":"test direct depuis machine dev","metadata":{"ref":"direct-test"}}' \
        -w "\nHTTP_CODE:%{http_code}" 2>&1)

    echo "Réponse directe : $DIRECT"

    if echo "$DIRECT" | grep -q "HTTP_CODE:2"; then
        ok "Callback accessible depuis cette machine"
        fail "Mais PAS accessible depuis Docker → problème réseau Docker"
        echo ""
        echo -e "${YELLOW}╔══════════════════════════════════════════════╗${NC}"
        echo -e "${YELLOW}║  ⚠️  Problème de réseau Docker               ║${NC}"
        echo -e "${YELLOW}║  Solution sur le serveur :                  ║${NC}"
        echo -e "${YELLOW}║  sudo iptables -I DOCKER-USER 1 -j ACCEPT   ║${NC}"
        echo -e "${YELLOW}╚══════════════════════════════════════════════╝${NC}"
    else
        fail "Callback inaccessible depuis cette machine aussi"
        echo -e "${RED}╔══════════════════════════════════════════════╗${NC}"
        echo -e "${RED}║  ✗ Le service externe n'est pas joignable    ║${NC}"
        echo -e "${RED}║  Vérifier que 192.168.10.116:5678 est actif  ║${NC}"
        echo -e "${RED}╚══════════════════════════════════════════════╝${NC}"
    fi
fi
echo ""
