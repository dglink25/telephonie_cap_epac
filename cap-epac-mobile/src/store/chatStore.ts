// src/store/chatStore.ts
import { create } from 'zustand';
import { conversationsAPI } from '../services/api';

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  type: 'text' | 'image' | 'file' | 'audio' | 'video' | 'system';
  reply_to_id: string | null;
  file_url: string | null;
  file_name: string | null;
  file_size: number | null;
  file_mime: string | null;
  is_edited: boolean;
  is_deleted: boolean;
  is_pinned: boolean;
  canEdit: boolean;
  created_at: string;
  updated_at: string;
  sender?: {
    id: string;
    display_name: string;
    avatar_url: string | null;
  };
  replyTo?: Message | null;
  reactions?: Array<{
    id: string;
    emoji: string;
    user: { id: string; display_name: string };
  }>;
}

export interface Conversation {
  id: string;
  name: string | null;
  type: 'direct' | 'group';
  avatar_url: string | null;
  created_by: string;
  is_general: boolean;
  is_muted: boolean;
  unreadCount: number;
  lastMessage: Message | null;
  members: Array<{
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
    presence_status: string;
    ConversationMember?: { role: string; last_read_at: string | null; is_muted: boolean };
  }>;
  created_at: string;
  updated_at: string;
}

interface TypingUser {
  userId: string;
  conversationId: string;
  timestamp: number;
}

interface ChatState {
  conversations: Conversation[];
  messages: Record<string, Message[]>;
  activeConversationId: string | null;
  typingUsers: TypingUser[];
  isLoadingConversations: boolean;
  isLoadingMessages: boolean;

  loadConversations: () => Promise<void>;
  loadMessages: (conversationId: string, before?: string) => Promise<boolean>;
  setActiveConversation: (id: string | null) => void;
  addMessage: (message: Message) => void;
  updateMessage: (message: Message) => void;
  deleteMessage: (convId: string, msgId: string) => void;
  addReaction: (convId: string, msgId: string, userId: string, emoji: string) => void;
  removeReaction: (convId: string, msgId: string, userId: string, emoji: string) => void;
  addConversation: (conv: Conversation) => void;
  updateConversation: (id: string, data: Partial<Conversation>) => void;
  setTyping: (userId: string, conversationId: string, isTyping: boolean) => void;
  markAsRead: (conversationId: string) => void;
  resetUnread: (conversationId: string) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  messages: {},
  activeConversationId: null,
  typingUsers: [],
  isLoadingConversations: false,
  isLoadingMessages: false,

  loadConversations: async () => {
    set({ isLoadingConversations: true });
    try {
      const resp = await conversationsAPI.getAll();
      set({ conversations: resp.data.data.conversations, isLoadingConversations: false });
    } catch {
      set({ isLoadingConversations: false });
    }
  },

  loadMessages: async (conversationId, before) => {
    set({ isLoadingMessages: true });
    try {
      const resp = await conversationsAPI.getMessages(conversationId, {
        limit: 50,
        before,
      });
      const newMessages: Message[] = resp.data.data.messages;
      const hasMore: boolean = resp.data.data.hasMore;
      const existing = get().messages[conversationId] || [];
      const merged = before
        ? [...newMessages, ...existing]
        : newMessages;
      set((s) => ({
        messages: { ...s.messages, [conversationId]: merged },
        isLoadingMessages: false,
      }));
      return hasMore;
    } catch {
      set({ isLoadingMessages: false });
      return false;
    }
  },

  setActiveConversation: (id) => set({ activeConversationId: id }),

  addMessage: (message) => {
    const convId = message.conversation_id;
    set((s) => {
      const existing = s.messages[convId] || [];
      // Éviter les doublons
      if (existing.find((m) => m.id === message.id)) return s;
      const updated = [...existing, message];
      // Mettre à jour lastMessage dans la conversation
      const conversations = s.conversations.map((c) =>
        c.id === convId
          ? {
              ...c,
              lastMessage: message,
              unreadCount: s.activeConversationId === convId ? 0 : c.unreadCount + 1,
              updated_at: message.created_at,
            }
          : c
      );
      // Trier par date de dernière activité
      conversations.sort((a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
      return { messages: { ...s.messages, [convId]: updated }, conversations };
    });
  },

  updateMessage: (message) => {
    const convId = message.conversation_id;
    set((s) => ({
      messages: {
        ...s.messages,
        [convId]: (s.messages[convId] || []).map((m) =>
          m.id === message.id ? message : m
        ),
      },
    }));
  },

  deleteMessage: (convId, msgId) => {
    set((s) => ({
      messages: {
        ...s.messages,
        [convId]: (s.messages[convId] || []).map((m) =>
          m.id === msgId ? { ...m, is_deleted: true, content: null } : m
        ),
      },
    }));
  },

  addReaction: (convId, msgId, userId, emoji) => {
    set((s) => ({
      messages: {
        ...s.messages,
        [convId]: (s.messages[convId] || []).map((m) =>
          m.id === msgId
            ? {
                ...m,
                reactions: [
                  ...(m.reactions || []),
                  { id: `${userId}-${emoji}`, emoji, user: { id: userId, display_name: '' } },
                ],
              }
            : m
        ),
      },
    }));
  },

  removeReaction: (convId, msgId, userId, emoji) => {
    set((s) => ({
      messages: {
        ...s.messages,
        [convId]: (s.messages[convId] || []).map((m) =>
          m.id === msgId
            ? {
                ...m,
                reactions: (m.reactions || []).filter(
                  (r) => !(r.user.id === userId && r.emoji === emoji)
                ),
              }
            : m
        ),
      },
    }));
  },

  addConversation: (conv) => {
    set((s) => {
      if (s.conversations.find((c) => c.id === conv.id)) return s;
      return { conversations: [conv, ...s.conversations] };
    });
  },

  updateConversation: (id, data) => {
    set((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === id ? { ...c, ...data } : c
      ),
    }));
  },

  setTyping: (userId, conversationId, isTyping) => {
    set((s) => {
      const filtered = s.typingUsers.filter(
        (t) => !(t.userId === userId && t.conversationId === conversationId)
      );
      if (isTyping) {
        return {
          typingUsers: [...filtered, { userId, conversationId, timestamp: Date.now() }],
        };
      }
      return { typingUsers: filtered };
    });
    // Supprimer après 3s
    if (isTyping) {
      setTimeout(() => {
        set((s) => ({
          typingUsers: s.typingUsers.filter(
            (t) => !(t.userId === userId && t.conversationId === conversationId) ||
              Date.now() - t.timestamp < 3000
          ),
        }));
      }, 3000);
    }
  },

  markAsRead: (conversationId) => {
    conversationsAPI.markAsRead(conversationId).catch(() => {});
    get().resetUnread(conversationId);
  },

  resetUnread: (conversationId) => {
    set((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === conversationId ? { ...c, unreadCount: 0 } : c
      ),
    }));
  },
}));
