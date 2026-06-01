// src/services/notificationService.js
const { Notification } = require('../models');
const logger = require('../utils/logger');

/**
 * Service de gestion des notifications
 */
class NotificationService {
  /**
   * Créer et envoyer une notification
   * @param {Object} io - Instance Socket.IO
   * @param {String} userId - ID de l'utilisateur destinataire
   * @param {Object} data - Données de la notification
   */
  static async send(io, userId, data) {
    try {
      const notification = await Notification.create({
        user_id: userId,
        type: data.type,
        title: data.title,
        message: data.message || null,
        data: data.data || null,
        action_url: data.actionUrl || null,
        priority: data.priority || 'normal',
        expires_at: data.expiresAt || null,
      });

      // Envoyer via socket si l'utilisateur est connecté
      if (io) {
        io.to(`user:${userId}`).emit('notification:new', { notification });
      }

      logger.info(`Notification envoyée à ${userId}: ${data.title}`);
      return notification;
    } catch (error) {
      logger.error('Erreur NotificationService.send:', error.message);
      throw error;
    }
  }

  /**
   * Envoyer une notification de nouveau message
   */
  static async notifyNewMessage(io, userId, senderName, conversationName, messagePreview, conversationId) {
    return this.send(io, userId, {
      type: 'message',
      title: `${senderName} dans ${conversationName}`,
      message: messagePreview,
      actionUrl: `/chat/${conversationId}`,
      priority: 'normal',
      data: { conversationId, senderName },
    });
  }

  /**
   * Envoyer une notification de mention
   */
  static async notifyMention(io, userId, senderName, conversationName, messagePreview, conversationId) {
    return this.send(io, userId, {
      type: 'mention',
      title: `${senderName} vous a mentionné`,
      message: `Dans ${conversationName}: ${messagePreview}`,
      actionUrl: `/chat/${conversationId}`,
      priority: 'high',
      data: { conversationId, senderName },
    });
  }

  /**
   * Envoyer une notification d'appel manqué
   */
  static async notifyMissedCall(io, userId, callerName, callType) {
    return this.send(io, userId, {
      type: 'call_missed',
      title: 'Appel manqué',
      message: `${callerName} a essayé de vous appeler (${callType === 'video' ? 'vidéo' : 'audio'})`,
      actionUrl: '/calls',
      priority: 'high',
      data: { callerName, callType },
    });
  }

  /**
   * Envoyer une notification d'ajout à un groupe
   */
  static async notifyGroupAdded(io, userId, groupName, addedBy, conversationId) {
    return this.send(io, userId, {
      type: 'group_added',
      title: 'Ajouté à un groupe',
      message: `${addedBy} vous a ajouté au groupe "${groupName}"`,
      actionUrl: `/chat/${conversationId}`,
      priority: 'normal',
      data: { groupName, addedBy, conversationId },
    });
  }

  /**
   * Envoyer une notification de retrait d'un groupe
   */
  static async notifyGroupRemoved(io, userId, groupName, removedBy) {
    return this.send(io, userId, {
      type: 'group_removed',
      title: 'Retiré d\'un groupe',
      message: `${removedBy} vous a retiré du groupe "${groupName}"`,
      priority: 'normal',
      data: { groupName, removedBy },
    });
  }

  /**
   * Envoyer une notification système
   */
  static async notifySystem(io, userId, title, message, actionUrl = null) {
    return this.send(io, userId, {
      type: 'system',
      title,
      message,
      actionUrl,
      priority: 'normal',
    });
  }
}

module.exports = NotificationService;
