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

export const useSocketEvents = () => {
  const {
    addMessage, updateMessage, deleteMessage, addReaction, removeReaction,
    addConversation, updateConversation, setTyping, resetUnread,
    loadConversations, loadConversationsDebounced,
  } = useChatStore();
  const { setStatus, setActiveCall, endCall } = useCallStore();
  const { user } = useAuthStore();
  const { addNotification, markAsRead: markNotifRead, deleteNotification } = useNotificationStore();

  const hasLoadedAfterConnect = useRef(false);

  // ── Socket connecté / reconnecté ─────────────────────────────────
  const handleSocketConnected = useCallback(() => {
    loadConversations().catch(() => {});
    hasLoadedAfterConnect.current = true;
  }, [loadConversations]);

  // ── Messages ──────────────────────────────────────────────────────
  const handleNewMessage = useCallback((data: unknown) => {
    const { message } = data as { message: Message };
    addMessage(message);
    loadConversationsDebounced();
  }, [addMessage, loadConversationsDebounced]);

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

  // ── Conversations ─────────────────────────────────────────────────
  const handleNewConversation = useCallback((data: unknown) => {
    const { conversation } = data as { conversation: Conversation };
    addConversation(conversation);
    loadConversationsDebounced();
  }, [addConversation, loadConversationsDebounced]);

  const handleConversationRead = useCallback((data: unknown) => {
    const { conversationId } = data as { conversationId: string };
    resetUnread(conversationId);
  }, [resetUnread]);

  // ── Présence ──────────────────────────────────────────────────────
  const handleUserPresence = useCallback((data: unknown) => {
    const { userId: presenceUserId, status } = data as { userId: string; status: string };
    const { conversations, updateConversation: updateConv } = useChatStore.getState();
    conversations.forEach((conv) => {
      if (conv.type === 'direct') {
        const updated = conv.members.map((m) =>
          m.id === presenceUserId ? { ...m, presence_status: status } : m
        );
        updateConv(conv.id, { members: updated });
      }
    });
  }, []);

  // ── Groupes ───────────────────────────────────────────────────────
  const handleGroupUpdated = useCallback((data: unknown) => {
    const { groupId, ...rest } = data as { groupId: string; [key: string]: unknown };
    updateConversation(groupId, rest as Partial<Conversation>);
    loadConversationsDebounced();
  }, [updateConversation, loadConversationsDebounced]);

  const handleGroupMembersUpdated = useCallback((data: unknown) => {
    loadConversationsDebounced();
  }, [loadConversationsDebounced]);

  // ── Appels ────────────────────────────────────────────────────────
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
    setActiveCall(call);
    // ✅ setStatus('incoming') déclenche la navigation auto dans AppNavigator
    setStatus('incoming');
  }, [setActiveCall, setStatus]);

  const handleCallAccepted = useCallback((data: unknown) => {
    const { callId } = data as { callId: string };
    const { activeCall } = useCallStore.getState();
    if (activeCall?.callId === callId) {
      // ✅ L'appelant vient d'être accepté → aller vers ActiveCall
      setStatus('connecting');
      if (navigationRef.isReady()) {
        (navigationRef as any).navigate('ActiveCall', { isIncoming: false });
      }
    }
  }, [setStatus]);

  const handleCallRejected = useCallback((data: unknown) => {
    const { callId } = data as { callId: string };
    const { activeCall } = useCallStore.getState();
    if (activeCall?.callId === callId) {
      endCall();
      // La navigation vers Tabs sera gérée par AppNavigator via callStatus → 'idle'
    }
  }, [endCall]);

  const handleCallEnded = useCallback((data: unknown) => {
    const { callId } = data as { callId: string; duration?: number };
    const { activeCall } = useCallStore.getState();
    if (activeCall?.callId === callId) {
      endCall();
      // La navigation vers Tabs sera gérée par AppNavigator via callStatus → 'idle'
    }
  }, [endCall]);

  const handleMuteChanged = useCallback((data: unknown) => {
    // Peut être utilisé pour afficher l'état mute de l'autre participant
    // Le callStore gère l'état local, cet event vient de l'autre côté
  }, []);

  const handleVideoChanged = useCallback((data: unknown) => {
    // Idem pour la vidéo
  }, []);

  // ── Notifications ─────────────────────────────────────────────────
  const handleNotificationNew = useCallback((data: unknown) => {
    const { notification } = data as { notification: Notification };
    addNotification(notification);
  }, [addNotification]);

  const handleNotificationMarkRead = useCallback((data: unknown) => {
    const { notificationId } = data as { notificationId: string };
    markNotifRead(notificationId);
  }, [markNotifRead]);

  const handleNotificationDelete = useCallback((data: unknown) => {
    const { notificationId } = data as { notificationId: string };
    deleteNotification(notificationId);
  }, [deleteNotification]);

  // ── Effect principal ─────────────────────────────────────────────
  useEffect(() => {
    if (socketService.isConnected() && !hasLoadedAfterConnect.current) {
      loadConversations().catch(() => {});
      hasLoadedAfterConnect.current = true;
    }

    const unsubs = [
      socketService.on('socket:connected',         handleSocketConnected),
      socketService.on('message:new',              handleNewMessage),
      socketService.on('message:edited',           handleMessageEdited),
      socketService.on('message:deleted',          handleMessageDeleted),
      socketService.on('message:reaction_added',   handleReactionAdded),
      socketService.on('message:reaction_removed', handleReactionRemoved),
      socketService.on('message:typing',           handleTyping),
      socketService.on('conversation:new',         handleNewConversation),
      socketService.on('conversation:read',        handleConversationRead),
      socketService.on('user:presence',            handleUserPresence),
      socketService.on('call:incoming',            handleIncomingCall),
      socketService.on('call:accepted',            handleCallAccepted),
      socketService.on('call:rejected',            handleCallRejected),
      socketService.on('call:ended',               handleCallEnded),
      socketService.on('call:mute-changed',        handleMuteChanged),
      socketService.on('call:video-changed',       handleVideoChanged),
      socketService.on('group:updated',            handleGroupUpdated),
      socketService.on('group:members_updated',    handleGroupMembersUpdated),
      socketService.on('notification:new',         handleNotificationNew),
      socketService.on('notification:mark-read',   handleNotificationMarkRead),
      socketService.on('notification:delete',      handleNotificationDelete),
    ];

    return () => {
      unsubs.forEach((u) => u());
      hasLoadedAfterConnect.current = false;
    };
  }, [
    handleSocketConnected,
    handleNewMessage, handleMessageEdited, handleMessageDeleted,
    handleReactionAdded, handleReactionRemoved, handleTyping,
    handleNewConversation, handleConversationRead, handleUserPresence,
    handleIncomingCall, handleCallAccepted, handleCallRejected,
    handleCallEnded, handleMuteChanged, handleVideoChanged,
    handleGroupUpdated, handleGroupMembersUpdated,
    handleNotificationNew, handleNotificationMarkRead, handleNotificationDelete,
    loadConversations, loadConversationsDebounced,
  ]);
};

// ── Hook WebRTC events (utilisé dans ActiveCallScreen) ───────────
export const useWebRTCEvents = (
  onOffer: (data: unknown) => void,
  onAnswer: (data: unknown) => void,
  onIceCandidate: (data: unknown) => void
) => {
  useEffect(() => {
    const unsubs = [
      socketService.on('webrtc:offer',         onOffer),
      socketService.on('webrtc:answer',        onAnswer),
      socketService.on('webrtc:ice-candidate', onIceCandidate),
    ];
    return () => unsubs.forEach((u) => u());
  }, [onOffer, onAnswer, onIceCandidate]);
};
