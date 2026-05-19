// src/middleware/rateLimiter.js
const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');

// Rate limiter public (endpoints non authentifiés)
const publicLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`Rate limit dépassé: ${req.ip} sur ${req.path}`);
    res.status(429).json({
      success: false,
      message: 'Trop de requêtes. Veuillez patienter.',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000),
    });
  },
});

// Rate limiter authentifié
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 1000,
  skip: (req) => !req.user,
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter spécifique pour le login (anti-brute force)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  handler: (req, res) => {
    logger.warn(`Tentatives login excessives: ${req.ip}`);
    res.status(429).json({
      success: false,
      message: 'Trop de tentatives de connexion. Attendez 15 minutes.',
    });
  },
});

// Middleware de gestion centralisée des erreurs
const errorHandler = (err, req, res, next) => {
  logger.error({
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    path: req.path,
    method: req.method,
    userId: req.user?.id,
  });

  if (err.name === 'SequelizeValidationError') {
    return res.status(422).json({
      success: false,
      message: 'Erreur de validation',
      errors: err.errors.map((e) => ({ field: e.path, message: e.message })),
    });
  }

  if (err.name === 'SequelizeUniqueConstraintError') {
    return res.status(409).json({
      success: false,
      message: 'Cette ressource existe déjà',
    });
  }

  if (err.name === 'MulterError') {
    return res.status(400).json({
      success: false,
      message: err.code === 'LIMIT_FILE_SIZE' ? 'Fichier trop volumineux (max 100Mo)' : err.message,
    });
  }

  const status = err.statusCode || err.status || 500;
  res.status(status).json({
    success: false,
    message: status === 500 ? 'Erreur interne du serveur' : err.message,
  });
};

// Middleware 404
const notFound = (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route introuvable: ${req.method} ${req.path}`,
  });
};

module.exports = { publicLimiter, authLimiter, loginLimiter, errorHandler, notFound };
