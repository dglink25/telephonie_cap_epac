// src/services/api.ts
import axios, { AxiosInstance, AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = 'https://10.139.247.115/api'; // ← Mettre l'IP du serveur LAN

export const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
  // Désactiver la vérification SSL en dev (certificat auto-signé LAN)
  // En production, utiliser la CA racine importée
  httpsAgent: undefined,
});

// Intercepteur requête : ajouter le JWT
api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const token = await AsyncStorage.getItem('accessToken');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Intercepteur réponse : refresh automatique si 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/login') &&
      !originalRequest.url?.includes('/auth/refresh')
    ) {
      originalRequest._retry = true;
      try {
        const userId = await AsyncStorage.getItem('userId');
        const refreshResp = await axios.post(
          `${BASE_URL}/auth/refresh`,
          { user_id: userId },
          { withCredentials: true }
        );
        const newToken = refreshResp.data.data.accessToken;
        await AsyncStorage.setItem('accessToken', newToken);
        if (originalRequest.headers) {
          (originalRequest.headers as Record<string, string>).Authorization = `Bearer ${newToken}`;
        }
        return api(originalRequest);
      } catch {
        await AsyncStorage.multiRemove(['accessToken', 'userId', 'user']);
        // Émettre un événement de déconnexion forcée
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  }
);

// ── Auth ──────────────────────────────────────────────────────────
export const authAPI = {
  login: (username: string, password: string) =>
    api.post('/auth/login', { username, password }),
  register: (data: {
    username: string;
    password: string;
    display_name: string;
    department: string;
  }) => api.post('/auth/register', data),
  me: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout'),
  changePassword: (current_password: string, new_password: string) =>
    api.post('/auth/change-password', { current_password, new_password }),
};

// ── Users ─────────────────────────────────────────────────────────
export const usersAPI = {
  getAll: (params?: { page?: number; limit?: number; search?: string; department?: string }) =>
    api.get('/users', { params }),
  getById: (id: string) => api.get(`/users/${id}`),
  updateProfile: (data: { display_name?: string; department?: string; phone_extension?: string }) =>
    api.put('/users/me', data),
  uploadAvatar: (formData: FormData) =>
    api.post('/users/me/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  updatePresence: (status: 'online' | 'away' | 'dnd' | 'offline') =>
    api.put('/users/me/presence', { status }),
  getPresence: () => api.get('/users/me/presence'),
  // Admin
  adminGetAll: (params?: object) => api.get('/users/admin-list', { params }),
  adminCreate: (data: object) => api.post('/users/admin', data),
  adminUpdate: (id: string, data: object) => api.put(`/users/admin/${id}`, data),
  adminDelete: (id: string) => api.delete(`/users/admin/${id}`),
};

// ── Conversations ─────────────────────────────────────────────────
export const conversationsAPI = {
  getAll: () => api.get('/conversations'),
  create: (data: { type: 'direct' | 'group'; name?: string; member_ids: string[] }) =>
    api.post('/conversations', data),
  getMessages: (id: string, params?: { limit?: number; before?: string }) =>
    api.get(`/conversations/${id}/messages`, { params }),
  sendMessage: (id: string, data: FormData | object, isFormData = false) =>
    api.post(`/conversations/${id}/messages`, data, {
      headers: isFormData ? { 'Content-Type': 'multipart/form-data' } : {},
    }),
  editMessage: (convId: string, msgId: string, content: string) =>
    api.put(`/conversations/${convId}/messages/${msgId}`, { content }),
  deleteMessage: (convId: string, msgId: string) =>
    api.delete(`/conversations/${convId}/messages/${msgId}`),
  addReaction: (convId: string, msgId: string, emoji: string) =>
    api.post(`/conversations/${convId}/messages/${msgId}/reactions`, { emoji }),
  markAsRead: (id: string) => api.post(`/conversations/${id}/read`),
  getEditStatus: (convId: string, msgId: string) =>
    api.get(`/conversations/${convId}/messages/${msgId}/edit-status`),
};

// ── Groupes ───────────────────────────────────────────────────────
export const groupsAPI = {
  getInfo: (id: string) => api.get(`/groups/${id}`),
  updateInfo: (id: string, data: { name?: string; description?: string }) =>
    api.put(`/groups/${id}`, data),
  updateAvatar: (id: string, formData: FormData) =>
    api.post(`/groups/${id}/avatar`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  addMembers: (id: string, user_ids: string[]) =>
    api.post(`/groups/${id}/members`, { user_ids }),
  removeMember: (id: string, memberId: string) =>
    api.delete(`/groups/${id}/members/${memberId}`),
  leaveGroup: (id: string) => api.delete(`/groups/${id}/leave`),
  updateMemberRole: (id: string, memberId: string, role: 'admin' | 'member') =>
    api.put(`/groups/${id}/members/${memberId}/role`, { role }),
};

// ── Appels ────────────────────────────────────────────────────────
export const callsAPI = {
  getLogs: (params?: { page?: number; limit?: number; type?: string; status?: string }) =>
    api.get('/calls', { params }),
  getById: (id: string) => api.get(`/calls/${id}`),
  create: (callee_id: string, type: string) =>
    api.post('/calls', { callee_id, type }),
  update: (id: string, data: object) => api.patch(`/calls/${id}`, data),
  getStats: (params?: object) => api.get('/calls/stats', { params }),
};

export const getMediaUrl = (path: string) =>
  path.startsWith('http') ? path : `${BASE_URL.replace('/api', '')}${path}`;
