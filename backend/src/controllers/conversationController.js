// src/controllers/conversationController.js
const { Op } = require('sequelize');
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

/**
 * GET /api/conversations — Liste des conversations de l'utilisateur
 */
const getConversations = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Récupérer les IDs des conversations de l'utilisateur
    const memberRows = await ConversationMember.findAll({
      where: { user_id: userId },
      attributes: ['conversation_id', 'last_read_at', 'is_muted'],
    });

    const convIds = memberRows.map((m) => m.conversation_id);
    if (!convIds.length) return res.json({ success: true, data: { conversations: [] } });

    const conversations = await Conversation.findAll({
      where: { id: convIds },
      include: [
        {
          model: User,
          as: 'members',
          attributes: ['id', 'username', 'display_name', 'avatar_url', 'presence_status'],
          through: { attributes: ['role', 'last_read_at', 'is_muted'] },
        },
      ],
      order: [['updated_at', 'DESC']],
    });

    // Enrichir avec le dernier message et les non-lus
    const enriched = await Promise.all(
      conversations.map(async (conv) => {
        const lastMessage = await Message.findOne({
          where: { conversation_id: conv.id, is_deleted: false },
          include: [{ model: User, as: 'sender', attributes: ['id', 'display_name'] }],
          order: [['created_at', 'DESC']],
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

        return {
          ...conv.toJSON(),
          lastMessage: lastMessage ? lastMessage.toJSON() : null,
          unreadCount,
          isMuted: memberInfo?.is_muted || false,
        };
      })
    );

    return res.json({ success: true, data: { conversations: enriched } });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/conversations — Créer une conversation
 */
const createConversation = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const { type, name, member_ids } = req.body;
    const userId = req.user.id;

    // Pour les conversations directes, vérifier si elle existe déjà
    if (type === 'direct' && member_ids.length === 1) {
      const otherId = member_ids[0];

      // Trouver les conversations communes
      const myConvs = await ConversationMember.findAll({
        where: { user_id: userId },
        attributes: ['conversation_id'],
      });
      const otherConvs = await ConversationMember.findAll({
        where: { user_id: otherId },
        attributes: ['conversation_id'],
      });

      const myIds = myConvs.map((m) => m.conversation_id);
      const otherIds = otherConvs.map((m) => m.conversation_id);
      const commonIds = myIds.filter((id) => otherIds.includes(id));

      if (commonIds.length) {
        const existing = await Conversation.findOne({
          where: { id: commonIds, type: 'direct' },
          include: [{ model: User, as: 'members', attributes: ['id', 'username', 'display_name', 'avatar_url', 'presence_status'] }],
        });
        if (existing) {
          await t.rollback();
          return res.json({ success: true, data: { conversation: existing }, existed: true });
        }
      }
    }

    const conversation = await Conversation.create(
      { type, name: type === 'group' ? name : null, created_by: userId },
      { transaction: t }
    );

    // Ajouter les membres (créateur + invités)
    const allMembers = [...new Set([userId, ...member_ids])];
    await ConversationMember.bulkCreate(
      allMembers.map((uid) => ({
        conversation_id: conversation.id,
        user_id: uid,
        role: uid === userId ? 'admin' : 'member',
      })),
      { transaction: t }
    );

    await t.commit();

    const full = await Conversation.findByPk(conversation.id, {
      include: [{ model: User, as: 'members', attributes: ['id', 'username', 'display_name', 'avatar_url', 'presence_status'] }],
    });

    // Notifier les membres via Socket.IO
    const io = req.app.get('io');
    if (io) {
      member_ids.forEach((uid) => {
        io.to(`user:${uid}`).emit('conversation:new', { conversation: full });
      });
    }

    return res.status(201).json({ success: true, data: { conversation: full } });
  } catch (err) {
    await t.rollback();
    next(err);
  }
};

/**
 * GET /api/conversations/:id/messages — Messages d'une conversation
 */
const getMessages = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 50, before } = req.query;
    const userId = req.user.id;

    // Vérifier l'accès
    const member = await ConversationMember.findOne({
      where: { conversation_id: id, user_id: userId },
    });
    if (!member) {
      return res.status(403).json({ success: false, message: 'Accès refusé à cette conversation' });
    }

    const where = { conversation_id: id, is_deleted: false };
    if (before) where.created_at = { [Op.lt]: new Date(before) };

    const messages = await Message.findAll({
      where,
      include: [
        { model: User, as: 'sender', attributes: ['id', 'username', 'display_name', 'avatar_url'] },
        { model: Message, as: 'replyTo', include: [{ model: User, as: 'sender', attributes: ['id', 'display_name'] }] },
        { model: MessageReaction, as: 'reactions', include: [{ model: User, as: 'user', attributes: ['id', 'display_name'] }] },
      ],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
    });

    // Mettre à jour last_read_at
    member.last_read_at = new Date();
    await member.save();

    return res.json({
      success: true,
      data: {
        messages: messages.reverse(),
        hasMore: messages.length === parseInt(limit),
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/conversations/:id/messages — Envoyer un message
 */
const sendMessage = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { content, type = 'text', reply_to_id } = req.body;
    const userId = req.user.id;

    const member = await ConversationMember.findOne({
      where: { conversation_id: id, user_id: userId },
    });
    if (!member) {
      return res.status(403).json({ success: false, message: 'Accès refusé' });
    }

    let fileData = {};
    if (req.file) {
      fileData = {
        file_url: `/uploads/files/${req.file.filename}`,
        file_name: req.file.originalname,
        file_size: req.file.size,
        file_mime: req.file.mimetype,
      };
    }

    const message = await Message.create({
      conversation_id: id,
      sender_id: userId,
      content: content || null,
      type,
      reply_to_id: reply_to_id || null,
      ...fileData,
    });

    // Mettre à jour updated_at de la conversation
    await Conversation.update({ updated_at: new Date() }, { where: { id } });

    const full = await Message.findByPk(message.id, {
      include: [
        { model: User, as: 'sender', attributes: ['id', 'username', 'display_name', 'avatar_url'] },
        { model: Message, as: 'replyTo', include: [{ model: User, as: 'sender', attributes: ['id', 'display_name'] }] },
      ],
    });

    // Émettre en temps réel via Socket.IO
    const io = req.app.get('io');
    if (io) {
      io.to(`conv:${id}`).emit('message:new', { message: full });
    }

    return res.status(201).json({ success: true, data: { message: full } });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/conversations/:convId/messages/:msgId — Modifier un message
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

    message.content = content;
    message.is_edited = true;
    await message.save();

    const io = req.app.get('io');
    if (io) io.to(`conv:${convId}`).emit('message:edited', { message: message.toJSON() });

    return res.json({ success: true, data: { message: message.toJSON() } });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/conversations/:convId/messages/:msgId — Supprimer un message
 */
const deleteMessage = async (req, res, next) => {
  try {
    const { convId, msgId } = req.params;
    const userId = req.user.id;

    const message = await Message.findOne({
      where: { id: msgId, conversation_id: convId },
    });
    if (!message) return res.status(404).json({ success: false, message: 'Message introuvable' });

    // L'auteur ou un admin peut supprimer
    if (message.sender_id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Non autorisé' });
    }

    message.is_deleted = true;
    message.content = null;
    await message.save();

    const io = req.app.get('io');
    if (io) io.to(`conv:${convId}`).emit('message:deleted', { messageId: msgId, conversationId: convId });

    return res.json({ success: true, message: 'Message supprimé' });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/conversations/:convId/messages/:msgId/reactions — Ajouter une réaction
 */
const addReaction = async (req, res, next) => {
  try {
    const { convId, msgId } = req.params;
    const { emoji } = req.body;
    const userId = req.user.id;

    // Vérifier accès
    const member = await ConversationMember.findOne({
      where: { conversation_id: convId, user_id: userId },
    });
    if (!member) return res.status(403).json({ success: false, message: 'Accès refusé' });

    const [reaction, created] = await MessageReaction.findOrCreate({
      where: { message_id: msgId, user_id: userId, emoji },
      defaults: { message_id: msgId, user_id: userId, emoji },
    });

    if (!created) {
      // Toggle: supprimer si existe
      await reaction.destroy();
      const io = req.app.get('io');
      if (io) io.to(`conv:${convId}`).emit('message:reaction_removed', { messageId: msgId, userId, emoji });
      return res.json({ success: true, data: { removed: true } });
    }

    const io = req.app.get('io');
    if (io) io.to(`conv:${convId}`).emit('message:reaction_added', { messageId: msgId, userId, emoji });

    return res.status(201).json({ success: true, data: { reaction: reaction.toJSON() } });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/conversations/:id/read — Marquer comme lu
 */
const markAsRead = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    await ConversationMember.update(
      { last_read_at: new Date() },
      { where: { conversation_id: id, user_id: userId } }
    );

    const io = req.app.get('io');
    if (io) io.to(`conv:${id}`).emit('conversation:read', { userId, conversationId: id });

    return res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getConversations,
  createConversation,
  getMessages,
  sendMessage,
  editMessage,
  deleteMessage,
  addReaction,
  markAsRead,
};
