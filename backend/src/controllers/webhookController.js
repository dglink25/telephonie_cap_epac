// src/controllers/webhookController.js
'use strict';

const https   = require('https');
const http    = require('http');
const { v4: uuidv4 } = require('uuid');
const {
  User, Conversation, ConversationMember, Message, sequelize,
} = require('../models');
const logger = require('../utils/logger');

// ── Constantes du bot ──────────────────────────────────────────────────────
const BOT_USERNAME   = 'assistant_site_vitrine';
const BOT_EMAIL      = 'bot.site.vitrine@cap-epac.internal';
const BOT_DISPLAY    = 'Assistant Site Vitrine';
const CONV_NAME      = 'Messages Site Vitrine';
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'cap-epac-webhook-secret-2025';

// ── Clé API requise dans le header X-Webhook-Secret ───────────────────────
const verifySecret = (req) =>
  req.headers['x-webhook-secret'] === WEBHOOK_SECRET;

// ── Helper HTTP POST natif (pas besoin d'axios) ───────────────────────────
const postCallback = (url, body) => {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const parsed  = new URL(url);
    const lib     = parsed.protocol === 'https:' ? https : http;
    const options = {
      hostname: parsed.hostname,
      port:     parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path:     parsed.pathname + parsed.search,
      method:   'POST',
      headers:  {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'X-Source':       'CAP-EPAC',
      },
      timeout: 10000,
    };
    const req = lib.request(options, (res) => {
      res.resume(); // drainer la réponse
      resolve(res.statusCode);
    });
    req.on('error',   reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.write(payload);
    req.end();
  });
};

// ────────────────────────────────────────────────────────────────────────────
// Helpers : trouver ou créer le bot + la conversation unique
// ────────────────────────────────────────────────────────────────────────────

const getOrCreateBot = async (t) => {
  let bot = await User.findOne({ where: { username: BOT_USERNAME }, transaction: t });
  if (!bot) {
    const bcrypt = require('bcrypt');
    // Mot de passe aléatoire non utilisable (le bot ne se connecte jamais)
    const hash   = await bcrypt.hash(`Bot@CAP-EPAC-${Date.now()}`, 12);
    bot = await User.create({
      username:      BOT_USERNAME,
      email:         BOT_EMAIL,
      display_name:  BOT_DISPLAY,
      password_hash: hash,
      role:          'user',
      is_active:     true,
    }, { transaction: t });
    logger.info(`[Webhook] Bot créé : ${BOT_DISPLAY} (${bot.id})`);
  }
  return bot;
};

const getOrCreateWebhookConversation = async (bot, t) => {
  // Chercher une conversation dont created_by = bot.id ET is_general = false ET name = CONV_NAME
  let conv = await Conversation.findOne({
    where: { created_by: bot.id, name: CONV_NAME },
    transaction: t,
  });

  if (!conv) {
    conv = await Conversation.create({
      type:       'group',
      name:       CONV_NAME,
      created_by: bot.id,
      is_general: false,
    }, { transaction: t });

    // Ajouter le bot comme membre admin
    await ConversationMember.create({
      conversation_id: conv.id,
      user_id:         bot.id,
      role:            'admin',
    }, { transaction: t });

    logger.info(`[Webhook] Conversation unique créée : ${conv.id}`);
  }

  return conv;
};

// ────────────────────────────────────────────────────────────────────────────
// POST /api/webhook/incoming
// Corps attendu :
//   {
//     "message":      "Bonjour, je voudrais un devis",
//     "callback_url": "https://site-vitrine.bj/webhook/reply",
//     "metadata":     { "visitor_id": "...", "page": "..." }  // optionnel
//   }
// ────────────────────────────────────────────────────────────────────────────

const incomingMessage = async (req, res, next) => {
  if (!verifySecret(req)) {
    return res.status(401).json({ success: false, message: 'Secret invalide' });
  }

  const { message, callback_url, metadata = {} } = req.body;

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({ success: false, message: 'Le champ "message" est requis' });
  }
  if (!callback_url || !/^https?:\/\//.test(callback_url)) {
    return res.status(400).json({ success: false, message: 'Le champ "callback_url" est requis et doit être une URL valide' });
  }

  const t = await sequelize.transaction();
  try {
    // 1. Bot + conversation unique
    const bot  = await getOrCreateBot(t);
    const conv = await getOrCreateWebhookConversation(bot, t);

    // 2. Stocker le message entrant dans la conversation
    //    On encode callback_url + metadata dans le champ content en JSON
    //    pour pouvoir les récupérer lors de la réponse
    const msgContent = JSON.stringify({
      text:         message.trim(),
      callback_url,
      metadata,
      direction:    'incoming',   // 'incoming' = vient du service externe
    });

    const dbMessage = await Message.create({
      conversation_id: conv.id,
      sender_id:       bot.id,
      content:         msgContent,
      type:            'text',
    }, { transaction: t });

    await Conversation.update(
      { updated_at: new Date() },
      { where: { id: conv.id }, transaction: t }
    );

    await t.commit();

    // 3. Ajouter tous les utilisateurs actifs à la conversation (si pas encore membres)
    //    On le fait hors transaction pour ne pas bloquer
    const allUsers = await User.findAll({
      where: { is_active: true },
      attributes: ['id'],
    });

    const existingMembers = await ConversationMember.findAll({
      where: { conversation_id: conv.id },
      attributes: ['user_id'],
    });
    const existingIds = new Set(existingMembers.map((m) => m.user_id));

    const newMembers = allUsers
      .filter((u) => !existingIds.has(u.id))
      .map((u) => ({
        conversation_id: conv.id,
        user_id:         u.id,
        role:            'member',
      }));

    if (newMembers.length > 0) {
      await ConversationMember.bulkCreate(newMembers, { ignoreDuplicates: true });
    }

    // 4. Broadcast Socket.IO → tous les utilisateurs connectés
    const io = req.app.get('io');
    if (io) {
      const fullMessage = await Message.findByPk(dbMessage.id, {
        include: [{ model: User, as: 'sender', attributes: ['id', 'display_name', 'avatar_url'] }],
      });

      // Émettre dans la room de la conversation
      io.to(`conv:${conv.id}`).emit('message:new', {
        message: {
          ...fullMessage.toJSON(),
          // Parser le contenu pour l'affichage
          display_content: message.trim(),
          is_webhook:      true,
        },
      });

      // Émettre aussi un événement dédié webhook pour tous les utilisateurs
      // même ceux qui ne sont pas dans la room de la conversation
      io.emit('webhook:incoming_message', {
        conversationId:  conv.id,
        conversationName: CONV_NAME,
        messageId:       dbMessage.id,
        text:            message.trim(),
        senderName:      BOT_DISPLAY,
        receivedAt:      new Date().toISOString(),
      });
    }

    logger.info(`[Webhook] Message entrant stocké : ${dbMessage.id} — conv:${conv.id}`);

    return res.status(201).json({
      success:        true,
      message_id:     dbMessage.id,
      conversation_id: conv.id,
    });
  } catch (err) {
    await t.rollback();
    next(err);
  }
};

// ────────────────────────────────────────────────────────────────────────────
// POST /api/webhook/reply/:messageId
// Appelé quand un utilisateur répond au message du bot
// Corps : { "reply": "Voici le devis..." }
// ────────────────────────────────────────────────────────────────────────────

const replyToMessage = async (req, res, next) => {
  try {
    const { messageId } = req.params;
    const { reply }     = req.body;
    const userId        = req.user.id;

    if (!reply || typeof reply !== 'string' || reply.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Le champ "reply" est requis' });
    }

    // Récupérer le message original (entrant)
    const original = await Message.findByPk(messageId);
    if (!original) {
      return res.status(404).json({ success: false, message: 'Message introuvable' });
    }

    // Vérifier que l'utilisateur est membre de la conversation
    const member = await ConversationMember.findOne({
      where: { conversation_id: original.conversation_id, user_id: userId },
    });
    if (!member) {
      return res.status(403).json({ success: false, message: 'Accès refusé' });
    }

    // Parser le message original pour récupérer callback_url
    let parsedOriginal;
    try {
      parsedOriginal = JSON.parse(original.content);
    } catch {
      return res.status(400).json({ success: false, message: 'Message original invalide' });
    }

    const { callback_url, metadata } = parsedOriginal;
    if (!callback_url) {
      return res.status(400).json({ success: false, message: 'Pas de callback_url dans le message original' });
    }

    // Stocker la réponse dans la conversation
    const replier    = await User.findByPk(userId, { attributes: ['id', 'display_name', 'username'] });
    const replyContent = JSON.stringify({
      text:         reply.trim(),
      callback_url,
      metadata,
      direction:    'outgoing',   // 'outgoing' = réponse d'un agent
      replied_by:   replier?.display_name || 'Agent',
    });

    const replyMsg = await Message.create({
      conversation_id: original.conversation_id,
      sender_id:       userId,
      content:         replyContent,
      type:            'text',
      reply_to_id:     messageId,
    });

    await Conversation.update(
      { updated_at: new Date() },
      { where: { id: original.conversation_id } }
    );

    // Émettre dans la room
    const io = req.app.get('io');
    if (io) {
      const fullReply = await Message.findByPk(replyMsg.id, {
        include: [{ model: User, as: 'sender', attributes: ['id', 'display_name', 'avatar_url'] }],
      });
      io.to(`conv:${original.conversation_id}`).emit('message:new', {
        message: { ...fullReply.toJSON(), display_content: reply.trim(), is_webhook: true },
      });
    }

    // Envoyer la réponse au service externe (callback)
    let callbackStatus = 'sent';
    try {
      await postCallback(callback_url, {
        reply:      reply.trim(),
        replied_by: replier?.display_name || 'Agent',
        metadata,
        replied_at: new Date().toISOString(),
        message_id: replyMsg.id,
      });
      logger.info(`[Webhook] Réponse envoyée à ${callback_url}`);
    } catch (callbackErr) {
      callbackStatus = 'callback_failed';
      logger.error(`[Webhook] Erreur callback ${callback_url} : ${callbackErr.message}`);
      // On ne rejette pas — la réponse est quand même stockée
    }

    return res.status(201).json({
      success:         true,
      message_id:      replyMsg.id,
      callback_status: callbackStatus,
    });
  } catch (err) {
    next(err);
  }
};

// ────────────────────────────────────────────────────────────────────────────
// GET /api/webhook/conversation
// Retourne les infos de la conversation webhook (pour l'UI)
// ────────────────────────────────────────────────────────────────────────────

const getWebhookConversation = async (req, res, next) => {
  try {
    const bot = await User.findOne({ where: { username: BOT_USERNAME } });
    if (!bot) {
      return res.json({ success: true, data: { conversation: null } });
    }

    const conv = await Conversation.findOne({
      where: { created_by: bot.id, name: CONV_NAME },
    });

    return res.json({ success: true, data: { conversation: conv || null, botId: bot.id } });
  } catch (err) {
    next(err);
  }
};

module.exports = { incomingMessage, replyToMessage, getWebhookConversation };
