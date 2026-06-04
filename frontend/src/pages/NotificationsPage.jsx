// src/pages/NotificationsPage.jsx
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, CheckCheck, Trash2, Loader2 } from 'lucide-react';
import useNotificationStore from '../store/notificationStore';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

const NOTIFICATION_ICONS = {
  message: '',
  mention: '@',
  call_missed: '',
  call_incoming: '',
  group_added: '',
  group_removed: '',
  user_status: '',
  system: '',
};

const NOTIFICATION_COLORS = {
  message: 'bg-blue-50 border-blue-200',
  mention: 'bg-purple-50 border-purple-200',
  call_missed: 'bg-red-50 border-red-200',
  call_incoming: 'bg-primary-50 border-primary-200',
  group_added: 'bg-primary-50 border-primary-200',
  group_removed: 'bg-orange-50 border-orange-200',
  user_status: 'bg-slate-50 border-slate-200',
  system: 'bg-slate-50 border-slate-200',
};

function NotificationCard({ notification, onMarkAsRead, onDelete, onClick }) {
  const timeAgo = formatDistanceToNow(new Date(notification.created_at), {
    addSuffix: true,
    locale: fr,
  });

  const colorClass = NOTIFICATION_COLORS[notification.type] || 'bg-slate-50 border-slate-200';
  const icon = NOTIFICATION_ICONS[notification.type] || '';

  return (
    <div
      className={`card hover:shadow-md transition-all cursor-pointer ${
        !notification.is_read ? 'border-l-4 border-l-primary-600' : ''
      }`}
      onClick={() => onClick(notification)}
    >
      <div className="flex items-start gap-4">
        <div className={`w-12 h-12 rounded-full ${colorClass} flex items-center justify-center text-xl flex-shrink-0`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className={`font-semibold ${!notification.is_read ? 'text-slate-900' : 'text-slate-700'}`}>
              {notification.title}
            </h3>
            {!notification.is_read && (
              <span className="w-2.5 h-2.5 bg-primary-600 rounded-full flex-shrink-0 mt-1.5" />
            )}
          </div>
          {notification.message && (
            <p className="text-sm text-slate-600 mb-2">{notification.message}</p>
          )}
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-400">{timeAgo}</p>
            <div className="flex items-center gap-1">
              {!notification.is_read && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onMarkAsRead(notification.id);
                  }}
                  className="btn-icon text-primary-600 hover:bg-primary-100"
                  title="Marquer comme lue"
                >
                  <Check className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(notification.id);
                }}
                className="btn-icon text-red-600 hover:bg-red-100"
                title="Supprimer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function NotificationsPage() {
  const navigate = useNavigate();
  const {
    notifications,
    unreadCount,
    isLoading,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteAllRead,
  } = useNotificationStore();

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleNotificationClick = (notification) => {
    if (!notification.is_read) {
      markAsRead(notification.id);
    }

    if (notification.action_url) {
      navigate(notification.action_url);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-4 md:px-6 py-4 md:py-5">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg md:text-xl font-bold text-slate-800">
            Notifications {unreadCount > 0 && `(${unreadCount} non lues)`}
          </h1>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="btn-secondary text-sm flex items-center gap-2"
              >
                <CheckCheck className="w-4 h-4" />
                <span className="hidden sm:inline">Tout marquer comme lu</span>
              </button>
            )}
            {notifications.some((n) => n.is_read) && (
              <button
                onClick={deleteAllRead}
                className="btn-secondary text-sm flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                <span className="hidden sm:inline">Effacer les lues</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Contenu */}
      <div className="flex-1 overflow-y-auto px-4 md:px-6 py-6">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-7 h-7 animate-spin text-primary-500" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Bell className="w-16 h-16 mb-4 opacity-30" />
            <p className="font-medium text-slate-600 text-lg">Aucune notification</p>
            <p className="text-sm text-slate-500 mt-1">Vous êtes à jour !</p>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-3">
            {notifications.map((notification) => (
              <NotificationCard
                key={notification.id}
                notification={notification}
                onMarkAsRead={markAsRead}
                onDelete={deleteNotification}
                onClick={handleNotificationClick}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
