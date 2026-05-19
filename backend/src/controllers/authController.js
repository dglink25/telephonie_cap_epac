// src/controllers/authController.js
const { User, RefreshToken } = require('../models');
const {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  revokeAllTokens,
  decodeToken,
  getTokenTTL,
} = require('../services/jwtService');
const {
  blacklistToken,
  incrementLoginAttempts,
  resetLoginAttempts,
} = require('../config/redis');
const logger = require('../utils/logger');

const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_DURATION_MINUTES = 30;

/**
 * POST /api/auth/register
 */
const register = async (req, res, next) => {
  try {
    const { username, email, password, display_name, department } = req.body;

    const existing = await User.findOne({ where: { username } });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Ce nom d\'utilisateur est déjà pris' });
    }

    const existingEmail = await User.findOne({ where: { email } });
    if (existingEmail) {
      return res.status(409).json({ success: false, message: 'Cet email est déjà utilisé' });
    }

    const password_hash = await User.hashPassword(password);

    const user = await User.create({
      username,
      email,
      password_hash,
      display_name,
      department: department || null,
      role: 'user',
    });

    logger.info(`Nouvel utilisateur créé: ${username} (${user.id})`);

    // ── Ajout automatique au Groupe Général ──────────────────────
    // Import différé pour éviter la dépendance circulaire
    const { addUserToGroupeGeneral } = require('./conversationController');
    addUserToGroupeGeneral(user.id).catch((err) =>
      logger.warn('Impossible d\'ajouter au Groupe Général:', err.message)
    );
    // ─────────────────────────────────────────────────────────────

    return res.status(201).json({
      success: true,
      message: 'Compte créé avec succès',
      data: { user: user.toPublic() },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/login
 */
const login = async (req, res, next) => {
  try {
    const { username, password } = req.body;
    const clientIp = req.ip;

    const user = await User.findOne({ where: { username } });

    if (!user || !user.is_active) {
      await incrementLoginAttempts(clientIp);
      return res.status(401).json({ success: false, message: 'Identifiant ou mot de passe incorrect' });
    }

    if (user.locked_until && new Date() < new Date(user.locked_until)) {
      const minutesLeft = Math.ceil((new Date(user.locked_until) - new Date()) / (1000 * 60));
      return res.status(403).json({
        success: false,
        message: `Compte verrouillé. Réessayez dans ${minutesLeft} minute(s).`,
      });
    }

    const isValid = await user.verifyPassword(password);
    if (!isValid) {
      user.login_attempts = (user.login_attempts || 0) + 1;

      if (user.login_attempts >= MAX_LOGIN_ATTEMPTS) {
        const lockedUntil = new Date();
        lockedUntil.setMinutes(lockedUntil.getMinutes() + LOCK_DURATION_MINUTES);
        user.locked_until = lockedUntil;
        user.login_attempts = 0;
        await user.save();

        logger.warn(`Compte verrouillé: ${username}`);
        return res.status(403).json({
          success: false,
          message: `Compte verrouillé pour ${LOCK_DURATION_MINUTES} minutes.`,
        });
      }

      await user.save();
      return res.status(401).json({
        success: false,
        message: 'Identifiant ou mot de passe incorrect',
        attemptsLeft: MAX_LOGIN_ATTEMPTS - user.login_attempts,
      });
    }

    user.login_attempts = 0;
    user.locked_until = null;
    user.last_seen_at = new Date();
    await user.save();

    await resetLoginAttempts(clientIp);

    const accessToken = generateAccessToken(user);
    const refreshToken = await generateRefreshToken(user, req.headers['user-agent'] || null);

    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'Strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/api/auth/refresh',
    });

    logger.info(`Connexion réussie: ${username} depuis ${clientIp}`);

    return res.json({
      success: true,
      message: 'Connexion réussie',
      data: { accessToken, user: user.toPublic() },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/refresh
 */
const refresh = async (req, res, next) => {
  try {
    const rawToken = req.cookies?.refresh_token;
    if (!rawToken) return res.status(401).json({ success: false, message: 'Refresh token manquant' });

    const userId = req.body.user_id;
    if (!userId) return res.status(400).json({ success: false, message: 'user_id requis' });

    const tokenRecord = await verifyRefreshToken(rawToken, userId);
    if (!tokenRecord) return res.status(401).json({ success: false, message: 'Refresh token invalide ou expiré' });

    const user = await User.findByPk(userId);
    if (!user || !user.is_active) return res.status(401).json({ success: false, message: 'Utilisateur introuvable' });

    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = await generateRefreshToken(user, req.headers['user-agent']);

    res.cookie('refresh_token', newRefreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'Strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/api/auth/refresh',
    });

    return res.json({ success: true, data: { accessToken: newAccessToken } });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/logout
 */
const logout = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader) {
      const token = authHeader.split(' ')[1];
      const decoded = decodeToken(token);
      if (decoded?.jti) {
        const ttl = getTokenTTL(decoded);
        if (ttl > 0) await blacklistToken(decoded.jti, ttl);
      }
    }

    const rawToken = req.cookies?.refresh_token;
    if (rawToken && req.user?.id) await revokeAllTokens(req.user.id);

    res.clearCookie('refresh_token', { path: '/api/auth/refresh' });
    return res.json({ success: true, message: 'Déconnexion réussie' });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/logout-all
 */
const logoutAll = async (req, res, next) => {
  try {
    await revokeAllTokens(req.user.id);
    res.clearCookie('refresh_token', { path: '/api/auth/refresh' });
    return res.json({ success: true, message: 'Déconnexion de toutes les sessions' });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/auth/me
 */
const me = async (req, res) => {
  return res.json({ success: true, data: { user: req.user.toPublic() } });
};

/**
 * POST /api/auth/change-password
 */
const changePassword = async (req, res, next) => {
  try {
    const { current_password, new_password } = req.body;
    const user = req.user;

    const isValid = await user.verifyPassword(current_password);
    if (!isValid) return res.status(401).json({ success: false, message: 'Mot de passe actuel incorrect' });

    user.password_hash = await User.hashPassword(new_password);
    await user.save();
    await revokeAllTokens(user.id);

    logger.info(`Mot de passe changé: ${user.username}`);
    return res.json({ success: true, message: 'Mot de passe mis à jour. Reconnectez-vous.' });
  } catch (err) {
    next(err);
  }
};

module.exports = { register, login, refresh, logout, logoutAll, me, changePassword };