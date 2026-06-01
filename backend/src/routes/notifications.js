// src/routes/notifications.js
const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { authenticate } = require('../middleware/auth');

// Toutes les routes nécessitent l'authentification
router.use(authenticate);

// GET /api/notifications - Récupérer les notifications
router.get('/', notificationController.getNotifications);

// PUT /api/notifications/:id/read - Marquer comme lue
router.put('/:id/read', notificationController.markAsRead);

// PUT /api/notifications/read-all - Marquer toutes comme lues
router.put('/read-all', notificationController.markAllAsRead);

// DELETE /api/notifications/:id - Supprimer une notification
router.delete('/:id', notificationController.deleteNotification);

// DELETE /api/notifications/read - Supprimer toutes les notifications lues
router.delete('/read', notificationController.deleteAllRead);

module.exports = router;
