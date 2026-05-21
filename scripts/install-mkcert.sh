#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# Installation de mkcert + génération CA de confiance LAN
# À exécuter UNE FOIS sur le serveur
# ═══════════════════════════════════════════════════════════════
set -e

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info() { echo -e "${GREEN}[INFO]${NC}  $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC}  $1"; }

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║    CAP-EPAC — Installation mkcert                   ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════╝${NC}"
echo ""

# Dépendances
info "Installation des dépendances..."
sudo apt-get update -qq
sudo apt-get install -y libnss3-tools curl

# Télécharger mkcert
ARCH=$(uname -m)
if [ "$ARCH" = "x86_64" ]; then
    MKCERT_URL="https://dl.filippo.io/mkcert/latest?for=linux/amd64"
elif [ "$ARCH" = "aarch64" ]; then
    MKCERT_URL="https://dl.filippo.io/mkcert/latest?for=linux/arm64"
else
    warn "Architecture non supportée: $ARCH"
    exit 1
fi

info "Téléchargement de mkcert..."
curl -fsSL "$MKCERT_URL" -o /tmp/mkcert
chmod +x /tmp/mkcert
sudo mv /tmp/mkcert /usr/local/bin/mkcert

info "mkcert installé : $(mkcert --version)"

# Créer et installer la CA racine
info "Création de la CA locale..."
mkcert -install

CAROOT=$(mkcert -CAROOT)
info "CA racine : $CAROOT/rootCA.pem"

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ✅ mkcert installé avec succès                     ║${NC}"
echo -e "${GREEN}╠══════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║  Relancez : bash scripts/start.sh                   ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════╝${NC}"
echo ""

# Instructions pour les autres machines
SERVER_IP=$(hostname -I | awk '{print $1}')
echo "══════════════════════════════════════════════════════"
echo "  Pour les autres machines du LAN :"
echo "  1. Copier nginx/ssl/rootCA.pem sur la machine client"
echo "  2. Importer dans le navigateur :"
echo "     Chrome : Paramètres → Sécurité → Gérer certificats → Importer"
echo "     Firefox: about:preferences#privacy → Voir certificats → Importer"
echo "     Android: Paramètres → Sécurité → Installer certificat"
echo "  3. Accéder à https://$SERVER_IP"
echo "══════════════════════════════════════════════════════"
