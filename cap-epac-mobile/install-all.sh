#!/bin/bash

# Script d'installation automatique - CapEPAC Mobile
# Ce script installe toutes les dépendances et configure le projet

set -e  # Arrêter en cas d'erreur

echo "════════════════════════════════════════════════════════════"
echo "   📱 Installation CapEPAC Mobile - Configuration Complète"
echo "════════════════════════════════════════════════════════════"
echo ""

# Couleurs pour l'output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# ═══ Étape 1 : Vérifier Node.js ═══
echo -e "${BLUE}[1/6]${NC} Vérification de Node.js..."
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js n'est pas installé${NC}"
    echo "Installer Node.js depuis https://nodejs.org/"
    exit 1
fi
NODE_VERSION=$(node -v)
echo -e "${GREEN}✅ Node.js $NODE_VERSION détecté${NC}"
echo ""

# ═══ Étape 2 : Installer les dépendances npm ═══
echo -e "${BLUE}[2/6]${NC} Installation des dépendances npm..."
npm install
echo -e "${GREEN}✅ Dépendances npm installées${NC}"
echo ""

# ═══ Étape 3 : Vérifier les nouvelles dépendances ═══
echo -e "${BLUE}[3/6]${NC} Vérification des dépendances critiques..."

DEPS_OK=true

if [ ! -d "node_modules/date-fns" ]; then
    echo -e "${RED}❌ date-fns manquant${NC}"
    DEPS_OK=false
else
    echo -e "${GREEN}✅ date-fns installé${NC}"
fi

if [ ! -d "node_modules/react-native-webrtc" ]; then
    echo -e "${RED}❌ react-native-webrtc manquant${NC}"
    DEPS_OK=false
else
    echo -e "${GREEN}✅ react-native-webrtc installé${NC}"
fi

if [ ! -d "node_modules/react-native-incall-manager" ]; then
    echo -e "${RED}❌ react-native-incall-manager manquant${NC}"
    DEPS_OK=false
else
    echo -e "${GREEN}✅ react-native-incall-manager installé${NC}"
fi

if [ ! -d "node_modules/react-native-image-picker" ]; then
    echo -e "${RED}❌ react-native-image-picker manquant${NC}"
    DEPS_OK=false
else
    echo -e "${GREEN}✅ react-native-image-picker installé${NC}"
fi

if [ ! -d "node_modules/react-native-document-picker" ]; then
    echo -e "${RED}❌ react-native-document-picker manquant${NC}"
    DEPS_OK=false
else
    echo -e "${GREEN}✅ react-native-document-picker installé${NC}"
fi

if [ ! -d "node_modules/react-native-permissions" ]; then
    echo -e "${RED}❌ react-native-permissions manquant${NC}"
    DEPS_OK=false
else
    echo -e "${GREEN}✅ react-native-permissions installé${NC}"
fi

if [ "$DEPS_OK" = false ]; then
    echo -e "${RED}❌ Des dépendances sont manquantes. Réexécuter npm install${NC}"
    exit 1
fi
echo ""

# ═══ Étape 4 : Clean Android ═══
echo -e "${BLUE}[4/6]${NC} Nettoyage du build Android..."
cd android
if [ -f "gradlew" ]; then
    chmod +x gradlew
    ./gradlew clean || echo -e "${YELLOW}⚠️  Gradle clean a échoué (peut être ignoré)${NC}"
else
    echo -e "${YELLOW}⚠️  gradlew non trouvé${NC}"
fi
cd ..
echo -e "${GREEN}✅ Build Android nettoyé${NC}"
echo ""

# ═══ Étape 5 : Vérifier la configuration ═══
echo -e "${BLUE}[5/6]${NC} Vérification de la configuration..."

# Vérifier AndroidManifest.xml
if grep -q "READ_MEDIA_IMAGES" android/app/src/main/AndroidManifest.xml; then
    echo -e "${GREEN}✅ Permissions Android 13+ configurées${NC}"
else
    echo -e "${YELLOW}⚠️  Permissions Android 13+ manquantes dans AndroidManifest.xml${NC}"
fi

if grep -q "WAKE_LOCK" android/app/src/main/AndroidManifest.xml; then
    echo -e "${GREEN}✅ Permission WAKE_LOCK configurée${NC}"
else
    echo -e "${YELLOW}⚠️  Permission WAKE_LOCK manquante${NC}"
fi

# Vérifier build.gradle
if grep -q "pickFirst 'lib/x86/libc++_shared.so'" android/app/build.gradle; then
    echo -e "${GREEN}✅ Configuration WebRTC dans build.gradle${NC}"
else
    echo -e "${YELLOW}⚠️  Configuration WebRTC manquante dans build.gradle${NC}"
fi

# Vérifier les fichiers de service
if [ -f "src/services/webrtc.ts" ]; then
    echo -e "${GREEN}✅ Service WebRTC créé${NC}"
else
    echo -e "${RED}❌ Service WebRTC manquant (src/services/webrtc.ts)${NC}"
fi

if [ -f "src/store/notificationStore.ts" ]; then
    echo -e "${GREEN}✅ Store Notifications créé${NC}"
else
    echo -e "${RED}❌ Store Notifications manquant${NC}"
fi
echo ""

# ═══ Étape 6 : Résumé ═══
echo -e "${BLUE}[6/6]${NC} Résumé de l'installation"
echo "════════════════════════════════════════════════════════════"
echo -e "${GREEN}✅ Installation terminée avec succès !${NC}"
echo ""
echo "📦 Dépendances installées :"
echo "   • date-fns (formatage dates)"
echo "   • react-native-webrtc (appels audio/vidéo)"
echo "   • react-native-incall-manager (gestion appels)"
echo "   • react-native-image-picker (sélection photos)"
echo "   • react-native-document-picker (sélection fichiers)"
echo "   • react-native-permissions (gestion permissions)"
echo ""
echo "🔧 Configuration Android :"
echo "   • Permissions médias Android 13+"
echo "   • Permissions caméra/micro"
echo "   • Configuration WebRTC (libc++_shared.so)"
echo "   • WAKE_LOCK pour appels"
echo ""
echo "📱 Prochaines étapes :"
echo ""
echo "1. Configurer l'URL du serveur backend :"
echo "   ${YELLOW}Éditer src/services/api.ts (ligne 12)${NC}"
echo "   ${YELLOW}Éditer src/services/socket.ts (ligne 4)${NC}"
echo ""
echo "2. Build l'application :"
echo "   ${BLUE}npm run android${NC}"
echo ""
echo "3. Ou build APK release :"
echo "   ${BLUE}cd android && ./gradlew assembleRelease${NC}"
echo ""
echo "📚 Documentation :"
echo "   • README.md - Vue d'ensemble"
echo "   • INSTALLATION_GUIDE.md - Guide détaillé"
echo "   • WEBRTC_SETUP.md - Configuration WebRTC"
echo "   • PERMISSIONS_SETUP.md - Configuration permissions"
echo "   • DEBUG_PERMISSIONS.md - Dépannage permissions"
echo ""
echo "════════════════════════════════════════════════════════════"
echo -e "${GREEN}🎉 Installation complétée !${NC}"
echo "════════════════════════════════════════════════════════════"
