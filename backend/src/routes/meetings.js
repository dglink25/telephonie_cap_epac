// src/routes/meetings.js
'use strict';

const express = require('express');
const router  = express.Router();
const { authenticate } = require('../middleware/auth');
const { createMeeting, joinMeeting, getConfig } = require('../controllers/meetingController');

// Config Jitsi publique (pas besoin de JWT)
router.get('/config', authenticate, getConfig);

// Créer une salle
router.post('/create', authenticate, createMeeting);

// Rejoindre une salle
router.post('/join/:roomName', authenticate, joinMeeting);

module.exports = router;
