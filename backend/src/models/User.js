// src/models/User.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const bcrypt = require('bcrypt');

const User = sequelize.define(
  'User',
  {
    id: {
      type: DataTypes.CHAR(36),
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    username: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      validate: {
        len: [3, 50],
        is: /^[a-zA-Z0-9._-]+$/,
      },
    },
    email: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      validate: { isEmail: true },
    },
    password_hash: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    display_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    avatar_url: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    role: {
      type: DataTypes.ENUM('admin', 'user'),
      defaultValue: 'user',
    },
    presence_status: {
      type: DataTypes.ENUM('online', 'away', 'dnd', 'offline'),
      defaultValue: 'offline',
    },
    department: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    phone_extension: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    login_attempts: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    locked_until: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    last_seen_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: 'users',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
);

// Méthode pour vérifier le mot de passe
User.prototype.verifyPassword = async function (password) {
  return bcrypt.compare(password, this.password_hash);
};

// Méthode pour hacher le mot de passe
User.hashPassword = async (password) => {
  return bcrypt.hash(password, 12);
};

// Méthode pour retourner les données publiques
User.prototype.toPublic = function () {
  const { password_hash, login_attempts, locked_until, ...data } = this.toJSON();
  return data;
};

module.exports = User;
