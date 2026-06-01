// src/components/notifications/NotificationBell.jsx
import { useState, useEffect, useRef } from 'react';
import { Bell, Check, CheckCheck, Trash2, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import useNotificationStore from '../../store/notificationStore';
import useSocketStore from '../../store/socketStore';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

const NOTIFICATION_ICONS = {
  message: '💬',
  mention: '@',
  call_missed: '📞',
  call_incoming: '📱',
  group_added: '👥',
  group_removed: '🚪',
  user_status: '👤',
  system: 'ℹ️',
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

function NotificationItem({ notification, onMarkAsRead, onDelete, onClick }) {
  const timeAgo = formatDistanceToNow(new Date(notification.created_at), {
    addSuffix: true,
    locale: fr,
  });

  const colorClass = NOTIFICATION_COLORS[notification.type] || 'bg-slate-50 border-slate-200';
  const icon = NOTIFICATION_ICONS[notification.type] || 'ℹ️';

  return (
    <div
      className={`p-3 border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer ${
        !notification.is_read ? 'bg-primary-50/30' : ''
      }`}
      onClick={() => onClick(notification)}
    >
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-full ${colorClass} flex items-center justify-center text-lg flex-shrink-0`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h4 className={`text-sm font-semibold ${!notification.is_read ? 'text-slate-900' : 'text-slate-700'}`}>
              {notification.title}
            </h4>
            {!notification.is_read && (
              <span className="w-2 h-2 bg-primary-600 rounded-full flex-shrink-0 mt-1.5" />
            )}
          </div>
          {notification.message && (
            <p className="text-xs text-slate-600 mt-0.5 line-clamp-2">{notification.message}</p>
          )}
          <p className="text-xs text-slate-400 mt-1">{timeAgo}</p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {!notification.is_read && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMarkAsRead(notification.id);
              }}
              className="p-1.5 hover:bg-primary-100 rounded-lg transition-colors"
              title="Marquer comme lue"
            >
              <Check className="w-4 h-4 text-primary-600" />
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(notification.id);
            }}
            className="p-1.5 hover:bg-red-100 rounded-lg transition-colors"
            title="Supprimer"
          >
            <Trash2 className="w-4 h-4 text-red-600" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function NotificationBell() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const { socket } = useSocketStore();
  const {
    notifications,
    unreadCount,
    fetchNotifications,
    addNotification,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteAllRead,
  } = useNotificationStore();

  // Charger les notifications au montage
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Écouter les nouvelles notifications via socket
  useEffect(() => {
    if (!socket) return;

    const handleNewNotification = ({ notification }) => {
      addNotification(notification);
    };

    socket.on('notification:new', handleNewNotification);

    return () => {
      socket.off('notification:new', handleNewNotification);
    };
  }, [socket, addNotification]);

  // Fermer le dropdown au clic extérieur
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleNotificationClick = (notification) => {
    if (!notification.is_read) {
      markAsRead(notification.id);
    }

    if (notification.action_url) {
      navigate(notification.action_url);
      setIsOpen(false);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bouton cloche */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 hover:bg-slate-100 rounded-lg transition-colors"
        title="Notifications"
      >
        <Bell className="w-5 h-5 text-slate-600" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-white rounded-xl shadow-xl border border-slate-200 z-50 max-h-[600px] flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800">
              Notifications {unreadCount > 0 && `(${unreadCount})`}
            </h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
                  title="Tout marquer comme lu"
                >
                  <CheckCheck className="w-4 h-4" />
                  Tout lire
                </button>
              )}
              {notifications.some((n) => n.is_read) && (
                <button
                  onClick={deleteAllRead}
                  className="text-xs text-slate-500 hover:text-slate-700 font-medium"
                  title="Supprimer les notifications lues"
                >
                  Effacer lues
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-4 h-4 text-slate-600" />
              </button>
            </div>
          </div>

          {/* Liste des notifications */}
          <div className="overflow-y-auto flex-1">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <Bell className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Aucune notification</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onMarkAsRead={markAsRead}
                  onDelete={deleteNotification}
                  onClick={handleNotificationClick}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
