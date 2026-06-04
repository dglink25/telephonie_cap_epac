#!/bin/bash

# Script pour installer l'APK et voir les logs en temps réel

echo "🔹 Installation de l'APK..."
adb install -r android/app/build/outputs/apk/release/app-release.apk

if [ $? -eq 0 ]; then
    echo "✅ APK installé avec succès!"
    echo ""
    echo "🔹 Démarrage des logs (Ctrl+C pour arrêter)..."
    echo "📱 Ouvrez l'app maintenant et allez dans une discussion avec une image"
    echo ""
    sleep 2
    
    # Suivre les logs en temps réel avec filtrage
    adb logcat | grep -E "\[Image\]|\[Avatar\]|getMediaUrl|ReactNativeJS|cap-epac"
else
    echo "❌ Échec de l'installation"
    exit 1
fi
