// src/socket/index.js
const jwt      = require('jsonwebtoken');
const { User, ConversationMember, CallLog } = require('../models');
const { setUserPresence, removeUserPresence } = require('../config/redis');
const logger   = require('../utils/logger');

// Map des sockets actifs : userId → Set<socketId>
const userSockets = new Map();

const initSocket = (io) => {

  // ── Middleware d'authentification ───────────────────────────────
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.split(' ')[1];

      if (!token) return next(new Error('Token manquant'));

      let decoded;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
      } catch (e) {
        return next(new Error('Token invalide ou expiré'));
      }

      const user = await User.findByPk(decoded.sub);
      if (!user || !user.is_active) return next(new Error('Utilisateur invalide'));

      socket.userId = user.id;
      socket.user   = user;
      next();
    } catch (err) {
      next(new Error('Authentification échouée'));
    }
  });

  io.on('connection', async (socket) => {
    const userId = socket.userId;
    logger.info(`Socket connecté: ${userId} (${socket.id})`);

    // ── Gestion des sockets utilisateur ──────────────────────────
    if (!userSockets.has(userId)) userSockets.set(userId, new Set());
    userSockets.get(userId).add(socket.id);

    socket.join(`user:${userId}`);

    // Rejoindre toutes les conversations de l'utilisateur
    try {
      const memberRows = await ConversationMember.findAll({
        where: { user_id: userId },
        attributes: ['conversation_id'],
      });
      memberRows.forEach((m) => socket.join(`conv:${m.conversation_id}`));
    } catch (err) {
      logger.warn(`Erreur chargement conversations pour ${userId}:`, err.message);
    }

    // Présence en ligne
    await setUserPresence(userId, 'online', socket.id);
    await User.update(
      { presence_status: 'online', last_seen_at: new Date() },
      { where: { id: userId } }
    );
    socket.broadcast.emit('user:presence', { userId, status: 'online' });

    // ── Messagerie ────────────────────────────────────────────────

    socket.on('message:typing', ({ conversationId, isTyping }) => {
      socket.to(`conv:${conversationId}`).emit('message:typing', { userId, conversationId, isTyping });
    });

    socket.on('conversation:join', (conversationId) => socket.join(`conv:${conversationId}`));
    socket.on('conversation:leave', (conversationId) => socket.leave(`conv:${conversationId}`));

    // ── Signalisation d'appel ────────────────────────────────────

    /**
     * Initier un appel
     */
    socket.on('call:initiate', async ({ calleeId, type = 'audio', callId }) => {
      try {
        const callee = await User.findByPk(calleeId);
        if (!callee) {
          socket.emit('call:error', { message: 'Utilisateur introuvable' });
          return;
        }

        // Créer ou récupérer le journal d'appel
        let call;
        if (callId) {
          call = await CallLog.findByPk(callId);
        }
        if (!call) {
          call = await CallLog.create({
            caller_id: userId,
            callee_id: calleeId,
            type,
            status: 'ongoing',
          });
        }

        // Notifier l'appelé
        io.to(`user:${calleeId}`).emit('call:incoming', {
          callId:      call.id,
          callerId:    userId,
          callerName:  socket.user.display_name,
          callerAvatar: socket.user.avatar_url,
          type,
        });

        // Confirmer à l'appelant avec le vrai callId
        socket.emit('call:initiated', { callId: call.id });

        logger.info(`Appel ${type} initié: ${userId} -> ${calleeId} (${call.id})`);
      } catch (err) {
        logger.error('Erreur call:initiate:', err.message);
        socket.emit('call:error', { message: 'Impossible d\'initier l\'appel' });
      }
    });

    /**
     * Accepter un appel — l'appelé décroche
     */
    socket.on('call:accept', async ({ callId }) => {
      try {
        const call = await CallLog.findByPk(callId);
        if (!call) {
          socket.emit('call:error', { message: 'Appel introuvable' });
          return;
        }

        call.started_at = new Date();
        call.status     = 'ongoing';
        await call.save();

        // ✅ Notifier l'appelant qu'il peut envoyer l'offre SDP
        io.to(`user:${call.caller_id}`).emit('call:accepted', {
          callId,
          acceptedBy: userId,
        });

        // Confirmer à l'appelé aussi
        socket.emit('call:accepted', { callId });

        logger.info(`Appel accepté: ${callId} par ${userId}`);
      } catch (err) {
        logger.error('Erreur call:accept:', err.message);
        socket.emit('call:error', { message: 'Erreur lors de l\'acceptation' });
      }
    });

    /**
     * Rejeter un appel
     */
    socket.on('call:reject', async ({ callId }) => {
      try {
        const call = await CallLog.findByPk(callId);
        if (!call) return;

        call.status   = 'rejected';
        call.ended_at = new Date();
        await call.save();

        io.to(`user:${call.caller_id}`).emit('call:rejected', { callId });
        logger.info(`Appel rejeté: ${callId} par ${userId}`);
      } catch (err) {
        logger.error('Erreur call:reject:', err.message);
      }
    });

    /**
     * Terminer un appel
     */
    socket.on('call:end', async ({ callId }) => {
      try {
        const call = await CallLog.findByPk(callId);
        if (!call) return;

        const now = new Date();
        call.ended_at = now;
        call.status   = 'completed';
        if (call.started_at) {
          call.duration_seconds = Math.floor(
            (now - new Date(call.started_at)) / 1000
          );
        }
        await call.save();

        io.to(`user:${call.caller_id}`).emit('call:ended', { callId, duration: call.duration_seconds });
        io.to(`user:${call.callee_id}`).emit('call:ended', { callId, duration: call.duration_seconds });

        logger.info(`Appel terminé: ${callId} — durée: ${call.duration_seconds}s`);
      } catch (err) {
        logger.error('Erreur call:end:', err.message);
      }
    });

    // ── Signalisation WebRTC ──────────────────────────────────────

    socket.on('webrtc:offer', ({ targetUserId, sdp, callId }) => {
      logger.info(`[WebRTC] offer: ${userId} → ${targetUserId} callId=${callId}`);
      io.to(`user:${targetUserId}`).emit('webrtc:offer', {
        sdp, callId, fromUserId: userId,
      });
    });

    socket.on('webrtc:answer', ({ targetUserId, sdp, callId }) => {
      logger.info(`[WebRTC] answer: ${userId} → ${targetUserId} callId=${callId}`);
      io.to(`user:${targetUserId}`).emit('webrtc:answer', {
        sdp, callId, fromUserId: userId,
      });
    });

    socket.on('webrtc:ice-candidate', ({ targetUserId, candidate, callId }) => {
      io.to(`user:${targetUserId}`).emit('webrtc:ice-candidate', {
        candidate, callId, fromUserId: userId,
      });
    });

    socket.on('call:toggle-mute', ({ callId, isMuted, targetUserId }) => {
      if (targetUserId) {
        io.to(`user:${targetUserId}`).emit('call:mute-changed', { callId, userId, isMuted });
      }
    });

    socket.on('call:toggle-video', ({ callId, videoOn, targetUserId }) => {
      if (targetUserId) {
        io.to(`user:${targetUserId}`).emit('call:video-changed', { callId, userId, videoOn });
      }
    });

    // ── Présence ──────────────────────────────────────────────────

    socket.on('user:set-status', async ({ status }) => {
      const allowed = ['online','away','dnd','offline'];
      if (!allowed.includes(status)) return;
      await setUserPresence(userId, status);
      await User.update({ presence_status: status }, { where: { id: userId } });
      socket.broadcast.emit('user:presence', { userId, status });
    });

    // ── Déconnexion ───────────────────────────────────────────────

    socket.on('disconnect', async () => {
      const sockets = userSockets.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          userSockets.delete(userId);
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
      logger.error(`Erreur socket ${socket.id}:`, err.message);
    });
  });

  return io;
};

const getUserSocketIds = (userId) => userSockets.get(userId) || new Set();
const isUserOnline     = (userId) => {
  const s = userSockets.get(userId);
  return s && s.size > 0;
};

module.exports = { initSocket, getUserSocketIds, isUserOnline };
