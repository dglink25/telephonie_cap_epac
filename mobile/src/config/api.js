// mobile/src/config/api.js
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

// ── Remplace par l'IP locale de ton serveur backend sur le LAN ──
// Exemple : 'http://192.168.1.10:3000/api'
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.100:3000/api';

const api = axios.create({
  baseURL: API_URL,
  withCredentials: false, // expo ne supporte pas les cookies httpOnly → on gère manuellement
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// ── Intercepteur requête : injecter le token ─────────────────────
api.interceptors.request.use(async (config) => {
  try {
    const token = await SecureStore.getItemAsync('accessToken');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
  } catch (_) {}
  return config;
});

// ── Intercepteur réponse : refresh automatique du token ──────────
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token)));
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers['Authorization'] = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { default: useAuthStore } = await import('../store/authStore');
        const success = await useAuthStore.getState().refreshToken();
        if (success) {
          const newToken = await SecureStore.getItemAsync('accessToken');
          processQueue(null, newToken);
          originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
          return api(originalRequest);
        } else {
          processQueue(error, null);
          useAuthStore.getState().clearAuth();
        }
      } catch (err) {
        processQueue(err, null);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;