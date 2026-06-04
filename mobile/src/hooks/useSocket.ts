// src/hooks/useSocket.ts
import { useEffect, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import { socketService } from '../services/socket';
import { useChatStore } from '../store/chatStore';
import { useCallStore } from '../store/callStore';
import { useAuthStore } from '../store/authStore';
import { useNotificationStore } from '../store/notificationStore';
import { navigationRef } from '../navigation/AppNavigator';
import type { Message, Conversation } from '../store/chatStore';
import type { ActiveCall } from '../store/callStore';
import type { Notification } from '../store/notificationStore';

// ── Notifications push natives (optionnel) ─────────────────────
// Décommentez si vous avez installé @notifee/react-native
// import notifee, { AndroidImportance } from '@notifee/react-native';

async function showLocalNotification(title: string, body: string, data?: Record<string, string>): Promise<void> {
  try {
    // ✅ Option 1 — Notifee (recommandé, plus riche)
    // const channelId = await notifee.createChannel({
    //   id: 'messages',
    //   name: 'Messages',
    //   importance: AndroidImportance.HIGH,
    //   sound: 'default',
    // });
    // await notifee.displayNotification({
    //   title,
    //   body,
    //   data: data || {},
    //   android: { channelId, sound: 'default', pressAction: { id: 'default' } },
    //   ios: { sound: 'default', badge: 1 },
    // });

    // ✅ Option 2 — PushNotificationIOS / @react-native-community/push-notification-ios
    // PushNotification.localNotification({ title, message: body, userInfo: data });

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
  const { setStatus, setActiveCall, endCall } = useCallStore();
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

    // ✅ Notification push si l'expéditeur n'est pas l'utilisateur courant
    if (message.sender_id !== user?.id) {
      const senderName = message.sender?.display_name || 'Quelqu\'un';
      let preview = message.content || '';
      if (message.type === 'image') preview = '📷 Image';
      else if (message.type === 'audio') preview = '🎤 Message vocal';
      else if (message.type === 'video') preview = '🎥 Vidéo';
      else if (message.type === 'file') preview = `📎 ${message.file_name || 'Fichier'}`;
      else if (message.type === 'system') return; // pas de notif pour les msgs système

      if (preview.length > 80) preview = preview.slice(0, 77) + '…';

      // Afficher la notification seulement si l'app est en arrière-plan
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

  // ── Statuts de lecture / livraison ────────────────────────────
  const handleMessagesRead = useCallback((data: unknown) => {
    const { conversationId, userId: readerId } = data as { conversationId: string; userId: string; messageIds: string[] };
    if (readerId !== user?.id) {
      // Mettre à jour les messages comme lus dans le store
      useChatStore.getState().markMessagesAsRead(conversationId, readerId);
    }
  }, [user?.id]);

  const handleMessagesDelivered = useCallback((data: unknown) => {
    const { messageIds, deliveredTo } = data as { messageIds: string[]; deliveredTo: string; deliveredAt: string };
    if (deliveredTo !== user?.id) {
      useChatStore.getState().markMessagesAsDelivered(messageIds);
    }
  }, [user?.id]);

  // ── Réactions ─────────────────────────────────────────────────
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

  // ── Typing ────────────────────────────────────────────────────
  const handleTyping = useCallback((data: unknown) => {
    const { userId: typingUserId, conversationId, isTyping } = data as {
      userId: string; conversationId: string; isTyping: boolean;
    };
    if (typingUserId !== user?.id) {
      setTyping(typingUserId, conversationId, isTyping);
    }
  }, [setTyping, user?.id]);

  // ── Conversations ─────────────────────────────────────────────
  const handleNewConversation = useCallback((data: unknown) => {
    const { conversation } = data as { conversation: Conversation };
    addConversation(conversation);
    loadConversationsDebounced();
  }, [addConversation, loadConversationsDebounced]);

  const handleConversationRead = useCallback((data: unknown) => {
    const { conversationId } = data as { conversationId: string };
    resetUnread(conversationId);
  }, [resetUnread]);

  // ── Présence ──────────────────────────────────────────────────
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
  }, []);

  // ── Groupes ───────────────────────────────────────────────────
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
    setActiveCall(call);
    setStatus('incoming');

    // ✅ Notification push pour appel entrant (même en background)
    const callType = d.type === 'video' ? 'vidéo' : 'audio';
    showLocalNotification(
      `📞 Appel ${callType} entrant`,
      `${d.callerName} vous appelle`,
      { callId: d.callId, callerId: d.callerId, type: d.type }
    );
  }, [setActiveCall, setStatus]);

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

  const handleCallRejected = useCallback(() => {
    endCall();
  }, [endCall]);

  const handleCallEnded = useCallback((data: unknown) => {
    const { callId } = data as { callId: string };
    const { activeCall } = useCallStore.getState();
    if (activeCall?.callId === callId) {
      endCall();
    }
  }, [endCall]);

  // ── Notifications ─────────────────────────────────────────────
  const handleNotificationNew = useCallback((data: unknown) => {
    const { notification } = data as { notification: Notification };
    addNotification(notification);

    // ✅ Notification système push (mention, groupe, etc.)
    if (notification.type !== 'message') { // les messages ont déjà leur propre notif
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

    // Activer le listener AppState pour reconnecter quand l'app revient au premier plan
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
    handleGroupUpdated, handleGroupMembersUpdated,
    handleNotificationNew, handleNotificationUpdated, handleNotificationDeleted,
    loadConversations, loadConversationsDebounced,
  ]);
};

// ── Hook WebRTC (utilisé dans ActiveCallScreen) ───────────────
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