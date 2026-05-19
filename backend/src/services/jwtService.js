// src/services/jwtService.js
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { RefreshToken } = require('../models');
const { blacklistToken } = require('../config/redis');
const logger = require('../utils/logger');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

/**
 * Générer un Access Token JWT
 */
const generateAccessToken = (user) => {
  const jti = crypto.randomBytes(16).toString('hex');
  return jwt.sign(
    {
      sub: user.id,
      username: user.username,
      role: user.role,
      jti,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
};

/**
 * Générer un Refresh Token opaque + le persister en BDD
 */
const generateRefreshToken = async (user, deviceInfo = null) => {
  const rawToken = crypto.randomBytes(64).toString('hex');
  const tokenHash = await bcrypt.hash(rawToken, 10);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  await RefreshToken.create({
    user_id: user.id,
    token_hash: tokenHash,
    device_info: deviceInfo,
    expires_at: expiresAt,
  });

  return rawToken;
};

/**
 * Vérifier et consommer un Refresh Token (rotation)
 */
const verifyRefreshToken = async (rawToken, userId) => {
  const tokens = await RefreshToken.findAll({
    where: { user_id: userId },
  });

  for (const record of tokens) {
    const isValid = await bcrypt.compare(rawToken, record.token_hash);
    if (isValid) {
      if (new Date() > new Date(record.expires_at)) {
        await record.destroy();
        return null; // Expiré
      }
      await record.destroy(); // Rotation: on supprime l'ancien
      return record;
    }
  }
  return null;
};

/**
 * Révoquer tous les refresh tokens d'un utilisateur
 */
const revokeAllTokens = async (userId) => {
  await RefreshToken.destroy({ where: { user_id: userId } });
};

/**
 * Décoder un access token sans vérifier (pour récupérer le jti)
 */
const decodeToken = (token) => {
  try {
    return jwt.decode(token);
  } catch {
    return null;
  }
};

/**
 * Calculer la durée restante d'un token en secondes
 */
const getTokenTTL = (decoded) => {
  if (!decoded?.exp) return 0;
  return Math.max(0, decoded.exp - Math.floor(Date.now() / 1000));
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  revokeAllTokens,
  decodeToken,
  getTokenTTL,
};
