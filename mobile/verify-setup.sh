#!/bin/bash

# Script de vérification de la configuration
# Usage: ./verify-setup.sh

echo "🔍 Vérification de la configuration CAP-EPAC Mobile"
echo "=================================================="
echo ""

# Couleurs
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. Vérifier les dépendances Node
echo "📦 Vérification des dépendances..."
if [ -f "package.json" ]; then
    echo -e "${GREEN}✓${NC} package.json trouvé"
    
    # Vérifier les dépendances critiques
    DEPS=("react-native-audio-recorder-player" "react-native-image-picker" "react-native-document-picker" "socket.io-client" "@react-native-clipboard/clipboard" "react-native-permissions")
    
    for dep in "${DEPS[@]}"; do
        if grep -q "\"$dep\"" package.json; then
            echo -e "${GREEN}✓${NC} $dep installé"
        else
            echo -e "${RED}✗${NC} $dep MANQUANT"
        fi
    done
else
    echo -e "${RED}✗${NC} package.json non trouvé"
fi
echo ""

# 2. Vérifier la configuration API
echo "🌐 Vérification de la configuration API..."
if [ -f "src/services/api.ts" ]; then
    API_URL=$(grep "SERVER_BASE = " src/services/api.ts | head -1 | cut -d"'" -f2)
    echo -e "${GREEN}✓${NC} api.ts trouvé"
    echo "   URL API: $API_URL"
else
    echo -e "${RED}✗${NC} src/services/api.ts non trouvé"
fi
echo ""

# 3. Vérifier la configuration Socket.IO
echo "🔌 Vérification de la configuration Socket.IO..."
if [ -f "src/services/socket.ts" ]; then
    SOCKET_URL=$(grep "SOCKET_URL = " src/services/socket.ts | head -1 | cut -d"'" -f2)
    echo -e "${GREEN}✓${NC} socket.ts trouvé"
    echo "   URL Socket: $SOCKET_URL"
else
    echo -e "${RED}✗${NC} src/services/socket.ts non trouvé"
fi
echo ""

# 4. Vérifier les permissions Android
echo "🔐 Vérification des permissions Android..."
if [ -f "android/app/src/main/AndroidManifest.xml" ]; then
    echo -e "${GREEN}✓${NC} AndroidManifest.xml trouvé"
    
    PERMISSIONS=("INTERNET" "CAMERA" "READ_MEDIA_IMAGES" "READ_MEDIA_VIDEO" "RECORD_AUDIO")
    
    for perm in "${PERMISSIONS[@]}"; do
        if grep -q "android.permission.$perm" android/app/src/main/AndroidManifest.xml; then
            echo -e "${GREEN}✓${NC} Permission $perm configurée"
        else
            echo -e "${YELLOW}⚠${NC} Permission $perm manquante"
        fi
    done
else
    echo -e "${RED}✗${NC} AndroidManifest.xml non trouvé"
fi
echo ""

# 5. Vérifier les services
echo "🛠️  Vérification des services..."
SERVICES=("src/services/audioRecorder.ts" "src/services/api.ts" "src/services/socket.ts" "src/services/webrtc.ts")

for service in "${SERVICES[@]}"; do
    if [ -f "$service" ]; then
        echo -e "${GREEN}✓${NC} $(basename $service) présent"
    else
        echo -e "${RED}✗${NC} $(basename $service) MANQUANT"
    fi
done
echo ""

# 6. Tester la connexion au serveur backend
echo "🌍 Test de connexion au serveur backend..."
if [ ! -z "$API_URL" ]; then
    # Enlever le protocole pour avoir juste l'IP/host
    HOST=$(echo $API_URL | sed 's|http://||' | sed 's|https://||' | cut -d':' -f1)
    
    if ping -c 1 $HOST &> /dev/null; then
        echo -e "${GREEN}✓${NC} Serveur $HOST accessible"
    else
        echo -e "${RED}✗${NC} Serveur $HOST INACCESSIBLE"
        echo -e "${YELLOW}⚠${NC} Vérifiez que le serveur backend est démarré"
        echo -e "${YELLOW}⚠${NC} Vérifiez que vous êtes sur le même réseau"
    fi
    
    # Tester l'API
    if command -v curl &> /dev/null; then
        if curl -s -o /dev/null -w "%{http_code}" "$API_URL/api/auth/me" | grep -q "401\|200"; then
            echo -e "${GREEN}✓${NC} API répond"
        else
            echo -e "${RED}✗${NC} API ne répond pas"
            echo -e "${YELLOW}⚠${NC} Testez manuellement: curl $API_URL/api/auth/me"
        fi
    fi
else
    echo -e "${YELLOW}⚠${NC} Impossible de déterminer l'URL du serveur"
fi
echo ""

# 7. Récapitulatif
echo "📋 Récapitulatif"
echo "==============="
echo ""
echo "Configuration réseau:"
echo "  - API Backend: $API_URL"
echo "  - Socket.IO: $SOCKET_URL"
echo ""
echo "Pour modifier ces URLs, éditez:"
echo "  - src/services/api.ts (ligne SERVER_BASE)"
echo "  - src/services/socket.ts (ligne SOCKET_URL)"
echo ""
echo "Pour tester l'application:"
echo "  1. Démarrez le backend: cd backend && npm start"
echo "  2. Démarrez Metro: npx react-native start"
echo "  3. Lancez l'app: npx react-native run-android"
echo ""
echo "Pour voir les logs en temps réel:"
echo "  npx react-native log-android | grep -E '\[Socket\]|\[Image\]|\[Audio\]|\[File\]'"
echo ""
echo "🎉 Vérification terminée!"
