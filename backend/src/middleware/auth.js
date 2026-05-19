// src/middleware/auth.js
const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { isTokenBlacklisted } = require('../config/redis');
const logger = require('../utils/logger');

/**
 * Middleware de vérification du JWT d'accès
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Token d\'authentification requis',
      });
    }

    const token = authHeader.split(' ')[1];

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ success: false, message: 'Token expiré' });
      }
      return res.status(401).json({ success: false, message: 'Token invalide' });
    }

    // Vérifier la blacklist
    if (decoded.jti) {
      const blacklisted = await isTokenBlacklisted(decoded.jti);
      if (blacklisted) {
        return res.status(401).json({ success: false, message: 'Token révoqué' });
      }
    }

    // Charger l'utilisateur
    const user = await User.findByPk(decoded.sub);
    if (!user || !user.is_active) {
      return res.status(401).json({ success: false, message: 'Utilisateur non trouvé ou désactivé' });
    }

    // Vérifier si le compte est verrouillé
    if (user.locked_until && new Date() < new Date(user.locked_until)) {
      return res.status(403).json({
        success: false,
        message: 'Compte temporairement verrouillé',
        lockedUntil: user.locked_until,
      });
    }

    req.user = user;
    req.tokenDecoded = decoded;
    next();
  } catch (err) {
    logger.error('Erreur middleware auth:', err);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

/**
 * Middleware de vérification du rôle admin
 */
const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Accès réservé aux administrateurs',
    });
  }
  next();
};

/**
 * Middleware optionnel (pas d'erreur si pas de token)
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findByPk(decoded.sub);
    if (user && user.is_active) {
      req.user = user;
    }
  } catch {
    // Token invalide: continuer sans user
  }
  next();
};

module.exports = { authenticate, requireAdmin, optionalAuth };
