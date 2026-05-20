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

        // Reconnecter le socket avec le nouveau token
        // Import dynamique pour éviter la dépendance circulaire
        import('./socketStore').then(({ default: useSocketStore }) => {
          useSocketStore.getState().reconnectWithToken(accessToken);
        });
      },

      updateUser: (userData) =>
        set((state) => ({ user: { ...state.user, ...userData } })),

      clearAuth: () => {
        delete api.defaults.headers.common['Authorization'];
        import('./socketStore').then(({ default: useSocketStore }) => {
          useSocketStore.getState().disconnect();
        });
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
          return { success: false, message: err.response?.data?.message || 'Erreur de connexion' };
        } finally {
          set({ isLoading: false });
        }
      },

      logout: async () => {
        try { await api.post('/auth/logout'); } catch (_) {}
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

          // ✅ Reconnecter le socket avec le NOUVEAU token
          import('./socketStore').then(({ default: useSocketStore }) => {
            useSocketStore.getState().reconnectWithToken(accessToken);
          });

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
