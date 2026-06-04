#!/bin/bash

# Script de build APK pour CAP-EPAC Mobile
# Usage: ./build-apk.sh

set -e

echo "🚀 Build APK CAP-EPAC Mobile"
echo "=============================="
echo ""

# Couleurs
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Vérifier qu'on est dans le bon dossier
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Erreur: Ce script doit être exécuté depuis le dossier mobile${NC}"
    exit 1
fi

echo -e "${BLUE}📦 Étape 1/4: Vérification des dépendances...${NC}"
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}⚠️  node_modules manquant, installation...${NC}"
    npm install
else
    echo -e "${GREEN}✓ node_modules présent${NC}"
fi

echo ""
echo -e "${BLUE}🧹 Étape 2/4: Nettoyage des anciens builds...${NC}"
cd android
./gradlew clean
echo -e "${GREEN}✓ Nettoyage terminé${NC}"

echo ""
echo -e "${BLUE}🔨 Étape 3/4: Build de l'APK (cela peut prendre 10-20 minutes)...${NC}"
echo -e "${YELLOW}⏳ Patience, le build est en cours...${NC}"
echo ""

# Lancer le build avec affichage de la progression
./gradlew assembleRelease --no-daemon

echo ""
echo -e "${BLUE}📋 Étape 4/4: Vérification du résultat...${NC}"

APK_PATH="app/build/outputs/apk/release/app-release.apk"

if [ -f "$APK_PATH" ]; then
    APK_SIZE=$(du -h "$APK_PATH" | cut -f1)
    echo ""
    echo -e "${GREEN}✅ BUILD RÉUSSI !${NC}"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "${GREEN}📱 APK créé avec succès !${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo -e "📍 Emplacement: ${BLUE}$(pwd)/$APK_PATH${NC}"
    echo -e "📦 Taille: ${BLUE}$APK_SIZE${NC}"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "${YELLOW}📲 Installation sur le téléphone:${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "Méthode 1 - Via USB:"
    echo -e "  ${BLUE}adb install $APK_PATH${NC}"
    echo ""
    echo "Méthode 2 - Copier le fichier:"
    echo "  1. Copier l'APK sur le téléphone"
    echo "  2. Ouvrir le fichier sur le téléphone"
    echo "  3. Autoriser l'installation depuis des sources inconnues"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
else
    echo ""
    echo -e "${RED}❌ ERREUR: L'APK n'a pas été créé${NC}"
    echo ""
    echo "Vérifiez les erreurs ci-dessus."
    exit 1
fi
