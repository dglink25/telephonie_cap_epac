
const { Conversation, ConversationMember, User, Message } = require('../models');
const logger = require('../utils/logger');

const GENERAL_GROUP_NAME = 'Groupe Général';

/**
 * Obtenir ou créer le Groupe Général
 */
const getOrCreateGeneralGroup = async () => {
  // Chercher le groupe général existant
  let group = await Conversation.findOne({
    where: { is_general: true, type: 'group' },
  });

  if (!group) {
    // Trouver l'admin pour créer le groupe
    const admin = await User.findOne({ where: { role: 'admin', is_active: true } });
    if (!admin) {
      logger.warn('[GeneralGroup] Aucun admin trouvé pour créer le Groupe Général');
      return null;
    }

    group = await Conversation.create({
      name: GENERAL_GROUP_NAME,
      description: 'Groupe de discussion général — tous les membres de CAP-EPAC',
      type: 'group',
      created_by: admin.id,
      is_general: true,
    });

    logger.info(`[GeneralGroup] Groupe Général créé (id: ${group.id})`);

    // Message de bienvenue
    await Message.create({
      conversation_id: group.id,
      sender_id: admin.id,
      content: 'Bienvenue dans le Groupe Général de Téléphonie CAP-EPAC ! Tous les membres de l\'équipe sont ici.',
      type: 'system',
    });
  }

  return group;
};

/**
 * Synchroniser tous les utilisateurs actifs dans le Groupe Général
 */
const syncAllUsersToGeneralGroup = async () => {
  try {
    const group = await getOrCreateGeneralGroup();
    if (!group) return;

    const allUsers = await User.findAll({ where: { is_active: true } });
    const existingMembers = await ConversationMember.findAll({
      where: { conversation_id: group.id },
      attributes: ['user_id'],
    });
    const existingIds = new Set(existingMembers.map((m) => m.user_id));

    const toAdd = allUsers.filter((u) => !existingIds.has(u.id));
    if (toAdd.length > 0) {
      await ConversationMember.bulkCreate(
        toAdd.map((u) => ({
          conversation_id: group.id,
          user_id: u.id,
          role: u.role === 'admin' ? 'admin' : 'member',
        })),
        { ignoreDuplicates: true }
      );
      logger.info(`[GeneralGroup] ${toAdd.length} utilisateur(s) ajouté(s) au Groupe Général`);
    }

    return group;
  } catch (err) {
    logger.error('[GeneralGroup] Erreur sync:', err.message);
  }
};

/**
 * Ajouter un utilisateur au Groupe Général (appelé à l'inscription)
 */
const addUserToGeneralGroup = async (userId, isAdmin = false) => {
  try {
    const group = await getOrCreateGeneralGroup();
    if (!group) return;

    await ConversationMember.findOrCreate({
      where: { conversation_id: group.id, user_id: userId },
      defaults: {
        conversation_id: group.id,
        user_id: userId,
        role: isAdmin ? 'admin' : 'member',
      },
    });

    logger.info(`[GeneralGroup] Utilisateur ${userId} ajouté au Groupe Général`);

    // Message système d'arrivée
    const user = await User.findByPk(userId);
    if (user) {
      await Message.create({
        conversation_id: group.id,
        sender_id: userId,
        content: `${user.display_name} a rejoint le groupe.`,
        type: 'system',
      });
    }

    return group;
  } catch (err) {
    logger.error('[GeneralGroup] Erreur addUser:', err.message);
  }
};

/**
 * Obtenir l'ID du Groupe Général
 */
const getGeneralGroupId = async () => {
  const group = await Conversation.findOne({
    where: { is_general: true, type: 'group' },
    attributes: ['id'],
  });
  return group?.id || null;
};

module.exports = {
  getOrCreateGeneralGroup,
  syncAllUsersToGeneralGroup,
  addUserToGeneralGroup,
  getGeneralGroupId,
};
