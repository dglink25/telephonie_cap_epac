// src/socket/index.js
const jwt = require('jsonwebtoken');
const { User, ConversationMember, CallLog } = require('../models');
const { setUserPresence, removeUserPresence } = require('../config/redis');
const logger = require('../utils/logger');

// Map des sockets actifs: userId -> Set<socketId>
const userSockets = new Map();

/**
 * Initialiser les handlers Socket.IO
 * @param {import('socket.io').Server} io
 */
const initSocket = (io) => {
  // ── Middleware d'authentification Socket.IO ────────────────────
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.split(' ')[1];

      if (!token) return next(new Error('Token manquant'));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findByPk(decoded.sub);

      if (!user || !user.is_active) return next(new Error('Utilisateur invalide'));

      socket.userId = user.id;
      socket.user = user;
      next();
    } catch (err) {
      next(new Error('Authentification échouée'));
    }
  });

  io.on('connection', async (socket) => {
    const userId = socket.userId;
    logger.info(`Socket connecté: ${userId} (${socket.id})`);

    // ── Gestion des sockets utilisateur ───────────────────────────
    if (!userSockets.has(userId)) userSockets.set(userId, new Set());
    userSockets.get(userId).add(socket.id);

    // Rejoindre la room personnelle
    socket.join(`user:${userId}`);

    // Rejoindre les rooms de conversations
    const memberRows = await ConversationMember.findAll({
      where: { user_id: userId },
      attributes: ['conversation_id'],
    });
    memberRows.forEach((m) => socket.join(`conv:${m.conversation_id}`));

    // Mettre à jour la présence
    await setUserPresence(userId, 'online', socket.id);
    await User.update({ presence_status: 'online', last_seen_at: new Date() }, { where: { id: userId } });
    socket.broadcast.emit('user:presence', { userId, status: 'online' });

    // ── Événements de messagerie ───────────────────────────────────

    /**
     * Indicateur de saisie
     * @event message:typing
     */
    socket.on('message:typing', ({ conversationId, isTyping }) => {
      socket.to(`conv:${conversationId}`).emit('message:typing', {
        userId,
        conversationId,
        isTyping,
      });
    });

    /**
     * Rejoindre une conversation (pour les nouvelles conversations créées dynamiquement)
     * @event conversation:join
     */
    socket.on('conversation:join', (conversationId) => {
      socket.join(`conv:${conversationId}`);
    });

    /**
     * Quitter une conversation
     * @event conversation:leave
     */
    socket.on('conversation:leave', (conversationId) => {
      socket.leave(`conv:${conversationId}`);
    });

    // ── Événements d'appel (signalisation WebRTC) ──────────────────

    /**
     * Initier un appel
     * @event call:initiate
     */
    socket.on('call:initiate', async ({ calleeId, type = 'audio', callId }) => {
      try {
        // Vérifier que l'appelé existe
        const callee = await User.findByPk(calleeId);
        if (!callee) return;

        // Créer le journal d'appel si pas fourni
        let call;
        if (!callId) {
          call = await CallLog.create({
            caller_id: userId,
            callee_id: calleeId,
            type,
            status: 'ongoing',
          });
        } else {
          call = await CallLog.findByPk(callId);
        }

        // Envoyer la notification d'appel entrant à l'appelé
        io.to(`user:${calleeId}`).emit('call:incoming', {
          callId: call.id,
          callerId: userId,
          callerName: socket.user.display_name,
          callerAvatar: socket.user.avatar_url,
          type,
        });

        // Confirmer à l'appelant
        socket.emit('call:initiated', { callId: call.id });

        logger.info(`Appel ${type} initié: ${userId} -> ${calleeId} (${call.id})`);
      } catch (err) {
        logger.error('Erreur call:initiate:', err);
        socket.emit('call:error', { message: 'Impossible d\'initier l\'appel' });
      }
    });

    /**
     * Accepter un appel
     * @event call:accept
     */
    socket.on('call:accept', async ({ callId }) => {
      try {
        const call = await CallLog.findByPk(callId);
        if (!call) return;

        call.started_at = new Date();
        call.status = 'ongoing';
        await call.save();

        // Notifier l'appelant
        io.to(`user:${call.caller_id}`).emit('call:accepted', {
          callId,
          acceptedBy: userId,
        });

        socket.emit('call:accepted', { callId });
      } catch (err) {
        logger.error('Erreur call:accept:', err);
      }
    });

    /**
     * Rejeter un appel
     * @event call:reject
     */
    socket.on('call:reject', async ({ callId }) => {
      try {
        const call = await CallLog.findByPk(callId);
        if (!call) return;

        call.status = 'rejected';
        call.ended_at = new Date();
        await call.save();

        io.to(`user:${call.caller_id}`).emit('call:rejected', { callId });
      } catch (err) {
        logger.error('Erreur call:reject:', err);
      }
    });

    /**
     * Terminer un appel
     * @event call:end
     */
    socket.on('call:end', async ({ callId }) => {
      try {
        const call = await CallLog.findByPk(callId);
        if (!call) return;

        const now = new Date();
        call.ended_at = now;
        call.status = 'completed';
        if (call.started_at) {
          call.duration_seconds = Math.floor((now - new Date(call.started_at)) / 1000);
        }
        await call.save();

        // Notifier les deux parties
        io.to(`user:${call.caller_id}`).emit('call:ended', { callId, duration: call.duration_seconds });
        io.to(`user:${call.callee_id}`).emit('call:ended', { callId, duration: call.duration_seconds });

        logger.info(`Appel terminé: ${callId} — durée: ${call.duration_seconds}s`);
      } catch (err) {
        logger.error('Erreur call:end:', err);
      }
    });

    // ── Signalisation WebRTC ───────────────────────────────────────

    /**
     * Envoyer une offre SDP
     * @event webrtc:offer
     */
    socket.on('webrtc:offer', ({ targetUserId, sdp, callId }) => {
      io.to(`user:${targetUserId}`).emit('webrtc:offer', {
        sdp,
        callId,
        fromUserId: userId,
      });
    });

    /**
     * Envoyer une réponse SDP
     * @event webrtc:answer
     */
    socket.on('webrtc:answer', ({ targetUserId, sdp, callId }) => {
      io.to(`user:${targetUserId}`).emit('webrtc:answer', {
        sdp,
        callId,
        fromUserId: userId,
      });
    });

    /**
     * Échange de candidats ICE
     * @event webrtc:ice-candidate
     */
    socket.on('webrtc:ice-candidate', ({ targetUserId, candidate, callId }) => {
      io.to(`user:${targetUserId}`).emit('webrtc:ice-candidate', {
        candidate,
        callId,
        fromUserId: userId,
      });
    });

    /**
     * État micro (mute/unmute)
     * @event call:toggle-mute
     */
    socket.on('call:toggle-mute', ({ callId, isMuted, targetUserId }) => {
      if (targetUserId) {
        io.to(`user:${targetUserId}`).emit('call:mute-changed', { callId, userId, isMuted });
      }
    });

    /**
     * État caméra (on/off)
     * @event call:toggle-video
     */
    socket.on('call:toggle-video', ({ callId, videoOn, targetUserId }) => {
      if (targetUserId) {
        io.to(`user:${targetUserId}`).emit('call:video-changed', { callId, userId, videoOn });
      }
    });

    // ── Mise à jour de la présence ────────────────────────────────

    /**
     * @event user:set-status
     */
    socket.on('user:set-status', async ({ status }) => {
      const allowed = ['online', 'away', 'dnd', 'offline'];
      if (!allowed.includes(status)) return;

      await setUserPresence(userId, status);
      await User.update({ presence_status: status }, { where: { id: userId } });
      socket.broadcast.emit('user:presence', { userId, status });
    });

    // ── Déconnexion ────────────────────────────────────────────────
    socket.on('disconnect', async () => {
      const sockets = userSockets.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          userSockets.delete(userId);

          // Mettre en offline seulement si plus de socket actif
          await removeUserPresence(userId);
          await User.update(
            { presence_status: 'offline', last_seen_at: new Date() },
            { where: { id: userId } }
          );
          socket.broadcast.emit('user:presence', { userId, status: 'offline' });

          logger.info(`Utilisateur déconnecté: ${userId}`);
        }
      }
    });

    socket.on('error', (err) => {
      logger.error(`Erreur socket ${socket.id}:`, err);
    });
  });

  return io;
};

/**
 * Utilitaire: obtenir les socketIds actifs d'un utilisateur
 */
const getUserSocketIds = (userId) => {
  return userSockets.get(userId) || new Set();
};

/**
 * Utilitaire: vérifier si un utilisateur est connecté
 */
const isUserOnline = (userId) => {
  const sockets = userSockets.get(userId);
  return sockets && sockets.size > 0;
};

module.exports = { initSocket, getUserSocketIds, isUserOnline };
