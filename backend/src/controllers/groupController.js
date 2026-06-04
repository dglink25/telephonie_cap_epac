// src/controllers/groupController.js
/**
 * Contrôleur de gestion des groupes
 * - Voir les membres
 * - Modifier nom/description/avatar
 * - Retirer un membre (admin/créateur)
 * - Quitter le groupe
 * - Ajouter des membres
 */
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { Conversation, ConversationMember, User, Message, sequelize } = require('../models');
const logger = require('../utils/logger');

// ── Vérifier si l'utilisateur est admin du groupe ─────────────────
const isGroupAdmin = async (conversationId, userId) => {
  const member = await ConversationMember.findOne({
    where: { conversation_id: conversationId, user_id: userId },
  });
  if (!member) return false;

  const conv = await Conversation.findByPk(conversationId);
  return member.role === 'admin' || conv?.created_by === userId;
};

/**
 * GET /api/groups/:id — Infos complètes du groupe
 */
const getGroupInfo = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const member = await ConversationMember.findOne({ where: { conversation_id: id, user_id: userId } });
    if (!member) return res.status(403).json({ success: false, message: 'Vous n\'êtes pas membre de ce groupe' });

    const group = await Conversation.findOne({
      where: { id, type: 'group' },
      include: [
        {
          model: User, as: 'members',
          attributes: ['id','username','display_name','avatar_url','presence_status','department','role'],
          through: { attributes: ['role','joined_at','is_muted'] },
        },
        { model: User, as: 'creator', attributes: ['id','display_name'] },
      ],
    });

    if (!group) return res.status(404).json({ success: false, message: 'Groupe introuvable' });

    const userIsAdmin = await isGroupAdmin(id, userId);

    return res.json({
      success: true,
      data: {
        group: {
          ...group.toJSON(),
          memberCount: group.members?.length || 0,
          currentUserRole: member.role,
          currentUserIsAdmin: userIsAdmin,
        },
      },
    });
  } catch (err) { next(err); }
};

/**
 * PUT /api/groups/:id — Modifier nom/description du groupe
 */
const updateGroupInfo = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;
    const userId = req.user.id;

    if (!(await isGroupAdmin(id, userId))) {
      return res.status(403).json({ success: false, message: 'Seul un administrateur peut modifier le groupe' });
    }

    const group = await Conversation.findOne({ where: { id, type: 'group' } });
    if (!group) return res.status(404).json({ success: false, message: 'Groupe introuvable' });

    // Le Groupe Général ne peut pas être renommé
    if (group.is_general && name && name !== group.name) {
      return res.status(403).json({ success: false, message: 'Le Groupe Général ne peut pas être renommé' });
    }

    if (name !== undefined)        group.name = name.trim();
    if (description !== undefined) group.description = description.trim();
    await group.save();

    // Message système
    await Message.create({
      conversation_id: id,
      sender_id: userId,
      content: `${req.user.display_name} a modifié les informations du groupe.`,
      type: 'system',
    });

    const io = req.app.get('io');
    if (io) io.to(`conv:${id}`).emit('group:updated', { groupId: id, name: group.name, description: group.description });

    logger.info(`[Group] Infos modifiées: ${id} par ${userId}`);
    return res.json({ success: true, data: { group } });
  } catch (err) { next(err); }
};

/**
 * POST /api/groups/:id/avatar — Changer la photo du groupe
 */
const updateGroupAvatar = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    if (!(await isGroupAdmin(id, userId))) {
      return res.status(403).json({ success: false, message: 'Seul un administrateur peut modifier le groupe' });
    }

    if (!req.file) return res.status(400).json({ success: false, message: 'Aucun fichier reçu' });

    const group = await Conversation.findOne({ where: { id, type: 'group' } });
    if (!group) return res.status(404).json({ success: false, message: 'Groupe introuvable' });

    // Supprimer l'ancien avatar
    if (group.avatar_url) {
      const oldPath = path.join(__dirname, '../../uploads', group.avatar_url.replace('/uploads/', ''));
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    // Utiliser le port 8080 pour les uploads (compatible mobile HTTP)
    const avatarPath = `/uploads/avatars/${req.file.filename}`;
    
    group.avatar_url = avatarPath;
    await group.save();

    const io = req.app.get('io');
    if (io) io.to(`conv:${id}`).emit('group:updated', { groupId: id, avatar_url: avatarPath });

    return res.json({ success: true, data: { avatar_url: avatarPath } });
  } catch (err) { next(err); }
};

/**
 * POST /api/groups/:id/members — Ajouter des membres au groupe
 */
const addMembers = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { user_ids } = req.body;
    const userId = req.user.id;

    if (!(await isGroupAdmin(id, userId))) {
      return res.status(403).json({ success: false, message: 'Seul un administrateur peut ajouter des membres' });
    }

    if (!Array.isArray(user_ids) || !user_ids.length) {
      return res.status(400).json({ success: false, message: 'Liste d\'utilisateurs requise' });
    }

    const group = await Conversation.findOne({ where: { id, type: 'group' } });
    if (!group) return res.status(404).json({ success: false, message: 'Groupe introuvable' });

    // Filtrer ceux qui ne sont pas encore membres
    const existing = await ConversationMember.findAll({
      where: { conversation_id: id, user_id: user_ids },
      attributes: ['user_id'],
    });
    const existingIds = new Set(existing.map((m) => m.user_id));
    const toAdd = user_ids.filter((uid) => !existingIds.has(uid));

    if (!toAdd.length) {
      return res.status(409).json({ success: false, message: 'Tous ces utilisateurs sont déjà membres' });
    }

    await ConversationMember.bulkCreate(
      toAdd.map((uid) => ({ conversation_id: id, user_id: uid, role: 'member' })),
      { ignoreDuplicates: true }
    );

    // Messages système pour chaque ajout
    const addedUsers = await User.findAll({ where: { id: toAdd }, attributes: ['id','display_name'] });
    for (const u of addedUsers) {
      await Message.create({
        conversation_id: id,
        sender_id: userId,
        content: `${req.user.display_name} a ajouté ${u.display_name} au groupe.`,
        type: 'system',
      });
    }

    const io = req.app.get('io');
    if (io) {
      toAdd.forEach((uid) => {
        io.to(`user:${uid}`).emit('group:joined', { groupId: id });
      });
      io.to(`conv:${id}`).emit('group:members_updated', { groupId: id });
    }

    logger.info(`[Group] ${toAdd.length} membre(s) ajouté(s) au groupe ${id} par ${userId}`);
    return res.status(201).json({ success: true, data: { added: toAdd.length } });
  } catch (err) { next(err); }
};

/**
 * DELETE /api/groups/:id/members/:memberId — Retirer un membre
 */
const removeMember = async (req, res, next) => {
  try {
    const { id, memberId } = req.params;
    const userId = req.user.id;

    // Vérifier droits
    const isAdmin = await isGroupAdmin(id, userId);
    if (!isAdmin) {
      return res.status(403).json({ success: false, message: 'Seul un administrateur peut retirer des membres' });
    }

    // Ne pas retirer soi-même via cette route
    if (memberId === userId) {
      return res.status(400).json({ success: false, message: 'Utilisez "Quitter le groupe" pour vous retirer' });
    }

    // Vérifier que le groupe n'est pas le Groupe Général (pas de retrait)
    const group = await Conversation.findByPk(id);
    if (group?.is_general) {
      return res.status(403).json({ success: false, message: 'Impossible de retirer des membres du Groupe Général' });
    }

    // Vérifier que le membre à retirer est bien dans le groupe
    const memberRecord = await ConversationMember.findOne({ where: { conversation_id: id, user_id: memberId } });
    if (!memberRecord) {
      return res.status(404).json({ success: false, message: 'Membre introuvable dans ce groupe' });
    }

    const removedUser = await User.findByPk(memberId, { attributes: ['display_name'] });
    await memberRecord.destroy();

    // Message système
    await Message.create({
      conversation_id: id,
      sender_id: userId,
      content: `${req.user.display_name} a retiré ${removedUser?.display_name} du groupe.`,
      type: 'system',
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`user:${memberId}`).emit('group:removed', { groupId: id });
      io.to(`conv:${id}`).emit('group:members_updated', { groupId: id });
    }

    logger.info(`[Group] Membre ${memberId} retiré du groupe ${id} par ${userId}`);
    return res.json({ success: true, message: `${removedUser?.display_name} retiré du groupe` });
  } catch (err) { next(err); }
};

/**
 * DELETE /api/groups/:id/leave — Quitter le groupe
 */
const leaveGroup = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const group = await Conversation.findOne({ where: { id, type: 'group' } });
    if (!group) return res.status(404).json({ success: false, message: 'Groupe introuvable' });

    // Impossible de quitter le Groupe Général
    if (group.is_general) {
      return res.status(403).json({ success: false, message: 'Impossible de quitter le Groupe Général' });
    }

    const memberRecord = await ConversationMember.findOne({ where: { conversation_id: id, user_id: userId } });
    if (!memberRecord) return res.status(404).json({ success: false, message: 'Vous n\'êtes pas membre de ce groupe' });

    // Si c'est le seul admin, promouvoir quelqu'un avant de partir
    if (memberRecord.role === 'admin') {
      const otherAdmins = await ConversationMember.count({
        where: { conversation_id: id, role: 'admin', user_id: { [require('sequelize').Op.ne]: userId } },
      });
      if (otherAdmins === 0) {
        // Promouvoir le membre le plus ancien
        const oldest = await ConversationMember.findOne({
          where: { conversation_id: id, user_id: { [require('sequelize').Op.ne]: userId } },
          order: [['joined_at', 'ASC']],
        });
        if (oldest) {
          oldest.role = 'admin';
          await oldest.save();
          const promoted = await User.findByPk(oldest.user_id, { attributes: ['display_name'] });
          await Message.create({
            conversation_id: id,
            sender_id: userId,
            content: `${promoted?.display_name} est maintenant administrateur du groupe.`,
            type: 'system',
          });
        }
      }
    }

    await memberRecord.destroy();

    // Message système
    await Message.create({
      conversation_id: id,
      sender_id: userId,
      content: `${req.user.display_name} a quitté le groupe.`,
      type: 'system',
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`conv:${id}`).emit('group:members_updated', { groupId: id });
      io.to(`user:${userId}`).emit('group:left', { groupId: id });
    }

    logger.info(`[Group] Utilisateur ${userId} a quitté le groupe ${id}`);
    return res.json({ success: true, message: 'Vous avez quitté le groupe' });
  } catch (err) { next(err); }
};

/**
 * PUT /api/groups/:id/members/:memberId/role — Changer le rôle d'un membre
 */
const updateMemberRole = async (req, res, next) => {
  try {
    const { id, memberId } = req.params;
    const { role } = req.body;
    const userId = req.user.id;

    if (!['admin','member'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Rôle invalide (admin ou member)' });
    }

    if (!(await isGroupAdmin(id, userId))) {
      return res.status(403).json({ success: false, message: 'Seul un administrateur peut modifier les rôles' });
    }

    const memberRecord = await ConversationMember.findOne({ where: { conversation_id: id, user_id: memberId } });
    if (!memberRecord) return res.status(404).json({ success: false, message: 'Membre introuvable' });

    memberRecord.role = role;
    await memberRecord.save();

    const targetUser = await User.findByPk(memberId, { attributes: ['display_name'] });
    await Message.create({
      conversation_id: id,
      sender_id: userId,
      content: `${targetUser?.display_name} est maintenant ${role === 'admin' ? 'administrateur' : 'membre'} du groupe.`,
      type: 'system',
    });

    const io = req.app.get('io');
    if (io) io.to(`conv:${id}`).emit('group:members_updated', { groupId: id });

    return res.json({ success: true, message: 'Rôle mis à jour' });
  } catch (err) { next(err); }
};

module.exports = {
  getGroupInfo,
  updateGroupInfo,
  updateGroupAvatar,
  addMembers,
  removeMember,
  leaveGroup,
  updateMemberRole,
};
