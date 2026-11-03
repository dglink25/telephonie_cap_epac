#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
//  CAP-EPAC — WireGuard Agent (Node.js HTTP sur l'hôte)
//  Écoute sur 0.0.0.0:51821
//  Appelé par le backend Docker via host.docker.internal:51821
//
//  Usage : sudo node wg-agent.js
//  Installer : sudo bash vpn/wg-agent.sh --install
// ═══════════════════════════════════════════════════════════════

const http = require('http');
const { execSync } = require('child_process');
const fs   = require('fs');
const path = require('path');

const PORT       = 51821;
const WG_CONF    = '/etc/wireguard/wg0.conf';
const CLIENT_DIR = '/etc/wireguard/clients';
const VPN_SUBNET = '10.8.0';

// ── Helpers ──────────────────────────────────────────────────
const wgAvailable = () => {
  try { execSync('which wg', { stdio: 'pipe' }); return true; }
  catch { return false; }
};

const serverPubKey = () => {
  try { return fs.readFileSync('/etc/wireguard/server_public.key', 'utf8').trim(); }
  catch { return null; }
};

const nextClientIp = () => {
  if (!fs.existsSync(WG_CONF)) return `${VPN_SUBNET}.2`;
  const conf = fs.readFileSync(WG_CONF, 'utf8');
  const ips  = [...conf.matchAll(/AllowedIPs\s*=\s*10\.8\.0\.(\d+)/g)]
    .map((m) => parseInt(m[1]));
  return `${VPN_SUBNET}.${(ips.length ? Math.max(...ips) : 1) + 1}`;
};

const json = (res, status, data) => {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type':   'application/json',
    'Content-Length': Buffer.byteLength(body),
    'Access-Control-Allow-Origin': '*',
  });
  res.end(body);
};

const readBody = (req) => new Promise((resolve) => {
  let data = '';
  req.on('data', (c) => { data += c; });
  req.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({}); } });
});

// ── Serveur HTTP ─────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const { method, url } = req;
  console.log(`[wg-agent] ${method} ${url}`);

  // OPTIONS (CORS preflight)
  if (method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,DELETE' });
    return res.end();
  }

  // GET /status
  if (method === 'GET' && url === '/status') {
    let running = false;
    try { execSync('wg show wg0', { stdio: 'pipe' }); running = true; } catch {}
    return json(res, 200, {
      available:    wgAvailable(),
      configured:   fs.existsSync(WG_CONF),
      running,
      serverPubKey: serverPubKey(),
    });
  }

  // GET /clients
  if (method === 'GET' && url === '/clients') {
    if (!fs.existsSync(CLIENT_DIR)) return json(res, 200, { clients: [] });
    const files   = fs.readdirSync(CLIENT_DIR).filter((f) => f.endsWith('.conf'));
    const clients = files.map((f) => {
      const userId  = f.replace('user_', '').replace('.conf', '');
      const conf    = fs.readFileSync(path.join(CLIENT_DIR, f), 'utf8');
      const ipMatch = conf.match(/Address\s*=\s*([\d.]+)/);
      return { userId, ip: ipMatch?.[1] || '?' };
    });
    return json(res, 200, { clients });
  }

  // POST /generate
  if (method === 'POST' && url === '/generate') {
    if (!wgAvailable()) {
      return json(res, 503, { error: 'WireGuard non disponible' });
    }
    if (!fs.existsSync(WG_CONF)) {
      return json(res, 503, { error: 'WireGuard non configuré — lancer setup-wireguard.sh' });
    }

    const body     = await readBody(req);
    const userId   = body.userId   || 'unknown';
    const username = body.username || 'user';
    const endpoint = body.endpoint || '192.168.10.139';

    fs.mkdirSync(CLIENT_DIR, { recursive: true });
    const confFile = path.join(CLIENT_DIR, `user_${userId}.conf`);

    // Config existante → la retourner directement
    if (fs.existsSync(confFile)) {
      const config = fs.readFileSync(confFile, 'utf8');
      return json(res, 200, { config, existed: true });
    }

    // Générer nouvelles clés
    const clientPriv = execSync('wg genkey',         { stdio: 'pipe' }).toString().trim();
    const clientPub  = execSync(`echo "${clientPriv}" | wg pubkey`, { stdio: 'pipe' }).toString().trim();
    const clientPsk  = execSync('wg genpsk',         { stdio: 'pipe' }).toString().trim();
    const clientIp   = nextClientIp();
    const serverPub  = serverPubKey();

    const config = [
      '[Interface]',
      `PrivateKey = ${clientPriv}`,
      `Address = ${clientIp}/32`,
      'DNS = 8.8.8.8',
      '',
      '[Peer]',
      `PublicKey = ${serverPub}`,
      `PresharedKey = ${clientPsk}`,
      `Endpoint = ${endpoint}:51820`,
      `AllowedIPs = ${VPN_SUBNET}.0/24, 192.168.10.0/24`,
      'PersistentKeepalive = 25',
    ].join('\n');

    // Sauvegarder
    fs.writeFileSync(confFile, config, { mode: 0o600 });

    // Ajouter dans wg0.conf
    fs.appendFileSync(WG_CONF,
      `\n# Client: ${username} (${userId}) — ${clientIp}\n[Peer]\nPublicKey = ${clientPub}\nPresharedKey = ${clientPsk}\nAllowedIPs = ${clientIp}/32\n`
    );

    // Ajouter à chaud
    const tmpFile = `/tmp/wg_peer_${userId}.conf`;
    fs.writeFileSync(tmpFile,
      `[Peer]\nPublicKey = ${clientPub}\nPresharedKey = ${clientPsk}\nAllowedIPs = ${clientIp}/32\n`
    );
    try { execSync(`wg addconf wg0 ${tmpFile}`, { stdio: 'pipe' }); } catch {}
    try { fs.unlinkSync(tmpFile); } catch {}

    console.log(`[wg-agent] Config générée pour ${username} → ${clientIp}`);
    return json(res, 200, { config, existed: false });
  }

  // DELETE /revoke/:userId
  if (method === 'DELETE' && url.startsWith('/revoke/')) {
    const userId   = url.replace('/revoke/', '');
    const confFile = path.join(CLIENT_DIR, `user_${userId}.conf`);

    if (!fs.existsSync(confFile)) {
      return json(res, 404, { error: 'Aucune config VPN pour cet utilisateur' });
    }

    // Retirer le peer de wg
    try {
      const conf    = fs.readFileSync(confFile, 'utf8');
      const privKey = conf.match(/PrivateKey\s*=\s*(.+)/)?.[1]?.trim();
      if (privKey) {
        const pubKey = execSync(`echo "${privKey}" | wg pubkey`, { stdio: 'pipe' }).toString().trim();
        execSync(`wg set wg0 peer ${pubKey} remove`, { stdio: 'pipe' });
      }
    } catch {}

    fs.unlinkSync(confFile);
    console.log(`[wg-agent] Config révoquée pour userId=${userId}`);
    return json(res, 200, { success: true });
  }

  return json(res, 404, { error: 'Not found' });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[wg-agent] Démarrage sur 0.0.0.0:${PORT}`);
});

process.on('SIGTERM', () => { server.close(); process.exit(0); });
process.on('SIGINT',  () => { server.close(); process.exit(0); });
