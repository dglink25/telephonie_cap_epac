// src/routes/groups.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const { authenticate } = require('../middleware/auth');
const {
  getGroupInfo, updateGroupInfo, updateGroupAvatar,
  addMembers, removeMember, leaveGroup, updateMemberRole,
} = require('../controllers/groupController');

// Multer pour avatar de groupe
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../../uploads/avatars');
    require('fs').mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `group_${req.params.id}_${Date.now()}${ext}`);
  },
});
const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (['image/jpeg','image/png','image/webp','image/gif'].includes(file.mimetype)) cb(null, true);
    else cb(new Error('Format image non supporté'));
  },
});

// ── Routes ───────────────────────────────────────────────────────
// Infos du groupe
router.get('/:id',                    authenticate, getGroupInfo);

// Modifier nom/description
router.put('/:id',                    authenticate, updateGroupInfo);

// Changer l'avatar
router.post('/:id/avatar',            authenticate, avatarUpload.single('avatar'), updateGroupAvatar);

// Ajouter des membres
router.post('/:id/members',           authenticate, addMembers);

// Retirer un membre (admin)
router.delete('/:id/members/:memberId', authenticate, removeMember);

// Quitter le groupe
router.delete('/:id/leave',           authenticate, leaveGroup);

// Changer le rôle d'un membre
router.put('/:id/members/:memberId/role', authenticate, updateMemberRole);

module.exports = router;
