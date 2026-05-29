#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# Téléphonie CAP-EPAC — Rebuild complet sans cache
# ═══════════════════════════════════════════════════════════════
set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info() { echo -e "${GREEN}[INFO]${NC}  $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC}  $1"; }

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║     CAP-EPAC — Rebuild complet (sans cache)         ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════╝${NC}"
echo ""

# 1. Arrêter proprement
info "Arrêt des conteneurs..."
docker compose down --remove-orphans 2>/dev/null || true

# 2. Supprimer les images du projet (force rebuild)
info "Suppression des anciennes images..."
docker rmi telephonie-cap-epac-frontend telephonie-cap-epac-backend 2>/dev/null || true

# 3. Vérifier les fichiers audio et logo
info "Vérification des assets..."
if [ ! -f "frontend/public/sounds/ringtone.wav" ]; then
    warn "Sons manquants — génération..."
    mkdir -p frontend/public/sounds
    node - << 'JSEOF'
const fs = require('fs');
function generateWAV(freq1, freq2, durationMs, sampleRate = 8000) {
  const samples = Math.floor(sampleRate * durationMs / 1000);
  const buffer = Buffer.alloc(44 + samples * 2);
  buffer.write('RIFF', 0); buffer.writeUInt32LE(36 + samples * 2, 4);
  buffer.write('WAVE', 8); buffer.write('fmt ', 12); buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24); buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32); buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36); buffer.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++) {
    const t = i / sampleRate;
    const env = Math.min(1, t * 10) * Math.min(1, (durationMs/1000 - t) * 10);
    const s = (Math.sin(2*Math.PI*freq1*t)*0.4 + Math.sin(2*Math.PI*freq2*t)*0.4) * env;
    buffer.writeInt16LE(Math.max(-32768, Math.min(32767, s * 32767)), 44 + i * 2);
  }
  return buffer;
}
fs.writeFileSync('frontend/public/sounds/ringtone.wav', generateWAV(440, 480, 2000));
fs.writeFileSync('frontend/public/sounds/ringback.wav', generateWAV(350, 440, 1000));
console.log('Sons générés');
JSEOF
fi

if [ ! -f "frontend/public/logo.svg" ]; then
    warn "Logo manquant — création..."
    cat > frontend/public/logo.svg << 'SVGEOF'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
  <rect width="64" height="64" rx="16" fill="#16a34a"/>
  <path d="M20 20c0-2.2 1.8-4 4-4h2c2.2 0 4 1.8 4 4v4c0 2.2-1.8 4-4 4h-1c0 6 4.5 11 10.5 12v-1c0-2.2 1.8-4 4-4h4c2.2 0 4 1.8 4 4v2c0 2.2-1.8 4-4 4-13.2 0-24-10.8-24-24z" fill="white"/>
</svg>
SVGEOF
fi

info "Assets vérifiés ✅"
ls -la frontend/public/ frontend/public/sounds/ 2>/dev/null

# 4. Rebuild complet sans cache
info "Rebuild des images (sans cache)..."
docker compose build --no-cache

# 5. Démarrer
info "Démarrage des services..."
docker compose up -d

# 6. Attendre que tout soit prêt
info "Attente du démarrage (max 120s)..."
MAX=24; COUNT=0
until curl -sk "https://localhost/health" > /dev/null 2>&1; do
    COUNT=$((COUNT+1))
    if [ $COUNT -ge $MAX ]; then
        warn "Timeout — vérifiez: docker compose logs backend"
        break
    fi
    printf "."
    sleep 5
done
echo ""

# 7. Vérifier les conteneurs
echo ""
info "État des conteneurs :"
docker compose ps

SERVER_IP=$(grep SERVER_LAN_IP .env 2>/dev/null | cut -d= -f2 | tr -d ' ')
SERVER_IP="${SERVER_IP:-192.168.10.150}"

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║           CAP-EPAC — Rebuild terminé !              ║${NC}"
echo -e "${GREEN}╠══════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║${NC}  Application : https://$SERVER_IP"
echo -e "${GREEN}║${NC}  Backend     : https://$SERVER_IP/api/docs"
echo -e "${GREEN}╚══════════════════════════════════════════════════════╝${NC}"
echo ""
