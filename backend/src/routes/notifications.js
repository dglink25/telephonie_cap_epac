// src/routes/notifications.js
const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { authenticate } = require('../middleware/auth');

// Toutes les routes nécessitent l'authentification
router.use(authenticate);

// GET /api/notifications - Récupérer les notifications
router.get('/', notificationController.getNotifications);

// PUT /api/notifications/read-all - Marquer toutes comme lues
router.put('/read-all', notificationController.markAllAsRead);

// DELETE /api/notifications/read - Supprimer toutes les notifications lues
// IMPORTANT: Cette route doit être AVANT /:id pour éviter les conflits
router.delete('/read', notificationController.deleteAllRead);

// PUT /api/notifications/:id/read - Marquer comme lue
router.put('/:id/read', notificationController.markAsRead);

// DELETE /api/notifications/:id - Supprimer une notification
router.delete('/:id', notificationController.deleteNotification);

module.exports = router;
