#!/bin/bash

echo "🔄 Rebuild rapide après correction IP"
echo "====================================="
echo ""

echo "Configuration actuelle:"
echo "  - API: http://10.73.47.159"
echo "  - Socket: http://10.73.47.159"
echo ""

echo "1️⃣  Nettoyage du cache Metro..."
rm -rf $TMPDIR/react-* 2>/dev/null || true
rm -rf $TMPDIR/metro-* 2>/dev/null || true

echo "2️⃣  Clean build Android..."
cd android
./gradlew clean > /dev/null 2>&1
cd ..

echo "3️⃣  Redémarrage avec cache reset..."
echo ""
echo "   Exécutez maintenant:"
echo "   Terminal 1: npx react-native start --reset-cache"
echo "   Terminal 2: npx react-native run-android"
echo ""
echo "✅ Prêt à rebuild!"
