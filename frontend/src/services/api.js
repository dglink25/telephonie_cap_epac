
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Intercepteur de réponse : refresh automatique du token
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

    // Ne jamais tenter le refresh sur les routes d'authentification
    const isAuthRoute =
      originalRequest?.url?.includes('/auth/login') ||
      originalRequest?.url?.includes('/auth/logout') ||
      originalRequest?.url?.includes('/auth/refresh') ||
      originalRequest?.url?.includes('/auth/register');

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthRoute) {
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
          const newToken = useAuthStore.getState().accessToken;
          processQueue(null, newToken);
          originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
          isRefreshing = false;
          return api(originalRequest);
        } else {
          // Refresh échoué → déconnecter proprement
          processQueue(error, null);
          isRefreshing = false;
          useAuthStore.getState().clearAuth();
          window.location.href = '/login';
        }
      } catch (err) {
        processQueue(err, null);
        isRefreshing = false;
        // En cas d'erreur inattendue lors du refresh → déconnecter aussi
        try {
          const { default: useAuthStore } = await import('../store/authStore');
          useAuthStore.getState().clearAuth();
        } catch {}
        window.location.href = '/login';
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
