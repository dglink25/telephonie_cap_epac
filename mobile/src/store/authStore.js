// mobile/src/store/authStore.js
import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import api from '../config/api';

// ── Helpers SecureStore ──────────────────────────────────────────
const saveToken = async (token) => {
  if (token) await SecureStore.setItemAsync('accessToken', token);
  else await SecureStore.deleteItemAsync('accessToken').catch(() => {});
};

const saveUser = async (user) => {
  if (user) await SecureStore.setItemAsync('authUser', JSON.stringify(user));
  else await SecureStore.deleteItemAsync('authUser').catch(() => {});
};

const useAuthStore = create((set, get) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  isLoading: false,
  isInitialized: false, // true une fois que l'on a lu SecureStore au démarrage

  // ── Initialisation au démarrage de l'app ────────────────────
  initialize: async () => {
    try {
      const [token, userJson] = await Promise.all([
        SecureStore.getItemAsync('accessToken'),
        SecureStore.getItemAsync('authUser'),
      ]);
      if (token && userJson) {
        const user = JSON.parse(userJson);
        set({ user, accessToken: token, isAuthenticated: true });
      }
    } catch (_) {}
    set({ isInitialized: true });
  },

  // ── Stocker auth après login ─────────────────────────────────
  setAuth: async (user, accessToken) => {
    await Promise.all([saveToken(accessToken), saveUser(user)]);
    set({ user, accessToken, isAuthenticated: true });

    // Connecter le socket
    try {
      const { default: useSocketStore } = await import('./socketStore');
      useSocketStore.getState().connect(accessToken);
    } catch (_) {}
  },

  updateUser: async (userData) => {
    const newUser = { ...get().user, ...userData };
    await saveUser(newUser);
    set({ user: newUser });
  },

  clearAuth: async () => {
    await Promise.all([saveToken(null), saveUser(null)]);
    try {
      const { default: useSocketStore } = await import('./socketStore');
      useSocketStore.getState().disconnect();
    } catch (_) {}
    set({ user: null, accessToken: null, isAuthenticated: false });
  },

  // ── Login ────────────────────────────────────────────────────
  login: async (username, password) => {
    set({ isLoading: true });
    try {
      const { data } = await api.post('/auth/login', { username, password });
      const { accessToken, user } = data.data;
      await get().setAuth(user, accessToken);
      return { success: true };
    } catch (err) {
      const errorData = err.response?.data;
      return {
        success: false,
        message: errorData?.message || 'Erreur de connexion',
        attemptsLeft: errorData?.attemptsLeft,
        status: err.response?.status,
      };
    } finally {
      set({ isLoading: false });
    }
  },

  // ── Logout ───────────────────────────────────────────────────
  logout: async () => {
    try {
      await api.post('/auth/logout');
    } catch (_) {}
    await get().clearAuth();
  },

  // ── Refresh token ────────────────────────────────────────────
  refreshToken: async () => {
    try {
      const userId = get().user?.id;
      if (!userId) return false;
      const { data } = await api.post('/auth/refresh', { user_id: userId });
      const { accessToken } = data.data;
      await saveToken(accessToken);
      set({ accessToken });

      try {
        const { default: useSocketStore } = await import('./socketStore');
        useSocketStore.getState().reconnectWithToken(accessToken);
      } catch (_) {}

      return true;
    } catch (_) {
      await get().clearAuth();
      return false;
    }
  },
}));

export default useAuthStore;