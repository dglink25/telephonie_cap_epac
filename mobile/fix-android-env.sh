#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# CAP-EPAC Mobile — Fixer ANDROID_HOME et lancer l'app
# ═══════════════════════════════════════════════════════════════

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()  { echo -e "${GREEN}[INFO]${NC}  $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║    CAP-EPAC Mobile — Configuration Android          ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════╝${NC}"
echo ""

# ── 1. Trouver ANDROID_HOME automatiquement ───────────────────
ANDROID_CANDIDATES=(
    "$HOME/Android/Sdk"
    "$HOME/android/sdk"
    "/opt/android-sdk"
    "/usr/local/lib/android/sdk"
    "$HOME/Library/Android/sdk"
)

FOUND_SDK=""
for candidate in "${ANDROID_CANDIDATES[@]}"; do
    if [ -d "$candidate/platform-tools" ]; then
        FOUND_SDK="$candidate"
        break
    fi
done

if [ -n "$FOUND_SDK" ]; then
    info "Android SDK trouvé : $FOUND_SDK"
    export ANDROID_HOME="$FOUND_SDK"
    export PATH="$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$ANDROID_HOME/tools"
else
    warn "Android SDK non trouvé automatiquement."
    warn "Ouvrez Android Studio → SDK Manager et notez le chemin."
    echo -n "   Chemin du SDK Android : "
    read -r ANDROID_HOME_INPUT
    if [ -d "$ANDROID_HOME_INPUT/platform-tools" ]; then
        FOUND_SDK="$ANDROID_HOME_INPUT"
        export ANDROID_HOME="$FOUND_SDK"
        export PATH="$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator"
    else
        error "Chemin invalide : $ANDROID_HOME_INPUT"
    fi
fi

# ── 2. Persister dans .bashrc ─────────────────────────────────
BASHRC="$HOME/.bashrc"
if ! grep -q "ANDROID_HOME" "$BASHRC" 2>/dev/null; then
    cat >> "$BASHRC" << ENVEOF

# Android SDK — CAP-EPAC Mobile
export ANDROID_HOME=$FOUND_SDK
export PATH=\$PATH:\$ANDROID_HOME/platform-tools:\$ANDROID_HOME/emulator:\$ANDROID_HOME/tools
ENVEOF
    info "ANDROID_HOME ajouté à ~/.bashrc ✅"
else
    info "ANDROID_HOME déjà dans ~/.bashrc ✅"
fi

# ── 3. Vérifier Java ──────────────────────────────────────────
if ! command -v java >/dev/null 2>&1; then
    warn "Java non trouvé. Installation de JDK 17..."
    sudo apt-get install -y openjdk-17-jdk 2>/dev/null || \
    sudo pacman -S jdk17-openjdk 2>/dev/null || \
    warn "Installer manuellement : sudo apt install openjdk-17-jdk"
else
    JAVA_VER=$(java -version 2>&1 | head -1)
    info "Java : $JAVA_VER ✅"
fi

# ── 4. Vérifier adb ──────────────────────────────────────────
if command -v adb >/dev/null 2>&1; then
    info "adb disponible ✅"
    info "Appareils connectés :"
    adb devices
else
    warn "adb non trouvé. Ajouter platform-tools au PATH."
fi

# ── 5. Rendre gradlew exécutable ─────────────────────────────
if [ -f "android/gradlew" ]; then
    chmod +x android/gradlew
    info "android/gradlew → exécutable ✅"
else
    error "android/gradlew introuvable — êtes-vous dans le dossier mobile ?"
fi

# ── 6. Vérifier l'appareil branché ───────────────────────────
echo ""
DEVICES=$(adb devices 2>/dev/null | grep -v "List of" | grep "device$" | wc -l)
if [ "$DEVICES" -gt 0 ]; then
    info "$DEVICES appareil(s) Android détecté(s) ✅"
else
    warn "Aucun appareil détecté."
    warn "  → Brancher le TECNO KI5k en USB"
    warn "  → Activer Débogage USB : Paramètres → Options développeur → Débogage USB"
    warn "  → Appuyer sur 'Autoriser' sur l'appareil quand demandé"
    echo ""
    echo "  Après connexion, relancer : adb devices"
fi

# ── 7. Lancer l'app ──────────────────────────────────────────
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  Prêt à lancer !                                    ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════╝${NC}"
echo ""

echo -n "   Lancer npx react-native run-android maintenant ? (O/n) : "
read -r LAUNCH
if [ "$LAUNCH" != "n" ] && [ "$LAUNCH" != "N" ]; then
    info "Lancement de Metro bundler + compilation Android..."
    echo ""
    npx react-native run-android
else
    echo ""
    info "Pour lancer manuellement :"
    echo "   npx react-native run-android"
fi
