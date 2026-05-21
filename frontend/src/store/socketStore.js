import { create } from 'zustand';
import { io } from 'socket.io-client';

const useSocketStore = create((set, get) => ({
  socket: null,
  isConnected: false,
  onlineUsers: new Map(),

  connect: (accessToken) => {
    // Utiliser le token passé en argument ou le récupérer depuis le localStorage
    const token = accessToken || (() => {
      try {
        const stored = JSON.parse(localStorage.getItem('cap-epac-auth') || '{}');
        return stored?.state?.accessToken;
      } catch { return null; }
    })();

    if (!token) return;

    // Déconnecter l'ancienne socket si elle existe
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
      console.log('[Socket] ✅ Connecté id=', socket.id);
      set({ isConnected: true });
    });

    socket.on('disconnect', (reason) => {
      console.log('[Socket] ❌ Déconnecté raison=', reason);
      set({ isConnected: false });

      // Si déconnecté à cause d'une erreur d'auth (token expiré)
      // → attendre que le refresh soit fait, puis se reconnecter
      if (reason === 'io server disconnect' || reason === 'transport error') {
        console.log('[Socket] Tentative de reconnexion avec token rafraîchi...');
        setTimeout(() => {
          const newToken = (() => {
            try {
              const stored = JSON.parse(localStorage.getItem('cap-epac-auth') || '{}');
              return stored?.state?.accessToken;
            } catch { return null; }
          })();
          if (newToken && newToken !== token) {
            console.log('[Socket] Reconnexion avec nouveau token');
            get().connect(newToken);
          }
        }, 1500);
      }
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
  },

  // Reconnecter avec un nouveau token (appelé après refresh JWT)
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
