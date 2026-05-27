#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# CAP-EPAC Mobile — Script d'installation et démarrage
# Usage : bash setup.sh
# ═══════════════════════════════════════════════════════════════
set -e

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()  { echo -e "${GREEN}[INFO]${NC}  $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║        CAP-EPAC Mobile — Installation               ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════╝${NC}"
echo ""

# ── 1. Vérifications prérequis ────────────────────────────────
info "Vérification des prérequis..."

command -v node >/dev/null 2>&1 || error "Node.js non installé. Installer depuis https://nodejs.org"
command -v npm  >/dev/null 2>&1 || error "npm non installé"
command -v java >/dev/null 2>&1 || { warn "Java non détecté — Android natif ne compilera pas sans JDK 17"; }

NODE_VER=$(node --version | cut -d. -f1 | tr -d 'v')
if [ "$NODE_VER" -lt 18 ]; then
    error "Node.js 18+ requis (actuel: $(node --version))"
fi

info "Node.js: $(node --version) ✅"
info "npm: $(npm --version) ✅"

# ── 2. Vérifier ANDROID_HOME ──────────────────────────────────
if [ -z "$ANDROID_HOME" ]; then
    warn "ANDROID_HOME non défini."
    warn "Ajouter dans ~/.bashrc :"
    warn '  export ANDROID_HOME=$HOME/Android/Sdk'
    warn '  export PATH=$PATH:$ANDROID_HOME/platform-tools'
    warn '  export PATH=$PATH:$ANDROID_HOME/emulator'
    warn ""
    warn "Continuons quand même pour l'installation npm..."
fi

# ── 3. Configurer l'IP du serveur ─────────────────────────────
echo ""
info "Configuration du serveur CAP-EPAC"
echo -n "   Entrez l'IP LAN du serveur [192.168.100.195] : "
read -r SERVER_IP
SERVER_IP="${SERVER_IP:-192.168.100.195}"
info "IP serveur : $SERVER_IP"

# Remplacer l'IP dans api.ts et socket.ts
sed -i "s|https://192.168.100.195/api|https://${SERVER_IP}/api|g" src/services/api.ts
sed -i "s|https://192.168.100.195|https://${SERVER_IP}|g" src/services/socket.ts
sed -i "s|192.168.100.195|${SERVER_IP}|g" android/app/src/main/res/xml/network_security_config.xml

info "Fichiers de config mis à jour ✅"

# ── 4. Certificat CA SSL ──────────────────────────────────────
echo ""
info "Certificat SSL (pour connexion HTTPS au serveur LAN)"
warn "Le certificat CA du serveur doit être copié dans :"
warn "  android/app/src/main/res/raw/cap_epac_ca.pem"
echo ""
echo "   Récupérez-le via :"
echo "   curl -k http://${SERVER_IP}:8080/rootCA.pem -o android/app/src/main/res/raw/cap_epac_ca.pem"
echo ""
echo -n "   Télécharger automatiquement maintenant ? (o/N) : "
read -r DL_CA
if [ "$DL_CA" = "o" ] || [ "$DL_CA" = "O" ]; then
    if curl -fsk "http://${SERVER_IP}:8080/rootCA.pem" -o android/app/src/main/res/raw/cap_epac_ca.pem 2>/dev/null; then
        info "Certificat CA téléchargé ✅"
    else
        warn "Téléchargement échoué — copiez le fichier manuellement"
    fi
fi

# ── 5. Installation npm ───────────────────────────────────────
echo ""
info "Installation des dépendances npm..."
npm install

info "Dépendances installées ✅"

# ── 6. Keystore debug Android ────────────────────────────────
if [ -n "$ANDROID_HOME" ] && command -v keytool >/dev/null 2>&1; then
    if [ ! -f "android/app/debug.keystore" ]; then
        info "Génération du keystore de debug Android..."
        keytool -genkey -v \
            -keystore android/app/debug.keystore \
            -storepass android \
            -alias androiddebugkey \
            -keypass android \
            -keyalg RSA \
            -keysize 2048 \
            -validity 10000 \
            -dname "CN=Android Debug,O=Android,C=US" \
            2>/dev/null
        info "Keystore debug créé ✅"
    fi
fi

# ── 7. Résumé et instructions ─────────────────────────────────
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║           Installation terminée !                   ║${NC}"
echo -e "${GREEN}╠══════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║${NC}  Serveur : https://${SERVER_IP}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════╝${NC}"
echo ""
echo "  ┌─ Démarrage ───────────────────────────────────────────"
echo "  │"
echo "  │  1. Brancher l'appareil Android en USB"
echo "  │     (Activer débogage USB dans Options développeur)"
echo "  │"
echo "  │  2. Vérifier la connexion :"
echo "  │     adb devices"
echo "  │"
echo "  │  3. Lancer l'app :"
echo "  │     npx react-native run-android"
echo "  │"
echo "  │  ⚠️  NE PAS utiliser 'expo start' — ce projet est"
echo "  │     React Native CLI pur, pas Expo."
echo "  │"
echo "  └───────────────────────────────────────────────────────"
echo ""
echo "  Compte admin par défaut :"
echo "  • Identifiant : admin"
echo "  • Mot de passe : Admin@CapEpac2025"
echo ""
