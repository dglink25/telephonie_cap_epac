// src/models/index.js
const { sequelize } = require('../config/database');
const User = require('./User');
const Conversation = require('./Conversation');
const Message = require('./Message');
const CallLog = require('./CallLog');

// ── ConversationMember (table de jointure) ──────────────────────
const { DataTypes } = require('sequelize');
const ConversationMember = sequelize.define(
  'ConversationMember',
  {
    id: { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    role: { type: DataTypes.ENUM('admin', 'member'), defaultValue: 'member' },
    last_read_at: { type: DataTypes.DATE, allowNull: true },
    is_muted: { type: DataTypes.BOOLEAN, defaultValue: false },
    joined_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  },
  { tableName: 'conversation_members', timestamps: false }
);

// ── MessageReaction ──────────────────────────────────────────────
const MessageReaction = sequelize.define(
  'MessageReaction',
  {
    id: { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    emoji: { type: DataTypes.STRING(10), allowNull: false },
  },
  { tableName: 'message_reactions', timestamps: true, createdAt: 'created_at', updatedAt: false }
);

// ── MessageReadStatus ────────────────────────────────────────────
const MessageReadStatus = sequelize.define(
  'MessageReadStatus',
  {
    id: { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    read_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  },
  { tableName: 'message_read_status', timestamps: false }
);

// ── RefreshToken ─────────────────────────────────────────────────
const RefreshToken = sequelize.define(
  'RefreshToken',
  {
    id: { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    token_hash: { type: DataTypes.TEXT, allowNull: false },
    device_info: { type: DataTypes.STRING(255), allowNull: true },
    expires_at: { type: DataTypes.DATE, allowNull: false },
  },
  { tableName: 'refresh_tokens', timestamps: true, createdAt: 'created_at', updatedAt: false }
);

// ── Associations ─────────────────────────────────────────────────

// User <-> Conversation via ConversationMember
User.belongsToMany(Conversation, { through: ConversationMember, foreignKey: 'user_id', as: 'conversations' });
Conversation.belongsToMany(User, { through: ConversationMember, foreignKey: 'conversation_id', as: 'members' });
ConversationMember.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
ConversationMember.belongsTo(Conversation, { foreignKey: 'conversation_id', as: 'conversation' });

// Message
Message.belongsTo(User, { foreignKey: 'sender_id', as: 'sender' });
Message.belongsTo(Conversation, { foreignKey: 'conversation_id', as: 'conversation' });
Message.belongsTo(Message, { foreignKey: 'reply_to_id', as: 'replyTo' });
Message.hasMany(MessageReaction, { foreignKey: 'message_id', as: 'reactions' });
Message.hasMany(MessageReadStatus, { foreignKey: 'message_id', as: 'readStatuses' });
Conversation.hasMany(Message, { foreignKey: 'conversation_id', as: 'messages' });

// MessageReaction
MessageReaction.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
MessageReadStatus.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// CallLog
CallLog.belongsTo(User, { foreignKey: 'caller_id', as: 'caller' });
CallLog.belongsTo(User, { foreignKey: 'callee_id', as: 'callee' });

// RefreshToken
RefreshToken.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
User.hasMany(RefreshToken, { foreignKey: 'user_id', as: 'refreshTokens' });

// Conversation creator
Conversation.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });

module.exports = {
  sequelize,
  User,
  Conversation,
  ConversationMember,
  Message,
  MessageReaction,
  MessageReadStatus,
  CallLog,
  RefreshToken,
};
