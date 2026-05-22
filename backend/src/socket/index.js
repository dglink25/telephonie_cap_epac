// src/socket/index.js
const jwt      = require('jsonwebtoken');
const { User, ConversationMember, CallLog, Conversation } = require('../models');
const { setUserPresence, removeUserPresence } = require('../config/redis');
const logger   = require('../utils/logger');

// Map des sockets actifs : userId → Set<socketId>
const userSockets = new Map();

// Map des appels de groupe en cours : callId → { callerId, memberIds: Set, acceptedBy: Set }
const groupCallSessions = new Map();

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
     * ✅ FIX: Support appel de groupe — notify tous les membres sauf l'appelant
     */
    socket.on('call:initiate', async ({ calleeId, type = 'audio', callId, conversationId }) => {
      try {
        // ── Créer ou récupérer le journal d'appel ─────────────────
        let call;
        if (callId) {
          call = await CallLog.findByPk(callId);
        }
        if (!call) {
          call = await CallLog.create({
            caller_id:       userId,
            callee_id:       calleeId, // gardé pour compat DB (premier membre cible)
            conversation_id: conversationId || null,
            type,
            status: 'ongoing',
          });
        }

        // ── Appel direct (1-1) ────────────────────────────────────
        if (!conversationId) {
          const callee = await User.findByPk(calleeId);
          if (!callee) {
            socket.emit('call:error', { message: 'Utilisateur introuvable' });
            return;
          }

          io.to(`user:${calleeId}`).emit('call:incoming', {
            callId:      call.id,
            callerId:    userId,
            callerName:  socket.user.display_name,
            callerAvatar: socket.user.avatar_url,
            type,
          });

          socket.emit('call:initiated', { callId: call.id });
          logger.info(`Appel ${type} initié: ${userId} -> ${calleeId} (${call.id})`);
          return;
        }

        // ── Appel de groupe ───────────────────────────────────────
        // Récupérer tous les membres actifs de la conversation sauf l'appelant
        const conversation = await Conversation.findByPk(conversationId);
        const memberRows   = await ConversationMember.findAll({
          where: { conversation_id: conversationId },
          attributes: ['user_id'],
        });

        const memberIds = memberRows
          .map((m) => m.user_id)
          .filter((id) => id !== userId);

        if (!memberIds.length) {
          socket.emit('call:error', { message: 'Aucun autre membre dans ce groupe' });
          return;
        }

        // ✅ Enregistrer la session de groupe dans la map en mémoire
        groupCallSessions.set(call.id, {
          callerId:   userId,
          memberIds:  new Set(memberIds),
          acceptedBy: new Set(),
          type,
          conversationId,
        });

        // ✅ Notifier TOUS les membres du groupe
        const groupName = conversation?.name || 'Groupe';
        for (const memberId of memberIds) {
          io.to(`user:${memberId}`).emit('call:incoming', {
            callId:      call.id,
            callerId:    userId,
            callerName:  socket.user.display_name,
            callerAvatar: socket.user.avatar_url,
            type,
            isGroupCall: true,
            groupName,
          });
        }

        socket.emit('call:initiated', { callId: call.id });
        logger.info(`Appel de groupe ${type} initié: ${userId} -> ${memberIds.length} membres (${call.id})`);

      } catch (err) {
        logger.error('Erreur call:initiate:', err.message);
        socket.emit('call:error', { message: 'Impossible d\'initier l\'appel' });
      }
    });

    /**
     * Accepter un appel — l'appelé décroche
     * ✅ FIX: Pour les appels de groupe, les autres membres continuent à sonner
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

        // ── Gestion appel de groupe ──────────────────────────────
        const session = groupCallSessions.get(callId);
        if (session) {
          session.acceptedBy.add(userId);

          // ✅ Les autres membres qui n'ont pas encore décroché continuent à sonner
          // (on ne fait rien — leur modal est toujours affiché)
          // On log juste pour le suivi
          const stillRinging = [...session.memberIds].filter(
            (id) => !session.acceptedBy.has(id) && id !== userId
          );
          logger.info(`[GroupCall] ${callId}: ${userId} a décroché. Sonnent encore: ${stillRinging.length} membres`);
        }

        logger.info(`Appel accepté: ${callId} par ${userId}`);
      } catch (err) {
        logger.error('Erreur call:accept:', err.message);
        socket.emit('call:error', { message: 'Erreur lors de l\'acceptation' });
      }
    });

    /**
     * Rejeter un appel
     * ✅ FIX: Pour les appels de groupe, notifier seulement l'appelant
     *         (les autres membres continuent à sonner)
     */
    socket.on('call:reject', async ({ callId }) => {
      try {
        const call = await CallLog.findByPk(callId);
        if (!call) return;

        const session = groupCallSessions.get(callId);

        if (session) {
          // ── Appel de groupe : un membre refuse ──────────────────
          session.memberIds.delete(userId);

          // Notifier l'appelant que ce membre a refusé (optionnel, pour UI)
          io.to(`user:${call.caller_id}`).emit('call:member_rejected', {
            callId,
            rejectedBy: userId,
          });

          // ✅ Si TOUS les membres ont refusé → appel vraiment rejeté
          const remaining = [...session.memberIds].filter(
            (id) => !session.acceptedBy.has(id)
          );
          if (remaining.length === 0 && session.acceptedBy.size === 0) {
            call.status   = 'rejected';
            call.ended_at = new Date();
            await call.save();
            io.to(`user:${call.caller_id}`).emit('call:rejected', { callId });
            groupCallSessions.delete(callId);
            logger.info(`[GroupCall] ${callId}: tous les membres ont refusé`);
          } else {
            logger.info(`[GroupCall] ${callId}: ${userId} a refusé, ${remaining.length} membre(s) sonnent encore`);
          }

        } else {
          // ── Appel direct ──────────────────────────────────────
          call.status   = 'rejected';
          call.ended_at = new Date();
          await call.save();
          io.to(`user:${call.caller_id}`).emit('call:rejected', { callId });
        }

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

        // ✅ FIX: Notifier tous les participants (direct + groupe)
        const session = groupCallSessions.get(callId);
        if (session) {
          // Notifier tous les membres du groupe (ceux qui sonnent encore inclus)
          for (const memberId of session.memberIds) {
            io.to(`user:${memberId}`).emit('call:ended', {
              callId,
              duration: call.duration_seconds,
            });
          }
          groupCallSessions.delete(callId);
        } else {
          io.to(`user:${call.caller_id}`).emit('call:ended', { callId, duration: call.duration_seconds });
          io.to(`user:${call.callee_id}`).emit('call:ended', { callId, duration: call.duration_seconds });
        }

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