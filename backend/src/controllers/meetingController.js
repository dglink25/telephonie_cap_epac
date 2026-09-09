// src/controllers/meetingController.js
'use strict';

const crypto = require('crypto');
const jwt    = require('jsonwebtoken');
const logger = require('../utils/logger');

const JITSI_URL        = process.env.JITSI_URL || 'https://meet.jit.si';
const JITSI_APP_ID     = process.env.JITSI_APP_ID || 'cap-epac';
const JITSI_APP_SECRET = process.env.JITSI_APP_SECRET || null; // optionnel

/**
 * Générer un nom de salle unique et mémorable
 */
const generateRoomName = (prefix = '') => {
  const id = crypto.randomBytes(4).toString('hex').toUpperCase();
  return prefix ? `${prefix}-${id}` : `CAPEPAC-${id}`;
};

/**
 * Générer un token JWT Jitsi (si APP_SECRET configuré)
 * Permet de contrôler les accès et pré-remplir le nom/avatar
 */
const generateJitsiToken = (user, roomName, isModerator = false) => {
  if (!JITSI_APP_SECRET) return null;

  const payload = {
    iss: JITSI_APP_ID,
    sub: JITSI_APP_ID,
    aud: 'jitsi',
    exp: Math.floor(Date.now() / 1000) + 8 * 3600, // 8 heures
    room: roomName,
    context: {
      user: {
        id:          user.id,
        name:        user.display_name,
        avatar:      user.avatar_url || '',
        email:       user.email || '',
        moderator:   String(isModerator),
      },
      features: {
        livestreaming: 'false',
        recording:     'false',
        'screen-sharing': 'true',
        'captions':    'true',
      },
    },
  };

  return jwt.sign(payload, JITSI_APP_SECRET);
};

/**
 * POST /api/meetings/create
 * Créer une salle de visioconférence
 */
const createMeeting = async (req, res, next) => {
  try {
    const { name, conversationId, password } = req.body;
    const user = req.user;

    const roomName  = generateRoomName(
      name ? name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 20) : ''
    );
    const token     = generateJitsiToken(user, roomName, true);

    // Construire l'URL de la salle
    let roomUrl = `${JITSI_URL}/${roomName}`;
    if (token) roomUrl += `?jwt=${token}`;

    // URL de partage (sans token — les invités rejoignent sans modération)
    const shareUrl = `${JITSI_URL}/${roomName}`;

    logger.info(`[Meeting] Salle créée: ${roomName} par ${user.display_name}`);

    return res.status(201).json({
      success: true,
      data: {
        roomName,
        roomUrl,
        shareUrl,
        jitsiUrl: JITSI_URL,
        password:  password || null,
        createdBy: user.display_name,
        expiresIn: '8 heures',
      },
    });
  } catch (err) { next(err); }
};

/**
 * POST /api/meetings/join/:roomName
 * Rejoindre une salle existante (génère un token pour l'utilisateur)
 */
const joinMeeting = async (req, res, next) => {
  try {
    const { roomName }   = req.params;
    const { isModerator = false } = req.body;
    const user = req.user;

    const token  = generateJitsiToken(user, roomName, isModerator);
    let roomUrl  = `${JITSI_URL}/${roomName}`;
    if (token) roomUrl += `?jwt=${token}`;

    return res.json({
      success: true,
      data: { roomName, roomUrl, jitsiUrl: JITSI_URL, token },
    });
  } catch (err) { next(err); }
};

/**
 * GET /api/meetings/config
 * Retourner la config Jitsi pour le frontend (URL, appId)
 */
const getConfig = async (req, res) => {
  return res.json({
    success: true,
    data: {
      jitsiUrl:  JITSI_URL,
      appId:     JITSI_APP_ID,
      hasSecret: !!JITSI_APP_SECRET,
    },
  });
};

module.exports = { createMeeting, joinMeeting, getConfig };
