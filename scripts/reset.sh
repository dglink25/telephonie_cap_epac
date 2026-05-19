#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# Téléphonie CAP-EPAC — Réinitialisation complète
# ═══════════════════════════════════════════════════════════════
set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

echo ""
echo "⚠️  ATTENTION : Cette action va :"
echo "   - Arrêter tous les conteneurs"
echo "   - Supprimer tous les volumes Docker (données MySQL, Redis)"
echo "   - Supprimer les certificats SSL"
echo "   - Réinitialiser la base de données"
echo ""
read -p "Confirmer la réinitialisation ? (oui/non) : " CONFIRM

if [ "$CONFIRM" != "oui" ]; then
    echo "Annulé."
    exit 0
fi

echo ""
echo "→ Arrêt et suppression des conteneurs..."
docker compose down -v --remove-orphans 2>/dev/null || true

echo "→ Suppression des certificats SSL..."
rm -f nginx/ssl/cert.pem nginx/ssl/key.pem

echo "→ Suppression des uploads..."
rm -rf backend/uploads/* 2>/dev/null || true

echo ""
echo "✅ Réinitialisation terminée."
echo "   Relancez avec : bash scripts/start.sh"
echo ""
