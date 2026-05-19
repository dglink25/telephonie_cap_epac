// src/routes/conversations.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { authenticate } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validate');
const {
  getConversations,
  createConversation,
  getMessages,
  sendMessage,
  editMessage,
  deleteMessage,
  addReaction,
  markAsRead,
} = require('../controllers/conversationController');

// Multer pour fichiers de messages
const fileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../uploads/files'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `file_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`);
  },
});

const fileUpload = multer({
  storage: fileStorage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 Mo
});

/**
 * @swagger
 * /conversations:
 *   get:
 *     summary: Liste des conversations de l'utilisateur
 *     tags: [Messagerie]
 *     security: [{bearerAuth: []}]
 *   post:
 *     summary: Créer une conversation directe ou de groupe
 *     tags: [Messagerie]
 *     security: [{bearerAuth: []}]
 */
router.get('/', authenticate, getConversations);
router.post('/', authenticate, validate(schemas.createConversation), createConversation);

/**
 * @swagger
 * /conversations/{id}/messages:
 *   get:
 *     summary: Récupérer les messages d'une conversation
 *     tags: [Messagerie]
 *     security: [{bearerAuth: []}]
 *   post:
 *     summary: Envoyer un message dans une conversation
 *     tags: [Messagerie]
 *     security: [{bearerAuth: []}]
 */
router.get('/:id/messages', authenticate, getMessages);
router.post('/:id/messages', authenticate, fileUpload.single('file'), sendMessage);

/**
 * @swagger
 * /conversations/{convId}/messages/{msgId}:
 *   put:
 *     summary: Modifier un message
 *     tags: [Messagerie]
 *     security: [{bearerAuth: []}]
 *   delete:
 *     summary: Supprimer un message
 *     tags: [Messagerie]
 *     security: [{bearerAuth: []}]
 */
router.put('/:convId/messages/:msgId', authenticate, validate(schemas.editMessage), editMessage);
router.delete('/:convId/messages/:msgId', authenticate, deleteMessage);

/**
 * @swagger
 * /conversations/{convId}/messages/{msgId}/reactions:
 *   post:
 *     summary: Ajouter/retirer une réaction emoji
 *     tags: [Messagerie]
 *     security: [{bearerAuth: []}]
 */
router.post('/:convId/messages/:msgId/reactions', authenticate, validate(schemas.addReaction), addReaction);

/**
 * @swagger
 * /conversations/{id}/read:
 *   post:
 *     summary: Marquer la conversation comme lue
 *     tags: [Messagerie]
 *     security: [{bearerAuth: []}]
 */
router.post('/:id/read', authenticate, markAsRead);

module.exports = router;
