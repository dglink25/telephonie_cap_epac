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

// FIX: helper pour extraire un message d'erreur lisible
const extractErrorMessage = (error: unknown): string => {
  if (!error) return 'Erreur inconnue';
  const axiosError = error as { response?: { data?: { message?: string }; status?: number } };
  if (axiosError.response?.data?.message) {
    return axiosError.response.data.message;
  }
  if (axiosError.response?.status === 0 || !(error as { response?: unknown }).response) {
    return 'Impossible de joindre le serveur. Vérifiez votre connexion réseau.';
  }
  if (axiosError.response?.status === 401) {
    return 'Identifiant ou mot de passe incorrect.';
  }
  if (axiosError.response?.status === 403) {
    return 'Compte verrouillé. Réessayez plus tard.';
  }
  if (axiosError.response?.status === 429) {
    return 'Trop de tentatives. Attendez quelques minutes.';
  }
  if (axiosError.response?.status === 500) {
    return 'Erreur serveur. Contactez l\'administrateur.';
  }
  return 'Erreur de connexion.'; axiosError.response;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isLoading: false,
  isAuthenticated: false,
  error: null,

  login: async (username, password) => {
    set({ isLoading: true, error: null });
    try {
      const response = await authAPI.login(username.trim().toLowerCase(), password);
      const { accessToken, user } = response.data.data;

      await AsyncStorage.multiSet([
        ['accessToken', accessToken],
        ['userId', user.id],
        ['user', JSON.stringify(user)],
      ]);

      set({ user, token: accessToken, isAuthenticated: true, isLoading: false, error: null });

      // FIX: connexion socket après authentification réussie (non-bloquante)
      socketService.connect().catch((err) => {
        console.warn('[AuthStore] Socket connexion échouée (non-critique):', err.message);
      });
    } catch (error: unknown) {
      const msg = extractErrorMessage(error);
      set({ isLoading: false, error: msg, isAuthenticated: false });
      throw error;
    }
  },

  logout: async () => {
    try {
      await authAPI.logout();
    } catch (err) {
      // Déconnexion locale même si le serveur échoue
      console.warn('[AuthStore] Erreur logout serveur (ignorée):', err);
    }
    socketService.disconnect();
    await AsyncStorage.multiRemove(['accessToken', 'userId', 'user']);
    set({ user: null, token: null, isAuthenticated: false, error: null });
  },

  loadFromStorage: async () => {
    // FIX: ne pas mettre isLoading ici pour éviter le flash d'écran de chargement
    try {
      const [[, token], [, userStr], [, userId]] = await AsyncStorage.multiGet([
        'accessToken',
        'user',
        'userId',
      ]);

      if (!token || !userStr || !userId) {
        // Pas de session sauvegardée — on reste sur l'écran de login
        return;
      }

      let user: User;
      try {
        user = JSON.parse(userStr) as User;
      } catch {
        await AsyncStorage.multiRemove(['accessToken', 'userId', 'user']);
        return;
      }

      set({ user, token, isAuthenticated: true });

      // Valider le token auprès du serveur
      try {
        const resp = await authAPI.me();
        const freshUser = resp.data.data.user as User;
        set({ user: freshUser });
        await AsyncStorage.setItem('user', JSON.stringify(freshUser));

        // Connecter le socket maintenant que le token est valide
        socketService.connect().catch((err) => {
          console.warn('[AuthStore] Socket connexion échouée au démarrage:', err.message);
        });
      } catch (meError: unknown) {
        const axiosError = meError as { response?: { status?: number } };
        // FIX: si 401 → token expiré → on tente le refresh automatique
        // L'intercepteur axios s'en charge, mais si ça échoue aussi → logout
        if (axiosError.response?.status === 401) {
          console.warn('[AuthStore] Token expiré au démarrage — déconnexion');
          await get().logout();
        } else if (!axiosError.response) {
          // Pas de réseau — on garde la session locale, on réessaiera plus tard
          console.warn('[AuthStore] Pas de réseau au démarrage — session locale conservée');
          socketService.connect().catch(() => {});
        }
        // Autres erreurs : on garde la session
      }
    } catch (err) {
      console.error('[AuthStore] Erreur loadFromStorage:', err);
    }
  },

  updateUser: (data) => {
    const current = get().user;
    if (!current) return;
    const updated = { ...current, ...data };
    set({ user: updated });
    AsyncStorage.setItem('user', JSON.stringify(updated)).catch(() => {});
  },

  clearError: () => set({ error: null }),
}));