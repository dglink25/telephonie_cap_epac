// src/models/Notification.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Notification = sequelize.define('Notification', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    user_id: {
      type: DataTypes.CHAR(36),
      allowNull: false,
      comment: 'Destinataire de la notification',
    },
    type: {
      type: DataTypes.ENUM(
        'message',           // Nouveau message
        'mention',           // Mention dans un message
        'call_missed',       // Appel manqué
        'call_incoming',     // Appel entrant
        'group_added',       // Ajouté à un groupe
        'group_removed',     // Retiré d'un groupe
        'user_status',       // Changement de statut utilisateur
        'system'             // Notification système
      ),
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    data: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Données additionnelles (conversationId, callId, etc.)',
    },
    is_read: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    read_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    action_url: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: 'URL de redirection au clic',
    },
    priority: {
      type: DataTypes.ENUM('low', 'normal', 'high', 'urgent'),
      defaultValue: 'normal',
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Date d\'expiration de la notification',
    },
  }, {
    tableName: 'notifications',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['user_id'] },
      { fields: ['is_read'] },
      { fields: ['type'] },
      { fields: ['created_at'] },
    ],
  });

  Notification.associate = (models) => {
    Notification.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user',
    });
  };

  return Notification;
};
