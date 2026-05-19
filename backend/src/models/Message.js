// src/models/Message.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Message = sequelize.define(
  'Message',
  {
    id: {
      type: DataTypes.CHAR(36),
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    conversation_id: {
      type: DataTypes.CHAR(36),
      allowNull: false,
    },
    sender_id: {
      type: DataTypes.CHAR(36),
      allowNull: false,
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    type: {
      type: DataTypes.ENUM('text', 'image', 'file', 'system', 'audio'),
      defaultValue: 'text',
    },
    reply_to_id: {
      type: DataTypes.CHAR(36),
      allowNull: true,
    },
    file_url: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    file_name: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    file_size: {
      type: DataTypes.BIGINT,
      allowNull: true,
    },
    file_mime: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    is_edited: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    is_deleted: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    is_pinned: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  },
  {
    tableName: 'messages',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
);

module.exports = Message;
