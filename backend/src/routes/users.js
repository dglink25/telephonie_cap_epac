// src/routes/users.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const sharp = require('sharp');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validate');
const {
  getUsers,
  getUserById,
  updateProfile,
  uploadAvatar,
  updatePresence,
  getMyPresence,
  adminCreateUser,
  adminUpdateUser,
  adminDeleteUser,
} = require('../controllers/userController');

// Configuration Multer pour avatars
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../uploads/avatars'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `avatar_${req.user.id}_${Date.now()}${ext}`);
  },
});

const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 Mo
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Format d\'image non supporté'), false);
  },
});

// ── Routes publiques (authentifiées) ────────────────────────────

/**
 * @swagger
 * /users:
 *   get:
 *     summary: Annuaire des utilisateurs
 *     tags: [Utilisateurs]
 *     security: [{bearerAuth: []}]
 *     parameters:
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: department
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50 }
 */
router.get('/', authenticate, getUsers);

/**
 * @swagger
 * /users/me:
 *   put:
 *     summary: Mettre à jour son profil
 *     tags: [Utilisateurs]
 *     security: [{bearerAuth: []}]
 */
router.put('/me', authenticate, validate(schemas.updateProfile), updateProfile);

/**
 * @swagger
 * /users/me/avatar:
 *   post:
 *     summary: Changer sa photo de profil
 *     tags: [Utilisateurs]
 *     security: [{bearerAuth: []}]
 */
router.post('/me/avatar', authenticate, avatarUpload.single('avatar'), uploadAvatar);

/**
 * @swagger
 * /users/me/presence:
 *   get:
 *     summary: Obtenir son statut de présence
 *     tags: [Utilisateurs]
 *     security: [{bearerAuth: []}]
 *   put:
 *     summary: Mettre à jour son statut de présence
 *     tags: [Utilisateurs]
 *     security: [{bearerAuth: []}]
 */
router.get('/me/presence', authenticate, getMyPresence);
router.put('/me/presence', authenticate, validate(schemas.updatePresence), updatePresence);

/**
 * @swagger
 * /users/{id}:
 *   get:
 *     summary: Profil d'un utilisateur par ID
 *     tags: [Utilisateurs]
 *     security: [{bearerAuth: []}]
 */
router.get('/:id', authenticate, getUserById);

// ── Routes Admin ─────────────────────────────────────────────────

/**
 * @swagger
 * /users/admin:
 *   post:
 *     summary: Créer un utilisateur (admin uniquement)
 *     tags: [Administration]
 *     security: [{bearerAuth: []}]
 */
router.post('/admin', authenticate, requireAdmin, validate(schemas.register), adminCreateUser);

/**
 * @swagger
 * /users/admin/{id}:
 *   put:
 *     summary: Modifier un utilisateur (admin)
 *     tags: [Administration]
 *     security: [{bearerAuth: []}]
 *   delete:
 *     summary: Désactiver un utilisateur (admin)
 *     tags: [Administration]
 *     security: [{bearerAuth: []}]
 */
router.put('/admin/:id', authenticate, requireAdmin, adminUpdateUser);
router.delete('/admin/:id', authenticate, requireAdmin, adminDeleteUser);

module.exports = router;
