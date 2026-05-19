#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# Téléphonie CAP-EPAC — Génération certificats SSL auto-signés LAN
# ═══════════════════════════════════════════════════════════════
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
SSL_DIR="$PROJECT_DIR/nginx/ssl"

# Récupérer l'IP du serveur depuis .env ou argument
SERVER_IP="${1:-$(grep SERVER_LAN_IP "$PROJECT_DIR/.env" 2>/dev/null | cut -d= -f2 | tr -d ' ')}"
SERVER_IP="${SERVER_IP:-192.168.1.10}"

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║    CAP-EPAC — Génération Certificats SSL LAN        ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
echo "  IP du serveur LAN : $SERVER_IP"
echo "  Répertoire SSL    : $SSL_DIR"
echo ""

mkdir -p "$SSL_DIR"

# Générer la clé privée
echo "→ Génération de la clé privée (RSA 2048)..."
openssl genrsa -out "$SSL_DIR/key.pem" 2048

# Générer le certificat auto-signé
echo "→ Génération du certificat auto-signé..."
openssl req -new -x509 \
    -key "$SSL_DIR/key.pem" \
    -out "$SSL_DIR/cert.pem" \
    -days 3650 \
    -subj "/C=BJ/ST=Littoral/L=Cotonou/O=CAP-EPAC/OU=IT/CN=cap-epac.local" \
    -addext "subjectAltName=IP:$SERVER_IP,IP:127.0.0.1,DNS:localhost,DNS:cap-epac.local"

# Protéger les fichiers
chmod 600 "$SSL_DIR/key.pem"
chmod 644 "$SSL_DIR/cert.pem"

echo ""
echo "✅ Certificats générés avec succès !"
echo "   • Clé privée  : $SSL_DIR/key.pem"
echo "   • Certificat  : $SSL_DIR/cert.pem"
echo "   • Validité    : 10 ans"
echo "   • IP couverte : $SERVER_IP"
echo ""
echo "⚠️  Pour éviter l'avertissement du navigateur :"
echo "   Importez '$SSL_DIR/cert.pem' dans les autorités de"
echo "   certification de chaque navigateur sur le LAN."
echo ""
