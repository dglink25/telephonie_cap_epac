#!/bin/bash

# Script de test de connexion au serveur backend
# Usage: ./test-connection.sh

echo "🔍 Test de connexion au serveur backend"
echo "========================================"
echo ""

# Lire l'IP depuis .env
if [ -f "../.env" ]; then
    SERVER_IP=$(grep "SERVER_LAN_IP=" ../.env | cut -d'=' -f2)
    echo "📍 IP serveur (depuis .env): $SERVER_IP"
else
    echo "  Fichier .env non trouvé, utilisation IP par défaut"
    SERVER_IP="192.168.10.150"
fi

echo ""
echo "🌐 Test 1: Ping du serveur..."
if ping -c 2 $SERVER_IP &> /dev/null; then
    echo " Serveur accessible sur le réseau"
else
    echo " ERREUR: Serveur inaccessible"
    echo "   Vérifiez:"
    echo "   - Que vous êtes sur le même réseau"
    echo "   - Que l'IP est correcte dans .env"
    exit 1
fi

echo ""
echo "🔌 Test 2: API HTTP (port 80)..."
HTTP_CODE=$(curl -k -s -o /dev/null -w "%{http_code}" "http://$SERVER_IP/api/auth/me" 2>/dev/null)
if [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "200" ]; then
    echo " API HTTP répond (code: $HTTP_CODE)"
else
    echo " API HTTP ne répond pas (code: $HTTP_CODE)"
fi

echo ""
echo " Test 3: API HTTPS (port 443)..."
HTTPS_CODE=$(curl -k -s -o /dev/null -w "%{http_code}" "https://$SERVER_IP/api/auth/me" 2>/dev/null)
if [ "$HTTPS_CODE" = "401" ] || [ "$HTTPS_CODE" = "200" ]; then
    echo " API HTTPS répond (code: $HTTPS_CODE)"
else
    echo " API HTTPS ne répond pas (code: $HTTPS_CODE)"
fi

echo ""
echo "📱 Configuration mobile actuelle:"
if [ -f "src/services/api.ts" ]; then
    API_URL=$(grep "SERVER_BASE = " src/services/api.ts | head -1 | cut -d"'" -f2 | cut -d'"' -f2)
    echo "   api.ts: $API_URL"
else
    echo "   ❌ src/services/api.ts non trouvé"
fi

if [ -f "src/services/socket.ts" ]; then
    SOCKET_URL=$(grep "SOCKET_URL = " src/services/socket.ts | head -1 | cut -d"'" -f2 | cut -d'"' -f2)
    echo "   socket.ts: $SOCKET_URL"
else
    echo "   ❌ src/services/socket.ts non trouvé"
fi

echo ""
echo "🧪 Test 4: Test de login..."
echo "   Tentative de login avec credentials test..."
LOGIN_RESPONSE=$(curl -k -s -X POST "https://$SERVER_IP/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"test123"}' 2>/dev/null)

if echo "$LOGIN_RESPONSE" | grep -q "accessToken\|error\|message"; then
    echo "✅ Endpoint /auth/login répond"
    if echo "$LOGIN_RESPONSE" | grep -q "accessToken"; then
        echo "   ✅ Login réussi (credentials test valides)"
    else
        echo "   ℹ️  Login échoué (credentials test invalides, mais endpoint fonctionne)"
    fi
else
    echo "❌ Endpoint /auth/login ne répond pas correctement"
    echo "   Réponse: $LOGIN_RESPONSE"
fi

echo ""
echo "📋 Récapitulatif:"
echo "==============="
if [ "$HTTPS_CODE" = "401" ] || [ "$HTTPS_CODE" = "200" ]; then
    echo "✅ Backend opérationnel sur HTTPS"
    echo ""
    echo "🔧 Actions à faire:"
    echo "   1. Vérifiez que api.ts utilise: https://$SERVER_IP"
    echo "   2. Vérifiez que socket.ts utilise: https://$SERVER_IP"
    echo "   3. Rebuild l'app: cd android && ./gradlew clean && cd .. && npx react-native run-android"
    echo "   4. Vérifiez les logs: npx react-native log-android | grep -E 'API|Socket'"
elif [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "200" ]; then
    echo "⚠️  Backend opérationnel sur HTTP uniquement"
    echo ""
    echo "🔧 Actions à faire:"
    echo "   1. Vérifiez que api.ts utilise: http://$SERVER_IP"
    echo "   2. Vérifiez que socket.ts utilise: http://$SERVER_IP"
    echo "   3. OU configurez HTTPS sur le backend"
else
    echo "❌ Backend ne répond pas"
    echo ""
    echo "🔧 Actions à faire:"
    echo "   1. Démarrez le backend: cd ../backend && npm start"
    echo "   2. Vérifiez le fichier .env"
    echo "   3. Vérifiez les logs du backend"
fi

echo ""
echo "🎉 Test terminé!"
