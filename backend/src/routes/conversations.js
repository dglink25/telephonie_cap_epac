// src/routes/conversations.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const { authenticate } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validate');
const {
  getConversations, createConversation, getMessages,
  sendMessage, editMessage, deleteMessage,
  addReaction, markAsRead, getEditStatus,
} = require('../controllers/conversationController');

// ── Configuration Multer avancée ────────────────────────────────
const fileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const mime = file.mimetype;
    let subDir = 'documents';
    if (mime.startsWith('image/'))  subDir = 'images';
    if (mime.startsWith('video/'))  subDir = 'videos';
    if (mime.startsWith('audio/'))  subDir = 'audios';

    const uploadPath = path.join(__dirname, '../../uploads', subDir);
    const fs = require('fs');
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = `${Date.now()}_${crypto.randomBytes(8).toString('hex')}${ext}`;
    cb(null, uniqueName);
  },
});

const fileFilter = (req, file, cb) => {
  // Types autorisés
  const allowed = [
    // Images
    'image/jpeg','image/png','image/gif','image/webp',
    // Vidéos
    'video/mp4','video/webm','video/ogg','video/quicktime','video/x-msvideo',
    // Audio
    'audio/mpeg','audio/ogg','audio/wav','audio/webm','audio/aac',
    'audio/mp4','audio/x-m4a','audio/3gpp',
    // Documents
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/zip','application/x-zip-compressed',
    'application/x-rar-compressed','application/x-tar','application/gzip',
    'text/plain','text/csv',
  ];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Type de fichier non autorisé: ${file.mimetype}`), false);
  }
};

const upload = multer({
  storage: fileStorage,
  fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100 Mo max
    files: 1,
  },
});

// ── Routes ───────────────────────────────────────────────────────

router.get('/',  authenticate, getConversations);
router.post('/', authenticate, validate(schemas.createConversation), createConversation);

router.get('/:id/messages',  authenticate, getMessages);
router.post('/:id/messages', authenticate, upload.single('file'), sendMessage);
router.post('/:id/read',     authenticate, markAsRead);

router.put('/:convId/messages/:msgId',             authenticate, validate(schemas.editMessage), editMessage);
router.delete('/:convId/messages/:msgId',           authenticate, deleteMessage);
router.get('/:convId/messages/:msgId/edit-status',  authenticate, getEditStatus);
router.post('/:convId/messages/:msgId/reactions',   authenticate, validate(schemas.addReaction), addReaction);

module.exports = router;
