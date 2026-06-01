// src/controllers/notificationController.js
const { Notification, User } = require('../models');
const { Op } = require('sequelize');

/**
 * Récupérer les notifications de l'utilisateur connecté
 */
exports.getNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 50, offset = 0, unread_only = false } = req.query;

    const where = { user_id: userId };
    if (unread_only === 'true') {
      where.is_read = false;
    }

    // Exclure les notifications expirées
    where[Op.or] = [
      { expires_at: null },
      { expires_at: { [Op.gt]: new Date() } },
    ];

    const notifications = await Notification.findAll({
      where,
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    const unreadCount = await Notification.count({
      where: { user_id: userId, is_read: false },
    });

    res.json({
      success: true,
      data: {
        notifications,
        unreadCount,
        total: notifications.length,
      },
    });
  } catch (error) {
    console.error('Erreur getNotifications:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des notifications',
    });
  }
};

/**
 * Marquer une notification comme lue
 */
exports.markAsRead = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const notification = await Notification.findOne({
      where: { id, user_id: userId },
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification introuvable',
      });
    }

    notification.is_read = true;
    notification.read_at = new Date();
    await notification.save();

    res.json({
      success: true,
      data: { notification },
    });
  } catch (error) {
    console.error('Erreur markAsRead:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour',
    });
  }
};

/**
 * Marquer toutes les notifications comme lues
 */
exports.markAllAsRead = async (req, res) => {
  try {
    const userId = req.user.id;

    await Notification.update(
      { is_read: true, read_at: new Date() },
      { where: { user_id: userId, is_read: false } }
    );

    res.json({
      success: true,
      message: 'Toutes les notifications ont été marquées comme lues',
    });
  } catch (error) {
    console.error('Erreur markAllAsRead:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour',
    });
  }
};

/**
 * Supprimer une notification
 */
exports.deleteNotification = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const deleted = await Notification.destroy({
      where: { id, user_id: userId },
    });

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Notification introuvable',
      });
    }

    res.json({
      success: true,
      message: 'Notification supprimée',
    });
  } catch (error) {
    console.error('Erreur deleteNotification:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression',
    });
  }
};

/**
 * Supprimer toutes les notifications lues
 */
exports.deleteAllRead = async (req, res) => {
  try {
    const userId = req.user.id;

    await Notification.destroy({
      where: { user_id: userId, is_read: true },
    });

    res.json({
      success: true,
      message: 'Toutes les notifications lues ont été supprimées',
    });
  } catch (error) {
    console.error('Erreur deleteAllRead:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression',
    });
  }
};

/**
 * Créer une notification (utilisé par le système)
 */
exports.createNotification = async ({
  userId,
  type,
  title,
  message,
  data = null,
  actionUrl = null,
  priority = 'normal',
  expiresAt = null,
}) => {
  try {
    const notification = await Notification.create({
      user_id: userId,
      type,
      title,
      message,
      data,
      action_url: actionUrl,
      priority,
      expires_at: expiresAt,
    });

    return notification;
  } catch (error) {
    console.error('Erreur createNotification:', error);
    throw error;
  }
};
