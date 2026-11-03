// src/routes/vpn.js
'use strict';

const express = require('express');
const router  = express.Router();
const { authenticate, requireAdmin } = require('../middleware/auth');
const { getStatus, listClients, generateConfig, revokeConfig } = require('../controllers/vpnController');

// Statut WireGuard (admin seulement)
router.get('/status',           authenticate, requireAdmin, getStatus);

// Liste des clients VPN
router.get('/clients',          authenticate, requireAdmin, listClients);

// Générer/récupérer la config VPN d'un utilisateur
router.post('/generate/:userId', authenticate, requireAdmin, generateConfig);

// Révoquer la config VPN d'un utilisateur
router.delete('/revoke/:userId', authenticate, requireAdmin, revokeConfig);

module.exports = router;
