// mobile/src/store/socketStore.js
import { create } from 'zustand';
import { io } from 'socket.io-client';
import * as SecureStore from 'expo-secure-store';

const SOCKET_URL =
  process.env.EXPO_PUBLIC_SOCKET_URL || 'http://192.168.1.100:3000';

const useSocketStore = create((set, get) => ({
  socket: null,
  isConnected: false,
  onlineUsers: new Map(),

  connect: (accessToken) => {
    const getToken = async () => {
      if (accessToken) return accessToken;
      try {
        return await SecureStore.getItemAsync('accessToken');
      } catch {
        return null;
      }
    };

    getToken().then((token) => {
      if (!token) return;

      // Déconnecter l'existante
      const existing = get().socket;
      if (existing) {
        existing.removeAllListeners();
        existing.disconnect();
      }

      const socket = io(SOCKET_URL, {
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 2000,
        reconnectionDelayMax: 10000,
        timeout: 10000,
      });

      socket.on('connect', () => {
        console.log('[Socket] ✅ Connecté id=', socket.id);
        set({ isConnected: true });
      });

      socket.on('disconnect', (reason) => {
        console.log('[Socket] ❌ Déconnecté raison=', reason);
        set({ isConnected: false });
      });

      socket.on('connect_error', (err) => {
        console.error('[Socket] Erreur connexion:', err.message);
        set({ isConnected: false });
      });

      // Présence utilisateurs
      socket.on('user:presence', ({ userId, status }) => {
        set((state) => {
          const map = new Map(state.onlineUsers);
          map.set(userId, status);
          return { onlineUsers: map };
        });
      });

      set({ socket });
    });
  },

  reconnectWithToken: (newToken) => {
    get().connect(newToken);
  },

  disconnect: () => {
    const { socket } = get();
    if (socket) {
      socket.removeAllListeners();
      socket.disconnect();
      set({ socket: null, isConnected: false });
    }
  },

  emit: (event, data) => {
    const { socket } = get();
    if (socket?.connected) {
      socket.emit(event, data);
    } else {
      console.warn('[Socket] emit ignoré — socket non connecté:', event);
    }
  },

  on: (event, handler) => {
    const { socket } = get();
    if (socket) socket.on(event, handler);
  },

  off: (event, handler) => {
    const { socket } = get();
    if (socket) socket.off(event, handler);
  },

  getUserStatus: (userId) => {
    return get().onlineUsers.get(userId) || 'offline';
  },
}));

export default useSocketStore;