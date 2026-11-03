// src/controllers/vpnController.js
// Le backend Docker ne peut pas exécuter wg directement.
// Il passe par le wg-agent (HTTP sur host.docker.internal:51821)
// qui tourne sur l'hôte Ubuntu avec les droits root.
'use strict';

const http   = require('http');
const { User } = require('../models');
const logger = require('../utils/logger');

const WG_AGENT_HOST = process.env.WG_AGENT_HOST || 'host.docker.internal';
const WG_AGENT_PORT = parseInt(process.env.WG_AGENT_PORT || '51821');
const VPN_ENDPOINT  = process.env.VPN_ENDPOINT  || process.env.SERVER_LAN_IP || '';

// ── Appel HTTP vers le wg-agent sur l'hôte ──────────────────────
const agentRequest = (method, path, body = null) =>
  new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : '';
    const options = {
      hostname: WG_AGENT_HOST,
      port:     WG_AGENT_PORT,
      path,
      method,
      headers: {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(bodyStr),
      },
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    req.setTimeout(8000, () => { req.destroy(); reject(new Error('wg-agent timeout')); });
    if (bodyStr) req.write(bodyStr);
    req.end();
  });

// ── GET /api/vpn/status ─────────────────────────────────────────
const getStatus = async (req, res) => {
  try {
    const result = await agentRequest('GET', '/status');
    return res.json({ success: true, data: result.body });
  } catch {
    return res.json({
      success: true,
      data: { available: false, running: false, serverPubKey: null,
              error: 'wg-agent non démarré — lancer : sudo bash vpn/wg-agent.sh --install' },
    });
  }
};

// ── GET /api/vpn/clients ────────────────────────────────────────
const listClients = async (req, res, next) => {
  try {
    const result = await agentRequest('GET', '/clients');
    return res.json({ success: true, data: result.body });
  } catch (err) { next(err); }
};

// ── POST /api/vpn/generate/:userId ──────────────────────────────
const generateConfig = async (req, res, next) => {
  try {
    const { userId } = req.params;

    const user = await User.findByPk(userId, {
      attributes: ['id', 'display_name', 'username'],
    });
    if (!user) {
      return res.status(404).json({ success: false, message: 'Utilisateur introuvable' });
    }

    let result;
    try {
      result = await agentRequest('POST', '/generate', {
        userId:   user.id,
        username: user.username,
        endpoint: VPN_ENDPOINT,
      });
    } catch {
      return res.status(503).json({
        success: false,
        message: 'wg-agent non disponible. Sur le serveur : sudo bash vpn/wg-agent.sh --install',
      });
    }

    if (result.status !== 200) {
      return res.status(result.status).json({ success: false, message: result.body?.error || 'Erreur agent' });
    }

    // La config est encodée avec \n littéraux — les restaurer
    const config = (result.body.config || '').replace(/\\n/g, '\n');

    logger.info(`[VPN] Config ${result.body.existed ? 'existante retournée' : 'générée'} pour ${user.username}`);

    return res.json({
      success: true,
      data: {
        config,
        existed: result.body.existed || false,
        user: { id: user.id, display_name: user.display_name, username: user.username },
      },
    });
  } catch (err) { next(err); }
};

// ── DELETE /api/vpn/revoke/:userId ──────────────────────────────
const revokeConfig = async (req, res, next) => {
  try {
    const { userId } = req.params;
    let result;
    try {
      result = await agentRequest('DELETE', `/revoke/${userId}`);
    } catch {
      return res.status(503).json({ success: false, message: 'wg-agent non disponible' });
    }

    if (result.status === 404) {
      return res.status(404).json({ success: false, message: 'Aucune config VPN pour cet utilisateur' });
    }

    logger.info(`[VPN] Config révoquée pour userId=${userId}`);
    return res.json({ success: true, message: 'Config VPN révoquée' });
  } catch (err) { next(err); }
};

module.exports = { getStatus, listClients, generateConfig, revokeConfig };
