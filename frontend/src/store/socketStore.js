// src/store/socketStore.js
import { create } from 'zustand';
import { io } from 'socket.io-client';

const useSocketStore = create((set, get) => ({
  socket: null,
  isConnected: false,
  onlineUsers: new Map(),

  connect: (accessToken) => {
    const token = accessToken || (() => {
      try {
        const stored = JSON.parse(localStorage.getItem('cap-epac-auth') || '{}');
        return stored?.state?.accessToken;
      } catch { return null; }
    })();

    if (!token) return;

    // Déconnecter proprement l'ancienne socket
    const existing = get().socket;
    if (existing) {
      existing.removeAllListeners();
      existing.disconnect();
    }

    const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || window.location.origin;

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
      console.log('[Socket] Connecté id=', socket.id);
      set({ isConnected: true });
    });

    socket.on('disconnect', (reason) => {
      console.log('[Socket] Déconnecté raison=', reason);
      set({ isConnected: false });

      if (reason === 'io server disconnect') {
        console.log('[Socket] Déconnexion serveur — tentative avec token rafraîchi...');
        setTimeout(() => {
          const newToken = (() => {
            try {
              const stored = JSON.parse(localStorage.getItem('cap-epac-auth') || '{}');
              return stored?.state?.accessToken;
            } catch { return null; }
          })();
          // Ne reconnecter que si le token a changé (refresh effectué entre temps)
          if (newToken && newToken !== token) {
            console.log('[Socket] Reconnexion avec nouveau token');
            get().connect(newToken);
          }
          // Sinon, laisser socket.io gérer la reconnexion automatique
        }, 1500);
      }
      // Pour 'transport error' et autres : socket.io gère tout seul
    });

    socket.on('connect_error', (err) => {
      console.error('[Socket] Erreur connexion:', err.message);
      set({ isConnected: false });
    });

    socket.on('user:presence', ({ userId, status }) => {
      set((state) => {
        const map = new Map(state.onlineUsers);
        map.set(userId, status);
        return { onlineUsers: map };
      });
    });

    // ✅ Stocker le socket immédiatement (avant connect)
    // isConnected reste false jusqu'au event 'connect'
    set({ socket, isConnected: false });
  },

  reconnectWithToken: (newToken) => {
    console.log('[Socket] Reconnexion forcée avec nouveau token');
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