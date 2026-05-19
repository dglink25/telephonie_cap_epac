// src/routes/calls.js
const express = require('express');
const router = express.Router();
const { authenticate, requireAdmin } = require('../middleware/auth');
const { getCallLogs, getCallStats, getCallById, createCallLog, updateCallLog } = require('../controllers/callController');

/**
 * @swagger
 * /calls:
 *   get:
 *     summary: Journal des appels
 *     tags: [Téléphonie]
 *     security: [{bearerAuth: []}]
 *   post:
 *     summary: Créer une entrée de journal d'appel
 *     tags: [Téléphonie]
 *     security: [{bearerAuth: []}]
 */
router.get('/', authenticate, getCallLogs);
router.post('/', authenticate, createCallLog);

/**
 * @swagger
 * /calls/stats:
 *   get:
 *     summary: Statistiques des appels (admin)
 *     tags: [Téléphonie]
 *     security: [{bearerAuth: []}]
 */
router.get('/stats', authenticate, requireAdmin, getCallStats);

/**
 * @swagger
 * /calls/{id}:
 *   get:
 *     summary: Détail d'un appel
 *     tags: [Téléphonie]
 *     security: [{bearerAuth: []}]
 *   patch:
 *     summary: Mettre à jour le statut d'un appel
 *     tags: [Téléphonie]
 *     security: [{bearerAuth: []}]
 */
router.get('/:id', authenticate, getCallById);
router.patch('/:id', authenticate, updateCallLog);

module.exports = router;
