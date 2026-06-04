// src/store/notificationStore.ts
import { create } from 'zustand';

export interface Notification {
  id: string;
  type: string;
  title: string;
  message?: string;
  is_read: boolean;
  created_at: string;
  action_url?: string;
  data?: Record<string, unknown>;
  priority?: string;
}

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  setNotifications: (notifications: Notification[]) => void;
  addNotification: (notification: Notification) => void;
  updateNotification: (notification: Notification) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  deleteNotification: (id: string) => void;
  deleteAllRead: () => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  unreadCount: 0,

  setNotifications: (notifications) =>
    set({
      notifications,
      unreadCount: notifications.filter((n) => !n.is_read).length,
    }),

  addNotification: (notification) =>
    set((state) => {
      if (state.notifications.find((n) => n.id === notification.id)) return state;
      const updated = [notification, ...state.notifications];
      return {
        notifications: updated,
        unreadCount: updated.filter((n) => !n.is_read).length,
      };
    }),

  // ✅ Mettre à jour une notification existante (ex: marquée lue via socket)
  updateNotification: (notification) =>
    set((state) => {
      const updated = state.notifications.map((n) =>
        n.id === notification.id ? { ...n, ...notification } : n
      );
      return {
        notifications: updated,
        unreadCount: updated.filter((n) => !n.is_read).length,
      };
    }),

  markAsRead: (id) =>
    set((state) => {
      const updated = state.notifications.map((n) =>
        n.id === id ? { ...n, is_read: true } : n
      );
      return {
        notifications: updated,
        unreadCount: updated.filter((n) => !n.is_read).length,
      };
    }),

  markAllAsRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, is_read: true })),
      unreadCount: 0,
    })),

  deleteNotification: (id) =>
    set((state) => {
      const updated = state.notifications.filter((n) => n.id !== id);
      return {
        notifications: updated,
        unreadCount: updated.filter((n) => !n.is_read).length,
      };
    }),

  deleteAllRead: () =>
    set((state) => {
      const updated = state.notifications.filter((n) => !n.is_read);
      return { notifications: updated, unreadCount: updated.length };
    }),
}));