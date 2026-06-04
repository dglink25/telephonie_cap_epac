#!/bin/bash

# Script de correction du problème de connexion
# Nettoie le cache et rebuild l'application

echo "Correction du problème de connexion"
echo "======================================"
echo ""

echo "Étape 1: Arrêt du Metro bundler..."
pkill -f "react-native.*start" 2>/dev/null || true
echo "Metro arrêté"
echo ""

echo "Étape 2: Nettoyage des caches..."

# Nettoyer le cache Metro
if command -v watchman &> /dev/null; then
    echo "   - Nettoyage watchman..."
    watchman watch-del-all 2>/dev/null || true
fi

echo "   - Nettoyage cache Metro..."
rm -rf $TMPDIR/react-* 2>/dev/null || true
rm -rf $TMPDIR/metro-* 2>/dev/null || true
rm -rf $TMPDIR/haste-map-* 2>/dev/null || true

echo "   - Nettoyage cache npm..."
npm cache clean --force 2>/dev/null || true

echo "Caches nettoyés"
echo ""

echo "🔨 Étape 3: Nettoyage du build Android..."
cd android
echo "   - Gradlew clean..."
./gradlew clean 2>&1 | grep -E "BUILD|FAILED|ERROR" || true
echo "   - Suppression build folders..."
rm -rf app/build
rm -rf build
rm -rf .gradle
cd ..
echo "Build Android nettoyé"
echo ""

echo "Étape 4: Vérification de la configuration..."
SERVER_BASE=$(grep "SERVER_BASE = " src/services/api.ts | head -1 | cut -d"'" -f2 | cut -d'"' -f2)
SOCKET_URL=$(grep "SOCKET_URL = " src/services/socket.ts | head -1 | cut -d"'" -f2 | cut -d'"' -f2)

echo "   API URL: $SERVER_BASE"
echo "   Socket URL: $SOCKET_URL"
echo ""

echo "Étape 5: Rebuild de l'application..."
echo "   Cette étape peut prendre 2-5 minutes..."
echo ""

# Démarrer Metro en arrière-plan
echo "   - Démarrage du Metro bundler..."
npx react-native start --reset-cache > /tmp/metro.log 2>&1 &
METRO_PID=$!
echo "   Metro démarré (PID: $METRO_PID)"

sleep 5

echo ""
echo "   - Build et installation de l'APK..."
echo "     (Assurez-vous qu'un appareil/émulateur est connecté)"
echo ""

npx react-native run-android 2>&1 | grep -E "BUILD|SUCCESS|INSTALLED|FAILED|ERROR" || {
    echo ""
    echo "Le build a rencontré des problèmes"
    echo "   Vérifiez les logs complets dans /tmp/metro.log"
    echo ""
    echo "   Pour voir les logs en temps réel:"
    echo "   tail -f /tmp/metro.log"
    exit 1
}

echo ""
echo "Application installée!"
echo ""

echo "Étape 6: Surveillance des logs..."
echo "   Appuyez sur Ctrl+C pour arrêter"
echo ""
echo "   Logs à surveiller:"
echo "   - [API] pour les appels réseau"
echo "   - [Socket] pour la connexion WebSocket"
echo "   - [AuthStore] pour l'authentification"
echo ""

# Afficher les logs filtrés
npx react-native log-android 2>&1 | grep -E "\[API\]|\[Socket\]|\[Auth" --line-buffered --color=always

# Au cas où l'utilisateur arrête avec Ctrl+C
trap "echo ''; echo 'Surveillance arrêtée'; exit 0" INT
