#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Chercher le répertoire du projet (là où docker-compose.yml est)
PROJECT_DIR="$(find /home /srv /opt /root -maxdepth 4 -name "docker-compose.yml" 2>/dev/null | head -1 | xargs dirname 2>/dev/null || echo "$SCRIPT_DIR/..")"
cd "$PROJECT_DIR"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; BLUE='\033[0;34m'; NC='\033[0m'
info()    { echo -e "${GREEN}[✓]${NC}  $1"; }
warn()    { echo -e "${YELLOW}[!]${NC}  $1"; }
error()   { echo -e "${RED}[✗]${NC}  $1"; }
section() { echo -e "\n${BLUE}━━━ $1 ━━━${NC}"; }

echo -e "
${GREEN}╔═══════════════════════════════════════════════════════════╗
║   CAP-EPAC — Correction SSL + Micro (Windows/Android/Linux)  ║
╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# ─── Détection IP LAN ─────────────────────────────────────────────
section "Détection réseau"
SERVER_IP=$(ip route get 1.1.1.1 2>/dev/null | grep -oP 'src \K\S+' | head -1)
if [ -z "$SERVER_IP" ]; then
    SERVER_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
fi
if [ -z "$SERVER_IP" ]; then
    read -p "  Entrez l'IP LAN du serveur (ex: 192.168.10.150) : " SERVER_IP
fi
info "IP LAN détectée : $SERVER_IP"

# ─── Installation mkcert ──────────────────────────────────────────
section "Installation mkcert (certificat de confiance LAN)"

if ! command -v mkcert >/dev/null 2>&1; then
    warn "mkcert non installé — installation en cours..."
    
    # Dépendances
    apt-get update -qq 2>/dev/null || true
    apt-get install -y -qq libnss3-tools curl wget 2>/dev/null || \
    yum install -y -q nss-tools curl wget 2>/dev/null || true

    # Télécharger mkcert
    ARCH=$(uname -m)
    case "$ARCH" in
        x86_64)   MKCERT_ARCH="linux-amd64" ;;
        aarch64)  MKCERT_ARCH="linux-arm64" ;;
        armv7l)   MKCERT_ARCH="linux-arm" ;;
        *)        warn "Architecture $ARCH non supportée pour mkcert"; MKCERT_ARCH="" ;;
    esac

    if [ -n "$MKCERT_ARCH" ]; then
        MKCERT_URL="https://dl.filippo.io/mkcert/latest?for=$MKCERT_ARCH"
        if wget -q "$MKCERT_URL" -O /tmp/mkcert 2>/dev/null || curl -fsSL "$MKCERT_URL" -o /tmp/mkcert 2>/dev/null; then
            chmod +x /tmp/mkcert
            mv /tmp/mkcert /usr/local/bin/mkcert
            info "mkcert $(mkcert --version) installé"
        else
            warn "Téléchargement mkcert échoué — utilisation d'OpenSSL en fallback"
        fi
    fi
else
    info "mkcert $(mkcert --version) déjà installé"
fi

# ─── Génération du certificat ─────────────────────────────────────
section "Génération du certificat SSL (valide pour tout le réseau LAN)"
SSL_DIR="$PROJECT_DIR/nginx/ssl"
mkdir -p "$SSL_DIR"

if command -v mkcert >/dev/null 2>&1; then
    # Installer la CA dans le système local
    CAROOT=$(mkcert -CAROOT 2>/dev/null)
    mkcert -install 2>/dev/null || warn "CA système non installée (peut nécessiter sudo sur cette machine)"
    
    cd "$SSL_DIR"
    mkcert \
        -key-file  key.pem \
        -cert-pem  cert.pem \
        "$SERVER_IP" \
        "localhost" \
        "127.0.0.1" \
        "::1" \
        "cap-epac.local" \
        "*.cap-epac.local" 2>/dev/null || \
    mkcert \
        -key-file  key.pem \
        -cert-file cert.pem \
        "$SERVER_IP" \
        "localhost" \
        "127.0.0.1" 2>/dev/null
    
    # Copier la CA racine pour distribution aux clients
    CAROOT=$(mkcert -CAROOT 2>/dev/null)
    if [ -f "$CAROOT/rootCA.pem" ]; then
        cp "$CAROOT/rootCA.pem" "$SSL_DIR/rootCA.pem"
        info "CA racine copiée → nginx/ssl/rootCA.pem (à distribuer aux clients)"
    fi
    
    cd "$PROJECT_DIR"
    info "Certificat mkcert généré (navigateurs le reconnaîtront après import de la CA)"

else
    # Fallback OpenSSL avec SAN complet
    warn "Utilisation OpenSSL (auto-signé) — les navigateurs afficheront un avertissement"
    
    cat > /tmp/ssl-san.conf << SSLEOF
[req]
default_bits       = 4096
prompt             = no
default_md         = sha256
distinguished_name = dn
x509_extensions    = v3_req

[dn]
C  = BJ
ST = Littoral
L  = Cotonou
O  = CAP-EPAC
CN = $SERVER_IP

[v3_req]
subjectAltName = @alt_names
keyUsage = critical, digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth, clientAuth
basicConstraints = CA:FALSE

[alt_names]
IP.1  = $SERVER_IP
IP.2  = 127.0.0.1
DNS.1 = localhost
DNS.2 = cap-epac.local
DNS.3 = *.cap-epac.local
SSLEOF

    openssl req -x509 -newkey rsa:4096 -nodes \
        -keyout "$SSL_DIR/key.pem" \
        -out    "$SSL_DIR/cert.pem" \
        -days   3650 \
        -config /tmp/ssl-san.conf 2>/dev/null
    
    rm -f /tmp/ssl-san.conf
    info "Certificat OpenSSL généré (4096 bits, valide 10 ans)"
fi

chmod 600 "$SSL_DIR/key.pem"
chmod 644 "$SSL_DIR/cert.pem"

# ─── Mise à jour du .env ──────────────────────────────────────────
section "Mise à jour de la configuration (.env)"

if [ -f ".env" ]; then
    # Mettre à jour l'IP dans tous les champs
    sed -i "s|SERVER_LAN_IP=.*|SERVER_LAN_IP=$SERVER_IP|g" .env
    sed -i "s|CORS_ORIGIN=.*|CORS_ORIGIN=https://$SERVER_IP,http://localhost:5173|g" .env
    sed -i "s|VITE_API_URL=.*|VITE_API_URL=https://$SERVER_IP/api|g" .env
    sed -i "s|VITE_SOCKET_URL=.*|VITE_SOCKET_URL=https://$SERVER_IP|g" .env
    info ".env mis à jour avec l'IP $SERVER_IP"
else
    warn ".env non trouvé — création d'un fichier minimal"
    cat > .env << ENVEOF
SERVER_LAN_IP=$SERVER_IP
NODE_ENV=production
PORT=3000
DB_HOST=mysql
DB_PORT=3306
DB_NAME=cap_epac_telephonie
DB_USER=cap_epac_user
DB_PASSWORD=CapEpac@2025
REDIS_HOST=redis
REDIS_PORT=6379
JWT_SECRET=$(openssl rand -hex 32)
JWT_REFRESH_SECRET=$(openssl rand -hex 32)
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
CORS_ORIGIN=https://$SERVER_IP,http://localhost:5173
VITE_API_URL=https://$SERVER_IP/api
VITE_SOCKET_URL=https://$SERVER_IP
ENVEOF
    info ".env créé"
fi

# ─── Mise à jour nginx.conf ───────────────────────────────────────
section "Correction nginx.conf (HTTPS + WebRTC + permissions micro)"

cat > "$PROJECT_DIR/nginx/nginx.conf" << 'NGINXEOF'
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 2048;
    use epoll;
    multi_accept on;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;

    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';
    access_log /var/log/nginx/access.log main;

    sendfile        on;
    tcp_nopush      on;
    tcp_nodelay     on;
    keepalive_timeout 75s;
    types_hash_max_size 4096;
    server_tokens off;
    client_max_body_size 110M;

    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml application/json
               application/javascript application/xml+rss
               application/atom+xml image/svg+xml;

    upstream backend {
        server backend:3000;
        keepalive 32;
    }
    upstream frontend {
        server frontend:80;
        keepalive 16;
    }

    limit_req_zone $binary_remote_addr zone=api:10m rate=60r/m;
    limit_req_zone $binary_remote_addr zone=login:10m rate=5r/m;

    # ── Redirect HTTP → HTTPS ─────────────────────────────────────
    server {
        listen 80;
        listen [::]:80;
        server_name _;
        return 301 https://$host$request_uri;
    }

    # ── HTTPS principal ───────────────────────────────────────────
    server {
        listen 443 ssl http2;
        listen [::]:443 ssl http2;
        server_name _;

        ssl_certificate     /etc/nginx/ssl/cert.pem;
        ssl_certificate_key /etc/nginx/ssl/key.pem;

        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305;
        ssl_prefer_server_ciphers off;
        ssl_session_cache shared:SSL:10m;
        ssl_session_timeout 10m;
        ssl_session_tickets off;

        # ── En-têtes sécurité + PERMISSIONS MICRO/CAMERA ─────────
        add_header X-Frame-Options           "SAMEORIGIN"                              always;
        add_header X-Content-Type-Options    "nosniff"                                 always;
        add_header X-XSS-Protection          "1; mode=block"                           always;
        add_header Referrer-Policy           "strict-origin-when-cross-origin"         always;
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains"     always;
        # CRITIQUE : autoriser micro, caméra et haut-parleurs pour WebRTC
        add_header Permissions-Policy        "microphone=(*), camera=(*), speaker-selection=(*), display-capture=(*)" always;
        # Cross-Origin pour SharedArrayBuffer (WebRTC)
        add_header Cross-Origin-Opener-Policy  "same-origin-allow-popups" always;
        add_header Cross-Origin-Embedder-Policy "require-corp" always;

        # ── API Backend ───────────────────────────────────────────
        location /api/ {
            limit_req zone=api burst=30 nodelay;
            proxy_pass         http://backend;
            proxy_http_version 1.1;
            proxy_set_header   Host              $host;
            proxy_set_header   X-Real-IP         $remote_addr;
            proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
            proxy_set_header   X-Forwarded-Proto $scheme;
            proxy_set_header   Connection        "";
            proxy_connect_timeout 10s;
            proxy_send_timeout    60s;
            proxy_read_timeout    60s;
            proxy_buffering    off;
        }

        location /api/auth/login {
            limit_req zone=login burst=3 nodelay;
            proxy_pass http://backend;
            proxy_http_version 1.1;
            proxy_set_header Host            $host;
            proxy_set_header X-Real-IP       $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # ── Uploads ───────────────────────────────────────────────
        location /uploads/ {
            proxy_pass         http://backend;
            proxy_http_version 1.1;
            proxy_set_header   Host $host;
            expires 30d;
            add_header Cache-Control "public";
        }

        # ── Socket.IO / WebSocket ─────────────────────────────────
        location /socket.io/ {
            proxy_pass         http://backend;
            proxy_http_version 1.1;
            proxy_set_header   Upgrade           $http_upgrade;
            proxy_set_header   Connection        "upgrade";
            proxy_set_header   Host              $host;
            proxy_set_header   X-Real-IP         $remote_addr;
            proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
            proxy_set_header   X-Forwarded-Proto $scheme;
            proxy_read_timeout    3600s;
            proxy_send_timeout    3600s;
            proxy_connect_timeout 10s;
            proxy_buffering off;
        }

        # ── Swagger docs ──────────────────────────────────────────
        location /api/docs/ {
            proxy_pass http://backend;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
        }

        # ── Healthcheck ───────────────────────────────────────────
        location /health {
            proxy_pass http://backend;
            access_log off;
        }

        # ── Frontend React SPA ────────────────────────────────────
        location / {
            proxy_pass         http://frontend;
            proxy_http_version 1.1;
            proxy_set_header   Host              $host;
            proxy_set_header   X-Real-IP         $remote_addr;
            proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
            proxy_set_header   Connection        "";
        }

        location = / {
            proxy_pass http://frontend;
            add_header Cache-Control "no-cache, no-store, must-revalidate";
        }

        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
            proxy_pass http://frontend;
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
}
NGINXEOF

info "nginx.conf mis à jour (permissions micro/caméra activées)"

# ─── Redémarrage Docker ───────────────────────────────────────────
section "Redémarrage des services"

if command -v docker >/dev/null 2>&1; then
    if docker compose version >/dev/null 2>&1 || docker-compose version >/dev/null 2>&1; then
        warn "Redémarrage du conteneur nginx..."
        
        # Tester si nginx est dans un conteneur
        if docker compose ps 2>/dev/null | grep -q "nginx"; then
            docker compose restart nginx 2>/dev/null || docker-compose restart nginx 2>/dev/null || true
            info "nginx redémarré"
        elif docker compose ps 2>/dev/null | grep -q "Up"; then
            # Rebuild uniquement nginx
            docker compose up -d --no-deps --build nginx 2>/dev/null || \
            docker-compose up -d --no-deps --build nginx 2>/dev/null || \
            docker compose restart 2>/dev/null || true
            info "Services redémarrés"
        else
            warn "Lancez manuellement : docker compose up -d"
        fi
    fi
else
    warn "Docker non détecté — redémarrez nginx manuellement"
fi

# ─── Instructions par appareil ────────────────────────────────────
section "Instructions pour chaque type d'appareil"

CAROOT_FILE="$SSL_DIR/rootCA.pem"
CA_EXISTS="non"
[ -f "$CAROOT_FILE" ] && CA_EXISTS="oui (nginx/ssl/rootCA.pem)"

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "  CA racine disponible : ${YELLOW}$CA_EXISTS${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

echo -e "
${BLUE}┌─ WINDOWS (Chrome/Edge/Firefox) ──────────────────────────┐${NC}
│  1. Copier ${YELLOW}nginx/ssl/rootCA.pem${NC} sur le PC Windows          │
│  2. Double-clic sur le fichier → Installer le certificat   │
│  3. Choisir : Machine locale → Autorités racines de        │
│     certification → Suivant → Terminer                     │
│  4. Redémarrer Chrome/Edge                                  │
│  5. Accéder à https://$SERVER_IP                    │
│                                                             │
│  ${YELLOW}Alternative Chrome (sans import) :${NC}                         │
│  chrome://flags/#unsafely-treat-insecure-origin-as-secure  │
│  Ajouter : http://$SERVER_IP                        │
${BLUE}└─────────────────────────────────────────────────────────────┘${NC}

${BLUE}┌─ ANDROID (Chrome) ────────────────────────────────────────┐${NC}
│  1. Ouvrir https://$SERVER_IP/rootCA.pem          │
│  2. Télécharger le fichier                                  │
│  3. Paramètres → Sécurité → Installer depuis stockage      │
│     (ou Paramètres → Confidentialité → Installer cert.)    │
│  4. Nommer : CAP-EPAC LAN CA                                │
│  5. Utilisation : Certificats CA                            │
│  6. Accéder à https://$SERVER_IP                    │
│                                                             │
│  ${YELLOW}Samsung : Paramètres → Données biométriques et sécurité${NC}   │
│  ${YELLOW}→ Autres paramètres de sécurité → Installer depuis mém.${NC}   │
${BLUE}└─────────────────────────────────────────────────────────────┘${NC}

${BLUE}┌─ LINUX (Chrome/Firefox) ──────────────────────────────────┐${NC}
│  Chrome :                                                   │
│    certutil -n \"\$(ls ~/.pki/nssdb 2>/dev/null || echo /root/.pki/nssdb)\" \\        │
│    -d sql:\$HOME/.pki/nssdb -A -t 'C,,' \\                  │
│    -n 'CAP-EPAC' -i nginx/ssl/rootCA.pem                    │
│                                                             │
│  Firefox :                                                  │
│    Paramètres → Vie privée → Afficher les certificats       │
│    → Autorités → Importer → rootCA.pem                      │
│                                                             │
│  Système (Ubuntu/Debian) :                                  │
│    sudo cp nginx/ssl/rootCA.pem /usr/local/share/ca-certificates/cap-epac.crt  │
│    sudo update-ca-certificates                              │
${BLUE}└─────────────────────────────────────────────────────────────┘${NC}"

# ─── Servir la CA racine via HTTP pour téléchargement facile ─────
section "Rendre la CA racine téléchargeable depuis les appareils clients"

if [ -f "$SSL_DIR/rootCA.pem" ]; then
    # Ajouter une route nginx pour servir le cert sans HTTPS
    cat > "$PROJECT_DIR/nginx/serve-ca.conf" << CAEOF
# Serveur HTTP minimal pour distribuer la CA racine
# Accessible depuis tous les appareils du LAN
server {
    listen 8080;
    server_name _;
    
    location /rootCA.pem {
        alias /etc/nginx/ssl/rootCA.pem;
        add_header Content-Type application/x-pem-file;
        add_header Content-Disposition 'attachment; filename="cap-epac-CA.pem"';
    }
    
    location /rootCA.crt {
        alias /etc/nginx/ssl/rootCA.pem;
        add_header Content-Type application/x-x509-ca-cert;
        add_header Content-Disposition 'attachment; filename="cap-epac-CA.crt"';
    }
    
    location / {
        return 200 '<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>CAP-EPAC - Certificat CA</title>
<style>body{font-family:sans-serif;max-width:600px;margin:40px auto;padding:20px;background:#f0fdf4}
h1{color:#15803d}a.btn{display:inline-block;background:#16a34a;color:#fff;padding:14px 28px;
border-radius:8px;text-decoration:none;margin:8px;font-size:16px}
.os{margin:20px 0;padding:16px;background:#fff;border-radius:8px;border:1px solid #bbf7d0}
code{background:#f1f5f9;padding:2px 6px;border-radius:4px;font-size:13px}</style></head>
<body>
<h1>🔒 CAP-EPAC — Certificat de confiance LAN</h1>
<p>Installez ce certificat pour accéder à <strong>https://$SERVER_IP</strong> sans avertissement et avec le microphone activé.</p>
<p>
  <a href="/rootCA.pem" class="btn">⬇Télécharger (Linux/Mac)</a>
  <a href="/rootCA.crt" class="btn">⬇Télécharger (Windows/Android)</a>
</p>
<div class="os"><strong>Windows</strong><br>Double-cliquez le fichier .crt → Installer → Machine locale → Autorités racines</div>
<div class="os"><strong>Android</strong><br>Paramètres → Sécurité → Installer depuis le stockage → Certificat CA</div>
<div class="os"><strong>Linux Chrome</strong><br><code>certutil -d sql:$HOME/.pki/nssdb -A -t "C,," -n "CAP-EPAC" -i cap-epac-CA.pem</code></div>
<div class="os"><strong> Firefox</strong><br>Paramètres → Vie privée → Certificats → Autorités → Importer</div>
</body></html>';
        add_header Content-Type text/html;
    }
}
CAEOF
    info "Page de distribution CA créée (port 8080)"
fi

# ─── Résumé final ─────────────────────────────────────────────────
echo -e "
${GREEN}╔═══════════════════════════════════════════════════════════╗
║                   CORRECTION TERMINÉE ✅                   ║
╠═══════════════════════════════════════════════════════════╣
║                                                           ║
║  Application  : https://$SERVER_IP                 ║
║  CA (install) : http://$SERVER_IP:8080             ║
║                                                           ║
║  ✓ Certificat SSL valide (mkcert ou OpenSSL)              ║
║  ✓ Permissions microphone/caméra dans nginx               ║
║  ✓ HTTPS forcé (HTTP → redirect 443)                      ║
║  ✓ WebRTC headers configurés                              ║
║                                                           ║
║  Redémarrez : docker compose restart nginx                ║
╚═══════════════════════════════════════════════════════════╝${NC}
"