// src/models/CallLog.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const CallLog = sequelize.define(
  'CallLog',
  {
    id:               { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    caller_id:        { type: DataTypes.CHAR(36), allowNull: false },
    callee_id:        { type: DataTypes.CHAR(36), allowNull: false },
    conversation_id:  { type: DataTypes.CHAR(36), allowNull: true },
    type:             { type: DataTypes.ENUM('audio','video','group_audio','group_video'), defaultValue: 'audio' },
    status:           { type: DataTypes.ENUM('completed','missed','rejected','failed','ongoing'), defaultValue: 'ongoing' },
    started_at:       { type: DataTypes.DATE, allowNull: true },
    ended_at:         { type: DataTypes.DATE, allowNull: true },
    duration_seconds: { type: DataTypes.INTEGER, defaultValue: 0 },
    // ⚠️ recording_path supprimé — colonne absente de la BDD existante
  },
  {
    tableName: 'call_logs',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
  }
);

module.exports = CallLog;
