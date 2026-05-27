// src/store/authStore.ts
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authAPI } from '../services/api';
import { socketService } from '../services/socket';

export interface User {
  id: string;
  username: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  role: 'admin' | 'user';
  presence_status: 'online' | 'away' | 'dnd' | 'offline';
  department: string | null;
  phone_extension: string | null;
  is_active: boolean;
  last_seen_at: string | null;
  created_at: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;

  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loadFromStorage: () => Promise<void>;
  updateUser: (data: Partial<User>) => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isLoading: false,
  isAuthenticated: false,
  error: null,

  login: async (username, password) => {
    set({ isLoading: true, error: null });
    try {
      const response = await authAPI.login(username, password);
      const { accessToken, user } = response.data.data;

      await AsyncStorage.multiSet([
        ['accessToken', accessToken],
        ['userId', user.id],
        ['user', JSON.stringify(user)],
      ]);

      set({ user, token: accessToken, isAuthenticated: true, isLoading: false });

      // Connecter le socket
      await socketService.connect();
    } catch (error: unknown) {
      const msg =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Erreur de connexion';
      set({ isLoading: false, error: msg, isAuthenticated: false });
      throw error;
    }
  },

  logout: async () => {
    try {
      await authAPI.logout();
    } catch {}
    socketService.disconnect();
    await AsyncStorage.multiRemove(['accessToken', 'userId', 'user']);
    set({ user: null, token: null, isAuthenticated: false });
  },

  loadFromStorage: async () => {
    try {
      const [token, userStr] = await AsyncStorage.multiGet(['accessToken', 'user']);
      if (token[1] && userStr[1]) {
        const user = JSON.parse(userStr[1]) as User;
        set({ user, token: token[1], isAuthenticated: true });
        // Vérifier que le token est encore valide
        try {
          const resp = await authAPI.me();
          set({ user: resp.data.data.user });
          await socketService.connect();
        } catch {
          await get().logout();
        }
      }
    } catch {
      // Pas de session
    }
  },

  updateUser: (data) => {
    const current = get().user;
    if (!current) return;
    const updated = { ...current, ...data };
    set({ user: updated });
    AsyncStorage.setItem('user', JSON.stringify(updated));
  },

  clearError: () => set({ error: null }),
}));
