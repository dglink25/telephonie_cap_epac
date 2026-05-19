// src/controllers/userController.js
const { Op } = require('sequelize');
const path = require('path');
const fs = require('fs');
const { User } = require('../models');
const { setUserPresence, getUserPresence } = require('../config/redis');
const logger = require('../utils/logger');

/**
 * GET /api/users — Annuaire (admin ou tous les users authentifiés)
 */
const getUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 50, search = '', department } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const where = { is_active: true };
    if (search) {
      where[Op.or] = [
        { display_name: { [Op.like]: `%${search}%` } },
        { username: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
      ];
    }
    if (department) {
      where.department = department;
    }

    const { count, rows } = await User.findAndCountAll({
      where,
      attributes: ['id', 'username', 'display_name', 'email', 'avatar_url', 'role', 'presence_status', 'department', 'phone_extension', 'last_seen_at'],
      order: [['display_name', 'ASC']],
      limit: parseInt(limit),
      offset,
    });

    // Enrichir avec la présence Redis
    const usersWithPresence = await Promise.all(
      rows.map(async (user) => {
        const presence = await getUserPresence(user.id);
        const userData = user.toJSON();
        if (presence && presence.status) {
          userData.presence_status = presence.status;
        }
        return userData;
      })
    );

    return res.json({
      success: true,
      data: {
        users: usersWithPresence,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(count / parseInt(limit)),
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/users/:id — Profil d'un utilisateur
 */
const getUserById = async (req, res, next) => {
  try {
    const user = await User.findOne({
      where: { id: req.params.id, is_active: true },
      attributes: ['id', 'username', 'display_name', 'email', 'avatar_url', 'role', 'presence_status', 'department', 'phone_extension', 'last_seen_at', 'created_at'],
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'Utilisateur introuvable' });
    }

    const presence = await getUserPresence(user.id);
    const userData = user.toJSON();
    if (presence?.status) userData.presence_status = presence.status;

    return res.json({ success: true, data: { user: userData } });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/users/me — Mettre à jour son profil
 */
const updateProfile = async (req, res, next) => {
  try {
    const { display_name, department, phone_extension } = req.body;
    const user = req.user;

    if (display_name !== undefined) user.display_name = display_name;
    if (department !== undefined) user.department = department;
    if (phone_extension !== undefined) user.phone_extension = phone_extension;

    await user.save();

    return res.json({
      success: true,
      message: 'Profil mis à jour',
      data: { user: user.toPublic() },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/users/me/avatar — Upload d'avatar
 */
const uploadAvatar = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Aucun fichier reçu' });
    }

    const user = req.user;

    // Supprimer l'ancien avatar si existe
    if (user.avatar_url) {
      const oldPath = path.join(__dirname, '../../uploads', user.avatar_url);
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }

    user.avatar_url = `/uploads/avatars/${req.file.filename}`;
    await user.save();

    return res.json({
      success: true,
      message: 'Avatar mis à jour',
      data: { avatar_url: user.avatar_url },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/users/me/presence — Mettre à jour le statut de présence
 */
const updatePresence = async (req, res, next) => {
  try {
    const { status } = req.body;
    const user = req.user;

    user.presence_status = status;
    await user.save();

    await setUserPresence(user.id, status);

    // Notifier via socket (si io disponible)
    const io = req.app.get('io');
    if (io) {
      io.emit('user:presence', { userId: user.id, status });
    }

    return res.json({
      success: true,
      message: 'Présence mise à jour',
      data: { status },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/users/me/presence — Obtenir sa propre présence
 */
const getMyPresence = async (req, res, next) => {
  try {
    const presence = await getUserPresence(req.user.id);
    return res.json({
      success: true,
      data: { status: presence?.status || req.user.presence_status },
    });
  } catch (err) {
    next(err);
  }
};

// ── Admin ────────────────────────────────────────────────────────

/**
 * POST /api/admin/users — Créer un utilisateur (admin)
 */
const adminCreateUser = async (req, res, next) => {
  try {
    const { username, email, password, display_name, role, department } = req.body;

    const existing = await User.findOne({ where: { username } });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Nom d\'utilisateur déjà pris' });
    }

    const password_hash = await User.hashPassword(password);
    const user = await User.create({ username, email, password_hash, display_name, role: role || 'user', department });

    logger.info(`Admin créé utilisateur: ${username} par ${req.user.username}`);

    return res.status(201).json({ success: true, data: { user: user.toPublic() } });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/admin/users/:id — Modifier un utilisateur (admin)
 */
const adminUpdateUser = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'Utilisateur introuvable' });

    const { display_name, role, is_active, department, phone_extension } = req.body;
    if (display_name !== undefined) user.display_name = display_name;
    if (role !== undefined) user.role = role;
    if (is_active !== undefined) user.is_active = is_active;
    if (department !== undefined) user.department = department;
    if (phone_extension !== undefined) user.phone_extension = phone_extension;

    await user.save();

    return res.json({ success: true, data: { user: user.toPublic() } });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/admin/users/:id — Désactiver un utilisateur
 */
const adminDeleteUser = async (req, res, next) => {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ success: false, message: 'Impossible de désactiver son propre compte' });
    }

    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'Utilisateur introuvable' });

    user.is_active = false;
    await user.save();

    return res.json({ success: true, message: 'Utilisateur désactivé' });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getUsers,
  getUserById,
  updateProfile,
  uploadAvatar,
  updatePresence,
  getMyPresence,
  adminCreateUser,
  adminUpdateUser,
  adminDeleteUser,
};
