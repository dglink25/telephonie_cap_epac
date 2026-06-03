// src/hooks/useSocket.ts
import { useEffect, useCallback } from 'react';
import { socketService } from '../services/socket';
import { useChatStore } from '../store/chatStore';
import { useCallStore } from '../store/callStore';
import { useAuthStore } from '../store/authStore';
import { useNotificationStore } from '../store/notificationStore';
import type { Message, Conversation } from '../store/chatStore';
import type { ActiveCall } from '../store/callStore';
import type { Notification } from '../store/notificationStore';

export const useSocketEvents = () => {
  const { addMessage, updateMessage, deleteMessage, addReaction, removeReaction,
    addConversation, updateConversation, setTyping, resetUnread } = useChatStore();
  const { setStatus, setActiveCall, endCall, addToHistory } = useCallStore();
  const { user } = useAuthStore();
  const { addNotification, markAsRead: markNotificationAsRead, deleteNotification } = useNotificationStore();

  const handleNewMessage = useCallback((data: unknown) => {
    const { message } = data as { message: Message };
    console.log('[useSocket] New message received:', message.id, 'convId:', message.conversation_id);
    addMessage(message);
  }, [addMessage]);

  const handleMessageEdited = useCallback((data: unknown) => {
    const { message } = data as { message: Message };
    updateMessage(message);
  }, [updateMessage]);

  const handleMessageDeleted = useCallback((data: unknown) => {
    const { messageId, conversationId } = data as { messageId: string; conversationId: string };
    deleteMessage(conversationId, messageId);
  }, [deleteMessage]);

  const handleReactionAdded = useCallback((data: unknown) => {
    const { messageId, userId, emoji } = data as { messageId: string; userId: string; emoji: string };
    // Récupérer le convId depuis les messages actifs — simplifié
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
  }, [addConversation]);

  const handleConversationRead = useCallback((data: unknown) => {
    const { conversationId } = data as { conversationId: string };
    resetUnread(conversationId);
  }, [resetUnread]);

  const handleUserPresence = useCallback((data: unknown) => {
    const { userId: presenceUserId, status } = data as { userId: string; status: string };
    const { conversations, updateConversation: updateConv } = useChatStore.getState();
    // Mettre à jour la présence dans les conversations directes
    conversations.forEach((conv) => {
      if (conv.type === 'direct') {
        const updated = conv.members.map((m) =>
          m.id === presenceUserId ? { ...m, presence_status: status } : m
        );
        if (updated !== conv.members) {
          updateConv(conv.id, { members: updated });
        }
      }
    });
  }, []);

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
    setStatus('incoming');
  }, [setActiveCall, setStatus]);

  const handleCallAccepted = useCallback((data: unknown) => {
    const { callId } = data as { callId: string };
    const { activeCall } = useCallStore.getState();
    if (activeCall?.callId === callId) {
      setStatus('connecting');
    }
  }, [setStatus]);

  const handleCallRejected = useCallback((data: unknown) => {
    const { callId } = data as { callId: string };
    const { activeCall } = useCallStore.getState();
    if (activeCall?.callId === callId) {
      endCall();
    }
  }, [endCall]);

  const handleCallEnded = useCallback((data: unknown) => {
    const { callId, duration } = data as { callId: string; duration?: number };
    const { activeCall } = useCallStore.getState();
    if (activeCall?.callId === callId) {
      endCall();
    }
  }, [endCall]);

  const handleGroupUpdated = useCallback((data: unknown) => {
    const { groupId, ...rest } = data as { groupId: string; [key: string]: unknown };
    updateConversation(groupId, rest as Partial<Conversation>);
  }, [updateConversation]);

  const handleGroupMembersUpdated = useCallback((data: unknown) => {
    // Recharger les infos du groupe si besoin
  }, []);

  const handleNotificationNew = useCallback((data: unknown) => {
    const { notification } = data as { notification: Notification };
    addNotification(notification);
  }, [addNotification]);

  const handleNotificationMarkRead = useCallback((data: unknown) => {
    const { notificationId } = data as { notificationId: string };
    markNotificationAsRead(notificationId);
  }, [markNotificationAsRead]);

  const handleNotificationDelete = useCallback((data: unknown) => {
    const { notificationId } = data as { notificationId: string };
    deleteNotification(notificationId);
  }, [deleteNotification]);

  useEffect(() => {
    const unsubscribers = [
      socketService.on('message:new', handleNewMessage),
      socketService.on('message:edited', handleMessageEdited),
      socketService.on('message:deleted', handleMessageDeleted),
      socketService.on('message:reaction_added', handleReactionAdded),
      socketService.on('message:reaction_removed', handleReactionRemoved),
      socketService.on('message:typing', handleTyping),
      socketService.on('conversation:new', handleNewConversation),
      socketService.on('conversation:read', handleConversationRead),
      socketService.on('user:presence', handleUserPresence),
      socketService.on('call:incoming', handleIncomingCall),
      socketService.on('call:accepted', handleCallAccepted),
      socketService.on('call:rejected', handleCallRejected),
      socketService.on('call:ended', handleCallEnded),
      socketService.on('group:updated', handleGroupUpdated),
      socketService.on('group:members_updated', handleGroupMembersUpdated),
      socketService.on('notification:new', handleNotificationNew),
      socketService.on('notification:mark-read', handleNotificationMarkRead),
      socketService.on('notification:delete', handleNotificationDelete),
    ];

    return () => unsubscribers.forEach((unsub) => unsub());
  }, [
    handleNewMessage, handleMessageEdited, handleMessageDeleted,
    handleReactionAdded, handleReactionRemoved, handleTyping,
    handleNewConversation, handleConversationRead, handleUserPresence,
    handleIncomingCall, handleCallAccepted, handleCallRejected,
    handleCallEnded, handleGroupUpdated, handleGroupMembersUpdated,
    handleNotificationNew, handleNotificationMarkRead, handleNotificationDelete,
  ]);
};

// Hook utilitaire pour les événements WebRTC
export const useWebRTCEvents = (
  onOffer: (data: unknown) => void,
  onAnswer: (data: unknown) => void,
  onIceCandidate: (data: unknown) => void
) => {
  useEffect(() => {
    const unsubs = [
      socketService.on('webrtc:offer', onOffer),
      socketService.on('webrtc:answer', onAnswer),
      socketService.on('webrtc:ice-candidate', onIceCandidate),
    ];
    return () => unsubs.forEach((u) => u());
  }, [onOffer, onAnswer, onIceCandidate]);
};
