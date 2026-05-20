// src/routes/users.js
const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const path    = require('path');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { validate, schemas }          = require('../middleware/validate');
const {
  getUsers, getUsersAdmin,
  getUserById, updateProfile, uploadAvatar,
  updatePresence, getMyPresence,
  adminCreateUser, adminUpdateUser, adminDeleteUser,
} = require('../controllers/userController');

// ── Multer avatars ───────────────────────────────────────────────
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../../uploads/avatars')),
  filename:    (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `avatar_${req.user.id}_${Date.now()}${ext}`);
  },
});

const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    allowed.includes(file.mimetype) ? cb(null, true) : cb(new Error('Format non supporté'), false);
  },
});

// ── Routes fixes AVANT /:id ──────────────────────────────────────
// IMPORTANT : toutes les routes avec un segment fixe doivent être
// déclarées AVANT router.get('/:id') sinon Express les capture comme ID.

router.get('/me/presence',  authenticate, getMyPresence);
router.put('/me/presence',  authenticate, validate(schemas.updatePresence), updatePresence);
router.put('/me',           authenticate, validate(schemas.updateProfile), updateProfile);
router.post('/me/avatar',   authenticate, avatarUpload.single('avatar'), uploadAvatar);

// Route admin-list : déclarée AVANT /:id
router.get('/admin-list',   authenticate, requireAdmin, getUsersAdmin);

// Routes admin CRUD
router.post('/admin',       authenticate, requireAdmin, validate(schemas.register), adminCreateUser);
router.put('/admin/:id',    authenticate, requireAdmin, adminUpdateUser);
router.delete('/admin/:id', authenticate, requireAdmin, adminDeleteUser);

// ── Routes génériques (APRÈS les routes fixes) ───────────────────
router.get('/',    authenticate, getUsers);
router.get('/:id', authenticate, getUserById);

module.exports = router;