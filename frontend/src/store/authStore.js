// src/store/authStore.js
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../services/api';

const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: false,

      setAuth: (user, accessToken) => {
        api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
        set({ user, accessToken, isAuthenticated: true });
      },

      updateUser: (userData) =>
        set((state) => ({ user: { ...state.user, ...userData } })),

      clearAuth: () => {
        delete api.defaults.headers.common['Authorization'];
        set({ user: null, accessToken: null, isAuthenticated: false });
      },

      login: async (username, password) => {
        set({ isLoading: true });
        try {
          const { data } = await api.post('/auth/login', { username, password });
          const { accessToken, user } = data.data;
          get().setAuth(user, accessToken);
          return { success: true };
        } catch (err) {
          const msg = err.response?.data?.message || 'Erreur de connexion';
          return { success: false, message: msg };
        } finally {
          set({ isLoading: false });
        }
      },

      logout: async () => {
        try {
          await api.post('/auth/logout');
        } catch (_) {}
        get().clearAuth();
      },

      refreshToken: async () => {
        try {
          const userId = get().user?.id;
          if (!userId) return false;
          const { data } = await api.post('/auth/refresh', { user_id: userId });
          const { accessToken } = data.data;
          api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
          set({ accessToken });
          return true;
        } catch (_) {
          get().clearAuth();
          return false;
        }
      },
    }),
    {
      name: 'cap-epac-auth',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

export default useAuthStore;
