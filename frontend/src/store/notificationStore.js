// src/store/notificationStore.js
import { create } from 'zustand';
import api from '../services/api';

const useNotificationStore = create((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,
  error: null,

  // Récupérer les notifications
  fetchNotifications: async (unreadOnly = false) => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await api.get('/notifications', {
        params: { unread_only: unreadOnly, limit: 50 },
      });
      set({
        notifications: data.data.notifications,
        unreadCount: data.data.unreadCount,
        isLoading: false,
      });
    } catch (error) {
      set({ error: error.message, isLoading: false });
    }
  },

  // Ajouter une nouvelle notification (via socket)
  addNotification: (notification) => {
    set((state) => ({
      notifications: [notification, ...state.notifications],
      unreadCount: state.unreadCount + 1,
    }));

    // Afficher une notification navigateur si autorisé
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(notification.title, {
        body: notification.message,
        icon: '/icon.png',
        badge: '/badge.png',
        tag: `notification-${notification.id}`,
      });
    }
  },

  // Marquer comme lue
  markAsRead: async (notificationId) => {
    try {
      await api.put(`/notifications/${notificationId}/read`);
      set((state) => ({
        notifications: state.notifications.map((n) =>
          n.id === notificationId ? { ...n, is_read: true, read_at: new Date() } : n
        ),
        unreadCount: Math.max(0, state.unreadCount - 1),
      }));
    } catch (error) {
      console.error('Erreur markAsRead:', error);
    }
  },

  // Marquer toutes comme lues
  markAllAsRead: async () => {
    try {
      await api.put('/notifications/read-all');
      set((state) => ({
        notifications: state.notifications.map((n) => ({
          ...n,
          is_read: true,
          read_at: new Date(),
        })),
        unreadCount: 0,
      }));
    } catch (error) {
      console.error('Erreur markAllAsRead:', error);
    }
  },

  // Supprimer une notification
  deleteNotification: async (notificationId) => {
    try {
      await api.delete(`/notifications/${notificationId}`);
      set((state) => {
        const notification = state.notifications.find((n) => n.id === notificationId);
        return {
          notifications: state.notifications.filter((n) => n.id !== notificationId),
          unreadCount: notification && !notification.is_read
            ? Math.max(0, state.unreadCount - 1)
            : state.unreadCount,
        };
      });
    } catch (error) {
      console.error('Erreur deleteNotification:', error);
    }
  },

  // Supprimer toutes les notifications lues
  deleteAllRead: async () => {
    try {
      await api.delete('/notifications/read');
      set((state) => ({
        notifications: state.notifications.filter((n) => !n.is_read),
      }));
    } catch (error) {
      console.error('Erreur deleteAllRead:', error);
    }
  },

  // Réinitialiser
  reset: () => {
    set({
      notifications: [],
      unreadCount: 0,
      isLoading: false,
      error: null,
    });
  },
}));

export default useNotificationStore;
