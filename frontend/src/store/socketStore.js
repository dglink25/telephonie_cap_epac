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

    // ✅ FIX: Utiliser window.location.origin dynamiquement (réseau LAN)
    // En dev local: http://localhost:5173 → VITE_SOCKET_URL = http://localhost:3000
    // En prod: https://192.168.100.195 → VITE_SOCKET_URL = https://192.168.100.195
    const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || window.location.origin;

    const socket = io(SOCKET_URL, {
      auth: { token },
      // ✅ FIX: Commencer par polling (toujours fonctionnel) puis upgrader vers WebSocket
      // Évite l'erreur "websocket error" causée par les certificats auto-signés
      // La connexion polling fonctionne immédiatement, puis Socket.IO upgrades automatiquement
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: 20,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 8000,
      timeout: 15000,
      path: '/socket.io/',
      upgrade: true,
    });

    socket.on('connect', () => {
      console.log('[Socket] Connecté id=', socket.id);
      set({ isConnected: true });
    });

    socket.on('disconnect', (reason) => {
      console.log('[Socket] Déconnecté raison=', reason);
      set({ isConnected: false });

      // ✅ FIX: Laisser Socket.IO gérer la reconnexion automatique
      // Ne pas tenter de reconnecter manuellement sauf si serveur force la déconnexion
      if (reason === 'io server disconnect') {
        console.log('[Socket] Déconnexion serveur forcée — reconnexion manuelle après refresh token');
        setTimeout(() => {
          socket.connect();
        }, 2000);
      }
      // Pour les autres raisons (transport error, etc.) → Socket.IO gère automatiquement
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

    // ✅ Stocker le socket immédiatement
    set({ socket, isConnected: socket.connected });
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