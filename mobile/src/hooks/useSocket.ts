// src/hooks/useSocket.ts
import { useEffect, useCallback, useRef } from 'react';
import { socketService } from '../services/socket';
import { useChatStore } from '../store/chatStore';
import { useCallStore } from '../store/callStore';
import { useAuthStore } from '../store/authStore';
import { useNotificationStore } from '../store/notificationStore';
import { navigationRef } from '../navigation/AppNavigator';
import type { Message, Conversation } from '../store/chatStore';
import type { ActiveCall } from '../store/callStore';
import type { Notification } from '../store/notificationStore';

async function showLocalNotification(title: string, body: string, data?: Record<string, string>): Promise<void> {
  try {
    console.log('[PushNotif]', title, '—', body);
  } catch (err) {
    console.warn('[PushNotif] Erreur notification locale:', err);
  }
}

export const useSocketEvents = () => {
  const {
    addMessage, updateMessage, deleteMessage, addReaction, removeReaction,
    addConversation, updateConversation, setTyping, resetUnread,
    loadConversations, loadConversationsDebounced,
  } = useChatStore();
  const { setStatus, setActiveCall, endCall, setPendingOffer } = useCallStore();
  const { user } = useAuthStore();
  const { addNotification } = useNotificationStore();

  const hasLoadedAfterConnect = useRef(false);

  // ── Socket connecté / reconnecté ─────────────────────────────
  const handleSocketConnected = useCallback(() => {
    console.log('[Socket] Reconnecté — rechargement des données...');
    loadConversations().catch(() => {});
    hasLoadedAfterConnect.current = true;
  }, [loadConversations]);

  // ── Nouveau message ───────────────────────────────────────────
  const handleNewMessage = useCallback((data: unknown) => {
    const { message } = data as { message: Message };
    addMessage(message);
    loadConversationsDebounced();

    if (message.sender_id !== user?.id) {
      const senderName = message.sender?.display_name || 'Quelqu\'un';
      let preview = message.content || '';
      if (message.type === 'image') preview = '📷 Image';
      else if (message.type === 'audio') preview = '🎤 Message vocal';
      else if (message.type === 'video') preview = '🎥 Vidéo';
      else if (message.type === 'file') preview = `📎 ${message.file_name || 'Fichier'}`;
      else if (message.type === 'system') return;

      if (preview.length > 80) preview = preview.slice(0, 77) + '…';
      showLocalNotification(senderName, preview, {
        conversationId: message.conversation_id,
        messageId: message.id,
      });
    }
  }, [addMessage, loadConversationsDebounced, user?.id]);

  const handleMessageEdited = useCallback((data: unknown) => {
    const { message } = data as { message: Message };
    updateMessage(message);
    loadConversationsDebounced();
  }, [updateMessage, loadConversationsDebounced]);

  const handleMessageDeleted = useCallback((data: unknown) => {
    const { messageId, conversationId } = data as { messageId: string; conversationId: string };
    deleteMessage(conversationId, messageId);
    loadConversationsDebounced();
  }, [deleteMessage, loadConversationsDebounced]);

  const handleMessagesRead = useCallback((data: unknown) => {
    const { conversationId, userId: readerId } = data as { conversationId: string; userId: string; messageIds: string[] };
    if (readerId !== user?.id) {
      useChatStore.getState().markMessagesAsRead(conversationId, readerId);
    }
  }, [user?.id]);

  const handleMessagesDelivered = useCallback((data: unknown) => {
    const { messageIds, deliveredTo } = data as { messageIds: string[]; deliveredTo: string; deliveredAt: string };
    if (deliveredTo !== user?.id) {
      useChatStore.getState().markMessagesAsDelivered(messageIds);
    }
  }, [user?.id]);

  const handleReactionAdded = useCallback((data: unknown) => {
    const { messageId, userId, emoji } = data as { messageId: string; userId: string; emoji: string };
    const { messages } = useChatStore.getState();
    for (const convId in messages) {
      if (messages[convId].find((m) => m.id === messageId)) {
        addReaction(convId, messageId, userId, emoji);
        break;
      }
    }
  }, [addReaction]);

  const handleReactionRemoved = useCallback((data: unknown) => {
    const { messageId, userId, emoji } = data as { messageId: string; userId: string; emoji: string };
    const { messages } = useChatStore.getState();
    for (const convId in messages) {
      if (messages[convId].find((m) => m.id === messageId)) {
        removeReaction(convId, messageId, userId, emoji);
        break;
      }
    }
  }, [removeReaction]);

  const handleTyping = useCallback((data: unknown) => {
    const { userId: typingUserId, conversationId, isTyping } = data as {
      userId: string; conversationId: string; isTyping: boolean;
    };
    if (typingUserId !== user?.id) {
      setTyping(typingUserId, conversationId, isTyping);
    }
  }, [setTyping, user?.id]);

  const handleNewConversation = useCallback((data: unknown) => {
    const { conversation } = data as { conversation: Conversation };
    addConversation(conversation);
    loadConversationsDebounced();
  }, [addConversation, loadConversationsDebounced]);

  const handleConversationRead = useCallback((data: unknown) => {
    const { conversationId } = data as { conversationId: string };
    resetUnread(conversationId);
  }, [resetUnread]);

  const handleUserPresence = useCallback((data: unknown) => {
    const { userId: presenceUserId, status } = data as { userId: string; status: string };
    const { conversations } = useChatStore.getState();
    conversations.forEach((conv) => {
      if (conv.type === 'direct') {
        const updated = conv.members.map((m) =>
          m.id === presenceUserId ? { ...m, presence_status: status } : m
        );
        updateConversation(conv.id, { members: updated });
      }
    });
  }, [updateConversation]);

  const handleGroupUpdated = useCallback((data: unknown) => {
    const { groupId, ...rest } = data as { groupId: string; [key: string]: unknown };
    updateConversation(groupId, rest as Partial<Conversation>);
    loadConversationsDebounced();
  }, [updateConversation, loadConversationsDebounced]);

  const handleGroupMembersUpdated = useCallback(() => {
    loadConversationsDebounced();
  }, [loadConversationsDebounced]);

  // ── Appels entrants ───────────────────────────────────────────
  const handleIncomingCall = useCallback((data: unknown) => {
    const d = data as {
      callId: string;
      callerId: string;
      callerName: string;
      callerAvatar: string | null;
      type: string;
      isGroupCall?: boolean;
      groupName?: string;
    };
    const call: ActiveCall = {
      callId: d.callId,
      callerId: d.callerId,
      callerName: d.callerName,
      callerAvatar: d.callerAvatar,
      type: d.type as ActiveCall['type'],
      isGroupCall: d.isGroupCall || false,
      groupName: d.groupName,
    };
    // ✅ Effacer toute offre pendante précédente
    setPendingOffer(null);
    setActiveCall(call);
    setStatus('incoming');

    const callType = d.type === 'video' ? 'vidéo' : 'audio';
    showLocalNotification(
      `📞 Appel ${callType} entrant`,
      `${d.callerName} vous appelle`,
      { callId: d.callId, callerId: d.callerId, type: d.type }
    );
  }, [setActiveCall, setStatus, setPendingOffer]);

  // ✅ FIX: L'appelant reçoit call:accepted → naviguer vers ActiveCall
  // ActiveCallScreen va créer la PeerConnection et envoyer l'offre SDP
  const handleCallAccepted = useCallback((data: unknown) => {
    const { callId } = data as { callId: string };
    const { activeCall } = useCallStore.getState();
    if (activeCall?.callId === callId) {
      setStatus('connecting');
      if (navigationRef.isReady()) {
        (navigationRef as any).navigate('ActiveCall', { isIncoming: false });
      }
    }
  }, [setStatus]);

  const handleCallRejected = useCallback((data: unknown) => {
    const { callId } = data as { callId: string };
    const { activeCall } = useCallStore.getState();
    // Terminer seulement si c'est notre appel actif
    if (!activeCall || activeCall.callId === callId) {
      endCall();
    }
  }, [endCall]);

  const handleCallEnded = useCallback((data: unknown) => {
    const { callId } = data as { callId: string };
    const { activeCall } = useCallStore.getState();
    if (activeCall?.callId === callId) {
      endCall();
    }
  }, [endCall]);

  // ✅ FIX CRITIQUE: Stocker l'offre WebRTC dans le store dès réception
  // Elle peut arriver AVANT que ActiveCallScreen soit monté (appelé)
  // ou après (si la navigation est rapide). ActiveCallScreen la consommera.
  const handleWebRTCOffer = useCallback((data: unknown) => {
    const { sdp, callId, fromUserId } = data as { sdp: any; callId: string; fromUserId: string };
    console.log('[Socket] webrtc:offer reçu, stocké dans le store callId=', callId);
    setPendingOffer({ sdp, callId, fromUserId });
  }, [setPendingOffer]);

  // ── Notifications ─────────────────────────────────────────────
  const handleNotificationNew = useCallback((data: unknown) => {
    const { notification } = data as { notification: Notification };
    addNotification(notification);
    if (notification.type !== 'message') {
      showLocalNotification(
        notification.title,
        notification.message || '',
        { notificationId: String(notification.id), actionUrl: notification.action_url || '' }
      );
    }
  }, [addNotification]);

  const handleNotificationUpdated = useCallback((data: unknown) => {
    const { notification } = data as { notification: Notification };
    useNotificationStore.getState().updateNotification?.(notification);
  }, []);

  const handleNotificationDeleted = useCallback((data: unknown) => {
    const { notificationId } = data as { notificationId: string };
    useNotificationStore.getState().deleteNotification(notificationId);
  }, []);

  // ── Effect principal ──────────────────────────────────────────
  useEffect(() => {
    if (socketService.isConnected() && !hasLoadedAfterConnect.current) {
      loadConversations().catch(() => {});
      hasLoadedAfterConnect.current = true;
    }

    socketService.setupAppStateListener();

    const unsubs = [
      socketService.on('socket:connected',           handleSocketConnected),
      socketService.on('message:new',                handleNewMessage),
      socketService.on('message:edited',             handleMessageEdited),
      socketService.on('message:deleted',            handleMessageDeleted),
      socketService.on('messages:read',              handleMessagesRead),
      socketService.on('messages:delivered',         handleMessagesDelivered),
      socketService.on('message:reaction_added',     handleReactionAdded),
      socketService.on('message:reaction_removed',   handleReactionRemoved),
      socketService.on('message:typing',             handleTyping),
      socketService.on('conversation:new',           handleNewConversation),
      socketService.on('conversation:read',          handleConversationRead),
      socketService.on('user:presence',              handleUserPresence),
      socketService.on('call:incoming',              handleIncomingCall),
      socketService.on('call:accepted',              handleCallAccepted),
      socketService.on('call:rejected',              handleCallRejected),
      socketService.on('call:ended',                 handleCallEnded),
      // ✅ FIX: Écouter webrtc:offer au niveau global pour ne jamais le manquer
      socketService.on('webrtc:offer',               handleWebRTCOffer),
      socketService.on('group:updated',              handleGroupUpdated),
      socketService.on('group:members_updated',      handleGroupMembersUpdated),
      socketService.on('notification:new',           handleNotificationNew),
      socketService.on('notification:updated',       handleNotificationUpdated),
      socketService.on('notification:deleted',       handleNotificationDeleted),
    ];

    return () => {
      unsubs.forEach((u) => u());
      hasLoadedAfterConnect.current = false;
    };
  }, [
    handleSocketConnected,
    handleNewMessage, handleMessageEdited, handleMessageDeleted,
    handleMessagesRead, handleMessagesDelivered,
    handleReactionAdded, handleReactionRemoved, handleTyping,
    handleNewConversation, handleConversationRead, handleUserPresence,
    handleIncomingCall, handleCallAccepted, handleCallRejected, handleCallEnded,
    handleWebRTCOffer,
    handleGroupUpdated, handleGroupMembersUpdated,
    handleNotificationNew, handleNotificationUpdated, handleNotificationDeleted,
    loadConversations, loadConversationsDebounced,
  ]);
};

// ── Hook WebRTC (utilisé dans ActiveCallScreen) ───────────────
// ✅ FIX: Écoute uniquement answer et ice-candidate (offer est géré globalement)
export const useWebRTCEvents = (
  onAnswer: (data: unknown) => void,
  onIceCandidate: (data: unknown) => void
) => {
  useEffect(() => {
    const unsubs = [
      socketService.on('webrtc:answer',        onAnswer),
      socketService.on('webrtc:ice-candidate', onIceCandidate),
    ];
    return () => unsubs.forEach((u) => u());
  }, [onAnswer, onIceCandidate]);
};
