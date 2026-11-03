// src/controllers/vpnController.js
'use strict';

const { execSync, execFileSync } = require('child_process');
const fs   = require('fs');
const path = require('path');
const { User } = require('../models');
const logger = require('../utils/logger');

const WG_CONF     = '/etc/wireguard/wg0.conf';
const CLIENT_DIR  = '/etc/wireguard/clients';
const VPN_SUBNET  = '10.8.0';
const WG_PUB_KEY  = '/etc/wireguard/server_public.key';

// ── Helpers ──────────────────────────────────────────────────────

const wgAvailable = () => {
  try { execSync('which wg', { stdio: 'pipe' }); return true; }
  catch { return false; }
};

const serverPubKey = () => {
  try { return fs.readFileSync(WG_PUB_KEY, 'utf8').trim(); }
  catch { return null; }
};

const nextClientIp = () => {
  if (!fs.existsSync(WG_CONF)) return `${VPN_SUBNET}.2`;
  const conf = fs.readFileSync(WG_CONF, 'utf8');
  const ips = [...conf.matchAll(/AllowedIPs\s*=\s*10\.8\.0\.(\d+)/g)]
    .map((m) => parseInt(m[1]));
  const last = ips.length ? Math.max(...ips) : 1;
  return `${VPN_SUBNET}.${last + 1}`;
};

const getClientConfig = (userId) => {
  const file = path.join(CLIENT_DIR, `user_${userId}.conf`);
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
};

// ── GET /api/vpn/status ────────────────────────────────────────
const getStatus = async (req, res) => {
  const available = wgAvailable();
  const configured = fs.existsSync(WG_CONF);
  const pubKey = serverPubKey();

  let running = false;
  if (available && configured) {
    try { execSync('wg show wg0', { stdio: 'pipe' }); running = true; }
    catch { running = false; }
  }

  return res.json({
    success: true,
    data: { available, configured, running, serverPubKey: pubKey },
  });
};

// ── GET /api/vpn/clients ──────────────────────────────────────
const listClients = async (req, res, next) => {
  try {
    if (!fs.existsSync(CLIENT_DIR)) {
      return res.json({ success: true, data: { clients: [] } });
    }

    const files = fs.readdirSync(CLIENT_DIR).filter((f) => f.endsWith('.conf'));
    const clients = await Promise.all(
      files.map(async (f) => {
        const userId = f.replace('user_', '').replace('.conf', '');
        const conf   = fs.readFileSync(path.join(CLIENT_DIR, f), 'utf8');
        const ipMatch = conf.match(/Address\s*=\s*([\d.]+)/);
        const user   = await User.findByPk(userId, {
          attributes: ['id', 'display_name', 'username'],
        }).catch(() => null);

        return {
          userId,
          ip: ipMatch?.[1] || '?',
          user: user ? { id: user.id, display_name: user.display_name, username: user.username } : null,
        };
      })
    );

    return res.json({ success: true, data: { clients } });
  } catch (err) { next(err); }
};

// ── POST /api/vpn/generate/:userId ───────────────────────────
const generateConfig = async (req, res, next) => {
  try {
    const { userId } = req.params;

    if (!wgAvailable()) {
      return res.status(503).json({
        success: false,
        message: 'WireGuard non disponible sur ce serveur. Installer avec : sudo apt install wireguard',
      });
    }
    if (!fs.existsSync(WG_CONF)) {
      return res.status(503).json({
        success: false,
        message: 'WireGuard non configuré. Lancer : sudo bash vpn/setup-wireguard.sh',
      });
    }

    const user = await User.findByPk(userId, {
      attributes: ['id', 'display_name', 'username'],
    });
    if (!user) {
      return res.status(404).json({ success: false, message: 'Utilisateur introuvable' });
    }

    // Vérifier si une config existe déjà
    const existingConf = getClientConfig(userId);

    let clientConf;
    if (existingConf) {
      // Retourner la config existante
      clientConf = existingConf;
      logger.info(`[VPN] Config existante retournée pour ${user.username}`);
    } else {
      // Générer nouvelles clés
      const clientPriv = execSync('wg genkey', { stdio: 'pipe' }).toString().trim();
      const clientPub  = execSync(`echo "${clientPriv}" | wg pubkey`, { stdio: 'pipe' }).toString().trim();
      const clientPsk  = execSync('wg genpsk', { stdio: 'pipe' }).toString().trim();
      const clientIp   = nextClientIp();

      // Récupérer l'IP publique ou le domaine configuré
      const serverEndpoint = process.env.VPN_ENDPOINT ||
        process.env.SERVER_LAN_IP || '192.168.10.139';
      const serverPub = serverPubKey();

      // Construire la config client
      clientConf = [
        '[Interface]',
        `PrivateKey = ${clientPriv}`,
        `Address = ${clientIp}/32`,
        'DNS = 8.8.8.8',
        '',
        '[Peer]',
        `PublicKey = ${serverPub}`,
        `PresharedKey = ${clientPsk}`,
        `Endpoint = ${serverEndpoint}:51820`,
        `AllowedIPs = ${VPN_SUBNET}.0/24, 192.168.10.0/24`,
        'PersistentKeepalive = 25',
      ].join('\n');

      // Sauvegarder la config client
      fs.mkdirSync(CLIENT_DIR, { recursive: true });
      fs.writeFileSync(path.join(CLIENT_DIR, `user_${userId}.conf`), clientConf, { mode: 0o600 });

      // Ajouter le peer dans wg0.conf
      const peerBlock = [
        '',
        `# Client: ${user.username} (${user.display_name}) - ${clientIp}`,
        '[Peer]',
        `PublicKey = ${clientPub}`,
        `PresharedKey = ${clientPsk}`,
        `AllowedIPs = ${clientIp}/32`,
      ].join('\n');
      fs.appendFileSync(WG_CONF, peerBlock);

      // Ajouter le peer à chaud sans redémarrer
      try {
        const tmpFile = `/tmp/wg_peer_${userId}.conf`;
        fs.writeFileSync(tmpFile, [
          '[Peer]',
          `PublicKey = ${clientPub}`,
          `PresharedKey = ${clientPsk}`,
          `AllowedIPs = ${clientIp}/32`,
        ].join('\n'));
        execSync(`wg addconf wg0 ${tmpFile}`, { stdio: 'pipe' });
        fs.unlinkSync(tmpFile);
      } catch (e) {
        logger.warn(`[VPN] wg addconf échoué (WireGuard pas actif?) : ${e.message}`);
      }

      logger.info(`[VPN] Config générée pour ${user.username} → ${clientIp}`);
    }

    return res.json({
      success: true,
      data: {
        config: clientConf,
        user: { id: user.id, display_name: user.display_name, username: user.username },
      },
    });
  } catch (err) { next(err); }
};

// ── DELETE /api/vpn/revoke/:userId ───────────────────────────
const revokeConfig = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const confFile = path.join(CLIENT_DIR, `user_${userId}.conf`);

    if (!fs.existsSync(confFile)) {
      return res.status(404).json({ success: false, message: 'Aucune config VPN pour cet utilisateur' });
    }

    // Lire la clé publique du client depuis wg0.conf pour la retirer
    const conf = fs.readFileSync(confFile, 'utf8');
    const privKey = conf.match(/PrivateKey\s*=\s*(.+)/)?.[1]?.trim();
    if (privKey) {
      try {
        const pubKey = execSync(`echo "${privKey}" | wg pubkey`, { stdio: 'pipe' }).toString().trim();
        execSync(`wg set wg0 peer ${pubKey} remove`, { stdio: 'pipe' });
      } catch { /* ignore si wg pas actif */ }
    }

    // Supprimer le fichier config
    fs.unlinkSync(confFile);

    // Nettoyer wg0.conf (retirer le bloc [Peer] correspondant)
    if (fs.existsSync(WG_CONF)) {
      const wgConf = fs.readFileSync(WG_CONF, 'utf8');
      const user = await User.findByPk(userId, { attributes: ['username'] }).catch(() => null);
      if (user) {
        const cleaned = wgConf.replace(
          new RegExp(`\\n# Client: ${user.username}[^\\n]*\\n\\[Peer\\]\\nPublicKey = [^\\n]+\\nPresharedKey = [^\\n]+\\nAllowedIPs = [^\\n]+`, 'g'),
          ''
        );
        fs.writeFileSync(WG_CONF, cleaned);
      }
    }

    logger.info(`[VPN] Config révoquée pour userId=${userId}`);
    return res.json({ success: true, message: 'Config VPN révoquée' });
  } catch (err) { next(err); }
};

module.exports = { getStatus, listClients, generateConfig, revokeConfig };
