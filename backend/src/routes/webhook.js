// src/routes/webhook.js
'use strict';

const express = require('express');
const router  = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  incomingMessage,
  replyToMessage,
  getWebhookConversation,
} = require('../controllers/webhookController');

/**
 * POST /api/webhook/incoming
 * Appelé par le service externe (site vitrine, etc.)
 * Authentification : header X-Webhook-Secret
 * Pas de middleware authenticate (vient de l'extérieur)
 */

router.post('/incoming', incomingMessage);




router.post('/reply/:messageId', authenticate, replyToMessage);



router.get('/conversation', authenticate, getWebhookConversation);

module.exports = router;
