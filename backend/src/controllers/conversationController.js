// src/controllers/conversationController.js
const { Op } = require('sequelize');
const path = require('path');
const {
  Conversation,
  ConversationMember,
  Message,
  MessageReaction,
  MessageReadStatus,
  User,
  sequelize,
} = require('../models');
const logger = require('../utils/logger');
const NotificationService = require('../services/notificationService');

// ── Délai maximum de modification : 15 minutes ───────────────────
const EDIT_WINDOW_MS = 15 * 60 * 1000;

// ── Types de fichiers autorisés par catégorie ────────────────────
const FILE_TYPES = {
  image: ['image/jpeg','image/png','image/gif','image/webp'],
  video: ['video/mp4','video/webm','video/ogg','video/quicktime','video/x-msvideo'],
  audio: ['audio/mpeg','audio/ogg','audio/wav','audio/webm','audio/aac','audio/mp4','audio/x-m4a'],
  document: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/zip','application/x-zip-compressed',
    'application/x-rar-compressed',
    'application/x-tar',
    'application/gzip',
    'text/plain','text/csv',
  ],
};

/**
 * Détecter le type de message selon le MIME du fichier
 */
const detectMessageType = (mimetype) => {
  if (!mimetype) return 'text';
  if (FILE_TYPES.image.includes(mimetype)) return 'image';
  if (FILE_TYPES.video.includes(mimetype)) return 'video';
  if (FILE_TYPES.audio.includes(mimetype)) return 'audio';
  if (FILE_TYPES.document.includes(mimetype)) return 'file';
  return 'file';
};

/**
 * Vérifier si un message est encore modifiable (dans les 15 min)
 */
const isEditable = (message) => {
  const age = Date.now() - new Date(message.created_at).getTime();
  return age <= EDIT_WINDOW_MS;
};

/**
 * GET /api/conversations
 */
const getConversations = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const memberRows = await ConversationMember.findAll({
      where: { user_id: userId },
      attributes: ['conversation_id', 'last_read_at', 'is_muted'],
    });
    const convIds = memberRows.map((m) => m.conversation_id);
    if (!convIds.length) return res.json({ success: true, data: { conversations: [] } });

    const conversations = await Conversation.findAll({
      where: { id: convIds },
      include: [{
        model: User, as: 'members',
        attributes: ['id','username','display_name','avatar_url','presence_status'],
        through: { attributes: ['role','last_read_at','is_muted'] },
      }],
      order: [['updated_at','DESC']],
    });

    const enriched = await Promise.all(conversations.map(async (conv) => {
      const lastMessage = await Message.findOne({
        where: { conversation_id: conv.id, is_deleted: false },
        include: [{ model: User, as: 'sender', attributes: ['id','display_name'] }],
        order: [['created_at','DESC']],
      });
      const memberInfo = memberRows.find((m) => m.conversation_id === conv.id);
      const lastRead = memberInfo?.last_read_at;
      const unreadCount = await Message.count({
        where: {
          conversation_id: conv.id,
          sender_id: { [Op.ne]: userId },
          is_deleted: false,
          ...(lastRead ? { created_at: { [Op.gt]: lastRead } } : {}),
        },
      });
      return { ...conv.toJSON(), lastMessage: lastMessage?.toJSON() || null, unreadCount, isMuted: memberInfo?.is_muted || false };
    }));

    return res.json({ success: true, data: { conversations: enriched } });
  } catch (err) { next(err); }
};

/**
 * POST /api/conversations
 */
const createConversation = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const { type, name, member_ids } = req.body;
    const userId = req.user.id;

    if (type === 'direct' && member_ids.length === 1) {
      const otherId = member_ids[0];
      const myConvs = await ConversationMember.findAll({ where: { user_id: userId }, attributes: ['conversation_id'] });
      const otherConvs = await ConversationMember.findAll({ where: { user_id: otherId }, attributes: ['conversation_id'] });
      const commonIds = myConvs.map((m) => m.conversation_id).filter((id) => otherConvs.map((m) => m.conversation_id).includes(id));
      if (commonIds.length) {
        const existing = await Conversation.findOne({
          where: { id: commonIds, type: 'direct' },
          include: [{ model: User, as: 'members', attributes: ['id','username','display_name','avatar_url','presence_status'] }],
        });
        if (existing) { await t.rollback(); return res.json({ success: true, data: { conversation: existing }, existed: true }); }
      }
    }

    const conversation = await Conversation.create(
      { type, name: type === 'group' ? name : null, created_by: userId },
      { transaction: t }
    );
    const allMembers = [...new Set([userId, ...member_ids])];
    await ConversationMember.bulkCreate(
      allMembers.map((uid) => ({ conversation_id: conversation.id, user_id: uid, role: uid === userId ? 'admin' : 'member' })),
      { transaction: t }
    );
    await t.commit();

    const full = await Conversation.findByPk(conversation.id, {
      include: [{ model: User, as: 'members', attributes: ['id','username','display_name','avatar_url','presence_status'] }],
    });
    const io = req.app.get('io');
    if (io) member_ids.forEach((uid) => io.to(`user:${uid}`).emit('conversation:new', { conversation: full }));

    return res.status(201).json({ success: true, data: { conversation: full } });
  } catch (err) { await t.rollback(); next(err); }
};

/**
 * GET /api/conversations/:id/messages
 */
const getMessages = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { limit = 50, before } = req.query;
    const userId = req.user.id;

    const member = await ConversationMember.findOne({ where: { conversation_id: id, user_id: userId } });
    if (!member) return res.status(403).json({ success: false, message: 'Accès refusé' });

    const where = { conversation_id: id, is_deleted: false };
    if (before) where.created_at = { [Op.lt]: new Date(before) };

    const messages = await Message.findAll({
      where,
      include: [
        { model: User, as: 'sender', attributes: ['id','username','display_name','avatar_url'] },
        { model: Message, as: 'replyTo', include: [{ model: User, as: 'sender', attributes: ['id','display_name'] }] },
        { model: MessageReaction, as: 'reactions', include: [{ model: User, as: 'user', attributes: ['id','display_name'] }] },
        { model: MessageReadStatus, as: 'readStatuses', include: [{ model: User, as: 'user', attributes: ['id','display_name','avatar_url'] }] },
      ],
      order: [['created_at','DESC']],
      limit: parseInt(limit),
    });

    member.last_read_at = new Date();
    await member.save();

    // Enrichir chaque message avec canEdit et statut de lecture
    const enriched = messages.reverse().map((msg) => {
      const msgJson = msg.toJSON();
      return {
        ...msgJson,
        canEdit: msg.sender_id === userId && !msg.is_deleted && isEditable(msg),
        // Ajouter le statut de lecture pour l'expéditeur
        readBy: msgJson.readStatuses || [],
        isRead: msgJson.readStatuses && msgJson.readStatuses.length > 0,
        isDelivered: !!msgJson.delivered_at,
      };
    });

    return res.json({ success: true, data: { messages: enriched, hasMore: messages.length === parseInt(limit) } });
  } catch (err) { next(err); }
};

/**
 * POST /api/conversations/:id/messages — Envoyer un message (texte + tout type de fichier)
 */
const sendMessage = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const member = await ConversationMember.findOne({ where: { conversation_id: id, user_id: userId } });
    if (!member) return res.status(403).json({ success: false, message: 'Accès refusé' });

    const content = req.body.content || null;
    const reply_to_id = req.body.reply_to_id || null;
    let msgType = req.body.type || 'text';
    let fileData = {};

    // Traitement du fichier uploadé
    if (req.file) {
      const detectedType = detectMessageType(req.file.mimetype);
      msgType = detectedType;

      // Sous-dossier selon le type
      const subFolder = detectedType === 'image' ? 'images'
        : detectedType === 'video' ? 'videos'
        : detectedType === 'audio' ? 'audios'
        : 'documents';

      // Utiliser des URLs relatives (fonctionne pour web HTTPS et mobile HTTP)
      fileData = {
        file_url: `/uploads/${subFolder}/${req.file.filename}`,
        file_name: req.file.originalname,
        file_size: req.file.size,
  file_mime: req.file.mimetype,
};
    }

    // Un message doit avoir soit du contenu, soit un fichier
    if (!content && !req.file) {
      return res.status(400).json({ success: false, message: 'Contenu ou fichier requis' });
    }

    const message = await Message.create({
      conversation_id: id,
      sender_id: userId,
      content,
      type: msgType,
      reply_to_id,
      ...fileData,
    });

    await Conversation.update({ updated_at: new Date() }, { where: { id } });

    // ── Charger la conversation une seule fois (réutilisée pour livraison + notifications) ──
    const { isUserOnline } = require('../socket');
    const conversation = await Conversation.findByPk(id, {
      include: [{ model: User, as: 'members', through: { attributes: [] } }],
    });

    let isDelivered = false;
    if (conversation) {
      const otherMembers = conversation.members.filter(m => m.id !== userId);
      isDelivered = otherMembers.some(m => isUserOnline(m.id));
      if (isDelivered) {
        message.delivered_at = new Date();
        await message.save();
      }
    }

    const full = await Message.findByPk(message.id, {
      include: [
        { model: User, as: 'sender', attributes: ['id','username','display_name','avatar_url'] },
        { model: Message, as: 'replyTo', include: [{ model: User, as: 'sender', attributes: ['id','display_name'] }] },
      ],
    });

    const msgJson = { ...full.toJSON(), canEdit: isEditable(full), isDelivered };

    const io = req.app.get('io');
    if (io) {
      io.to(`conv:${id}`).emit('message:new', { message: msgJson });

      // ── Envoyer des notifications aux autres membres ──────────
      try {
        // Réutiliser la conversation déjà chargée (pas de double requête)
        if (conversation) {
          const conversationName = conversation.name || 'Conversation';
          const senderName = req.user.display_name || req.user.username;
          
          // Créer un aperçu du message
          let messagePreview = content || '';
          if (msgType === 'image') messagePreview = '📷 Image';
          else if (msgType === 'video') messagePreview = '🎥 Vidéo';
          else if (msgType === 'audio') messagePreview = '🎵 Audio';
          else if (msgType === 'file') messagePreview = `📎 ${fileData.file_name || 'Fichier'}`;
          
          // Limiter la longueur de l'aperçu
          if (messagePreview.length > 100) {
            messagePreview = messagePreview.substring(0, 97) + '...';
          }

          // Détecter les mentions (@username)
          const mentionRegex = /@(\w+)/g;
          const mentions = content ? [...content.matchAll(mentionRegex)].map(m => m[1]) : [];

          // Envoyer des notifications à tous les membres sauf l'expéditeur
          for (const member of conversation.members) {
            if (member.id !== userId) {
              // Si l'utilisateur est mentionné, envoyer une notification de mention
              if (mentions.includes(member.username)) {
                await NotificationService.notifyMention(
                  io,
                  member.id,
                  senderName,
                  conversationName,
                  messagePreview,
                  id
                );
              } else {
                // Sinon, envoyer une notification de message normal
                await NotificationService.notifyNewMessage(
                  io,
                  member.id,
                  senderName,
                  conversationName,
                  messagePreview,
                  id
                );
              }
            }
          }
        }
      } catch (notifError) {
        logger.error('Erreur envoi notifications:', notifError.message);
      }
    }

    // ── Callback webhook automatique ──────────────────────────
    // Si la conversation contient des messages webhook entrants non répondus,
    // envoyer automatiquement la réponse de l'agent vers le callback_url
    // L'utilisateur répond normalement dans le chat — pas besoin d'API spéciale
    try {
      const BOT_USERNAME = 'assistant_site_vitrine';
      const bot = await User.findOne({ where: { username: BOT_USERNAME } });

      if (bot && conversation && conversation.created_by === bot.id && userId !== bot.id) {
        // C'est bien la conversation webhook ET c'est un agent qui répond (pas le bot)
        // Chercher le dernier message entrant non encore traité
        const lastIncoming = await Message.findOne({
          where: {
            conversation_id: id,
            sender_id: bot.id,
            is_deleted: false,
          },
          order: [['created_at', 'DESC']],
        });

        if (lastIncoming && lastIncoming.file_url) {
          let webhookMeta;
          try { webhookMeta = JSON.parse(lastIncoming.file_url); } catch {}

          if (webhookMeta && webhookMeta.callback_url && webhookMeta.direction === 'incoming') {
            const { callback_url, metadata } = webhookMeta;
            const replyText = content || (fileData.file_name ? `[${fileData.file_name}]` : '');

            if (replyText) {
              // Envoyer le callback de façon asynchrone (ne bloque pas la réponse)
              const { postWebhookCallback } = require('./webhookController');
              postWebhookCallback(callback_url, { message: replyText, metadata })
                .then((httpCode) => {
                  logger.info(`[Webhook Auto] Callback envoyé → ${callback_url} HTTP ${httpCode}`);
                  // Marquer le message entrant comme traité pour éviter les doublons
                  Message.update(
                    { file_url: JSON.stringify({ ...webhookMeta, direction: 'replied' }) },
                    { where: { id: lastIncoming.id } }
                  ).catch(() => {});
                })
                .catch((err) => logger.error(`[Webhook Auto] Erreur callback : ${err.message}`));
            }
          }
        }
      }
    } catch (webhookErr) {
      logger.error('Erreur webhook auto:', webhookErr.message);
      // Ne jamais bloquer l'envoi du message
    }

    return res.status(201).json({ success: true, data: { message: msgJson } });
  } catch (err) { next(err); }
};

/**
 * PUT /api/conversations/:convId/messages/:msgId — Modifier (dans les 15 min)
 */
const editMessage = async (req, res, next) => {
  try {
    const { convId, msgId } = req.params;
    const { content } = req.body;
    const userId = req.user.id;

    const message = await Message.findOne({
      where: { id: msgId, conversation_id: convId, sender_id: userId, is_deleted: false },
    });
    if (!message) return res.status(404).json({ success: false, message: 'Message introuvable' });

    // Vérifier la fenêtre de 15 minutes
    if (!isEditable(message)) {
      return res.status(403).json({
        success: false,
        message: 'Délai de modification dépassé (15 minutes maximum)',
        code: 'EDIT_WINDOW_EXPIRED',
      });
    }

    // Seuls les messages texte sont modifiables (pas les fichiers)
    if (message.type !== 'text') {
      return res.status(400).json({ success: false, message: 'Seuls les messages texte peuvent être modifiés' });
    }

    message.content = content;
    message.is_edited = true;
    await message.save();

    const msgJson = { ...message.toJSON(), canEdit: isEditable(message) };

    const io = req.app.get('io');
    if (io) io.to(`conv:${convId}`).emit('message:edited', { message: msgJson });

    return res.json({ success: true, data: { message: msgJson } });
  } catch (err) { next(err); }
};

/**
 * DELETE /api/conversations/:convId/messages/:msgId — Retirer un message
 * Deux modes : soft delete (pour tout le monde) ou retrait partiel (pour soi)
 */
const deleteMessage = async (req, res, next) => {
  try {
    const { convId, msgId } = req.params;
    const { mode = 'everyone' } = req.query; // 'everyone' | 'self'
    const userId = req.user.id;

    const message = await Message.findOne({ where: { id: msgId, conversation_id: convId } });
    if (!message) return res.status(404).json({ success: false, message: 'Message introuvable' });

    if (message.sender_id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Non autorisé' });
    }

    // Soft delete : masqué pour tous
    message.is_deleted = true;
    message.content = null;
    await message.save();

    const io = req.app.get('io');
    if (io) io.to(`conv:${convId}`).emit('message:deleted', { messageId: msgId, conversationId: convId });

    logger.info(`Message retiré: ${msgId} par ${userId}`);
    return res.json({ success: true, message: 'Message retiré' });
  } catch (err) { next(err); }
};

/**
 * POST /api/conversations/:convId/messages/:msgId/reactions
 */
const addReaction = async (req, res, next) => {
  try {
    const { convId, msgId } = req.params;
    const { emoji } = req.body;
    const userId = req.user.id;

    const member = await ConversationMember.findOne({ where: { conversation_id: convId, user_id: userId } });
    if (!member) return res.status(403).json({ success: false, message: 'Accès refusé' });

    const [reaction, created] = await MessageReaction.findOrCreate({
      where: { message_id: msgId, user_id: userId, emoji },
      defaults: { message_id: msgId, user_id: userId, emoji },
    });

    const io = req.app.get('io');
    if (!created) {
      await reaction.destroy();
      if (io) io.to(`conv:${convId}`).emit('message:reaction_removed', { messageId: msgId, userId, emoji });
      return res.json({ success: true, data: { removed: true } });
    }
    if (io) io.to(`conv:${convId}`).emit('message:reaction_added', { messageId: msgId, userId, emoji });
    return res.status(201).json({ success: true, data: { reaction: reaction.toJSON() } });
  } catch (err) { next(err); }
};

/**
 * POST /api/conversations/:id/read
 */
const markAsRead = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { messageIds } = req.body; // Optionnel : liste des IDs de messages à marquer comme lus

    // Mettre à jour last_read_at de la conversation
    await ConversationMember.update(
      { last_read_at: new Date() },
      { where: { conversation_id: id, user_id: userId } }
    );

    // Si des messageIds sont fournis, marquer ces messages comme lus
    if (messageIds && Array.isArray(messageIds) && messageIds.length > 0) {
      for (const msgId of messageIds) {
        // Vérifier si le message existe et n'est pas envoyé par l'utilisateur
        const message = await Message.findOne({
          where: { id: msgId, conversation_id: id },
        });

        if (message && message.sender_id !== userId) {
          // Créer ou mettre à jour le statut de lecture
          await MessageReadStatus.findOrCreate({
            where: { message_id: msgId, user_id: userId },
            defaults: { read_at: new Date() },
          });
        }
      }

      // Émettre un événement pour notifier les autres utilisateurs
      const io = req.app.get('io');
      if (io) {
        io.to(`conv:${id}`).emit('messages:read', {
          userId,
          conversationId: id,
          messageIds,
          readAt: new Date(),
        });
      }
    }

    const io = req.app.get('io');
    if (io) io.to(`conv:${id}`).emit('conversation:read', { userId, conversationId: id });

    return res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/conversations/:convId/messages/:msgId/edit-status
 * Vérifier si un message est encore modifiable
 */
const getEditStatus = async (req, res, next) => {
  try {
    const { convId, msgId } = req.params;
    const userId = req.user.id;
    const message = await Message.findOne({ where: { id: msgId, conversation_id: convId, sender_id: userId } });
    if (!message) return res.status(404).json({ success: false, message: 'Message introuvable' });

    const age = Date.now() - new Date(message.created_at).getTime();
    const remaining = Math.max(0, EDIT_WINDOW_MS - age);

    return res.json({
      success: true,
      data: {
        canEdit: remaining > 0 && !message.is_deleted && message.type === 'text',
        remainingMs: remaining,
        remainingMinutes: Math.ceil(remaining / 60000),
        windowMinutes: 15,
      },
    });
  } catch (err) { next(err); }
};

module.exports = {
  getConversations, createConversation, getMessages,
  sendMessage, editMessage, deleteMessage,
  addReaction, markAsRead, getEditStatus,
};
