// src/store/socketStore.js
import { create } from 'zustand';
import { io } from 'socket.io-client';
import useAuthStore from './authStore';

const useSocketStore = create((set, get) => ({
  socket: null,
  isConnected: false,
  onlineUsers: new Map(),

  connect: () => {
    const { accessToken } = useAuthStore.getState();
    if (!accessToken || get().socket?.connected) return;

    const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || window.location.origin;

    const socket = io(SOCKET_URL, {
      auth: { token: accessToken },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socket.on('connect', () => {
      set({ isConnected: true });
    });

    socket.on('disconnect', () => {
      set({ isConnected: false });
    });

    socket.on('connect_error', (err) => {
      console.error('Socket.IO connexion échouée:', err.message);
    });

    // Présence des utilisateurs
    socket.on('user:presence', ({ userId, status }) => {
      set((state) => {
        const map = new Map(state.onlineUsers);
        map.set(userId, status);
        return { onlineUsers: map };
      });
    });

    set({ socket });
  },

  disconnect: () => {
    const { socket } = get();
    if (socket) {
      socket.disconnect();
      set({ socket: null, isConnected: false });
    }
  },

  emit: (event, data) => {
    const { socket } = get();
    if (socket?.connected) socket.emit(event, data);
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
