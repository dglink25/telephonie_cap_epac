#!/bin/bash

echo "======================================"
echo "🔍 Debug Images - CAP EPAC Mobile"
echo "======================================"
echo ""
echo "Installation de l'APK..."
adb install -r android/app/build/outputs/apk/release/app-release.apk

echo ""
echo "======================================"
echo "📱 Logs en temps réel..."
echo "======================================"
echo ""
echo "Filtrage des logs pour 'Image', 'getMediaUrl', 'Avatar'..."
echo ""

# Filtrer les logs pour voir uniquement ce qui concerne les images
adb logcat -c  # Clear les logs précédents
adb logcat | grep -E '\[Image\]|\[Avatar\]|getMediaUrl|ReactNativeJS'
