#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# Téléphonie CAP-EPAC — Génération certificats SSL de confiance
# Utilise mkcert pour créer une CA locale reconnue par les navigateurs
# ═══════════════════════════════════════════════════════════════
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
SSL_DIR="$PROJECT_DIR/nginx/ssl"
SERVER_IP="${1:-$(grep SERVER_LAN_IP "$PROJECT_DIR/.env" 2>/dev/null | cut -d= -f2 | tr -d ' ')}"
SERVER_IP="${SERVER_IP:-192.168.1.10}"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()  { echo -e "${GREEN}[INFO]${NC}  $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║    CAP-EPAC — Génération Certificats SSL LAN        ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════╝${NC}"
echo ""
info "IP du serveur LAN : $SERVER_IP"
mkdir -p "$SSL_DIR"

# ── Essayer mkcert en premier (certificat de confiance) ──────────
if command -v mkcert >/dev/null 2>&1; then
  info "mkcert détecté — génération d'un certificat de confiance..."

  # Installer la CA locale dans le système
  mkcert -install 2>/dev/null || warn "Installation CA système ignorée (peut nécessiter sudo)"

  cd "$SSL_DIR"
  mkcert \
    -key-file  key.pem \
    -cert-file cert.pem \
    "$SERVER_IP" \
    "localhost" \
    "127.0.0.1" \
    "cap-epac.local" \
    "*.cap-epac.local" 2>/dev/null

  # Copier la CA racine pour distribution
  CAROOT=$(mkcert -CAROOT 2>/dev/null)
  if [ -n "$CAROOT" ] && [ -f "$CAROOT/rootCA.pem" ]; then
    cp "$CAROOT/rootCA.pem" "$SSL_DIR/rootCA.pem"
    info "CA racine copiée : $SSL_DIR/rootCA.pem"
    echo ""
    echo -e "${GREEN}╔══════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║  ✅ CERTIFICAT DE CONFIANCE GÉNÉRÉ (mkcert)         ║${NC}"
    echo -e "${GREEN}║  Les navigateurs accepteront ce certificat           ║${NC}"
    echo -e "${GREEN}║  sans avertissement sur cette machine.               ║${NC}"
    echo -e "${GREEN}╠══════════════════════════════════════════════════════╣${NC}"
    echo -e "${GREEN}║  Pour les AUTRES machines du LAN :                  ║${NC}"
    echo -e "${GREEN}║  Importer nginx/ssl/rootCA.pem dans le navigateur   ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════════╝${NC}"
  fi

else
  warn "mkcert non installé — utilisation d'OpenSSL auto-signé"
  warn "Les navigateurs afficheront un avertissement SSL."
  warn "Pour une meilleure expérience, installez mkcert :"
  warn "  sudo apt install libnss3-tools"
  warn "  curl -L https://dl.filippo.io/mkcert/latest?for=linux/amd64 -o mkcert"
  warn "  chmod +x mkcert && sudo mv mkcert /usr/local/bin/"
  warn "  Puis relancez ce script."
  echo ""

  # Fallback OpenSSL avec SAN correctement défini
  cat > /tmp/cap-epac-ssl.conf << SSLCONF
[req]
default_bits       = 2048
prompt             = no
default_md         = sha256
distinguished_name = dn
req_extensions     = req_ext
x509_extensions    = v3_req

[dn]
C  = BJ
ST = Littoral
L  = Cotonou
O  = CAP-EPAC
OU = IT
CN = cap-epac.local

[req_ext]
subjectAltName = @alt_names

[v3_req]
subjectAltName = @alt_names
keyUsage = critical, digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth
basicConstraints = CA:FALSE

[alt_names]
IP.1  = $SERVER_IP
IP.2  = 127.0.0.1
DNS.1 = localhost
DNS.2 = cap-epac.local
DNS.3 = *.cap-epac.local
SSLCONF

  openssl req -x509 -newkey rsa:2048 -nodes \
    -keyout "$SSL_DIR/key.pem" \
    -out    "$SSL_DIR/cert.pem" \
    -days   3650 \
    -config /tmp/cap-epac-ssl.conf

  rm -f /tmp/cap-epac-ssl.conf
fi

chmod 600 "$SSL_DIR/key.pem"
chmod 644 "$SSL_DIR/cert.pem"

info "✅ Certificats générés :"
info "   Clé      : $SSL_DIR/key.pem"
info "   Certific : $SSL_DIR/cert.pem"
echo ""
