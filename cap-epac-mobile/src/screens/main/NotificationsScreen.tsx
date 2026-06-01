// src/screens/main/NotificationsScreen.tsx
import React, { useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator,
} from 'react-native';
import { COLORS, SIZES } from '../../utils/constants';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { EmptyState } from '../../components/common';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

interface Notification {
  id: string;
  type: string;
  title: string;
  message?: string;
  is_read: boolean;
  created_at: string;
  action_url?: string;
}

interface Props {
  navigation: NativeStackNavigationProp<any>;
}

const NOTIFICATION_ICONS: Record<string, string> = {
  message: 'message-text',
  mention: 'at',
  call_missed: 'phone-missed',
  call_incoming: 'phone-incoming',
  group_added: 'account-multiple-plus',
  group_removed: 'account-multiple-minus',
  user_status: 'account',
  system: 'information',
};

const NOTIFICATION_COLORS: Record<string, string> = {
  message: COLORS.primary,
  mention: '#9333ea',
  call_missed: COLORS.danger,
  call_incoming: COLORS.primary,
  group_added: COLORS.primary,
  group_removed: '#f97316',
  user_status: COLORS.gray500,
  system: COLORS.gray500,
};

const NotificationsScreen: React.FC<Props> = ({ navigation }) => {
  const [notifications, setNotifications] = React.useState<Notification[]>([]);
  const [refreshing, setRefreshing] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const fetchNotifications = async () => {
    try {
      // TODO: Implémenter l'appel API quand le backend sera prêt
      // const resp = await notificationsAPI.getAll();
      // setNotifications(resp.data.data.notifications);
      setNotifications([]);
    } catch (error) {
      console.error('Erreur chargement notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchNotifications();
    setRefreshing(false);
  };

  const handleNotificationPress = async (notification: Notification) => {
    // Marquer comme lue
    if (!notification.is_read) {
      // TODO: Appel API pour marquer comme lue
      // await notificationsAPI.markAsRead(notification.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, is_read: true } : n))
      );
    }

    // Navigation si action_url existe
    if (notification.action_url) {
      // Extraire la route depuis l'URL (ex: /chat/123 -> Chat avec conversationId: 123)
      const match = notification.action_url.match(/\/chat\/(.+)/);
      if (match) {
        navigation.navigate('Chat', { conversationId: match[1] });
      }
    }
  };

  const handleMarkAsRead = async (id: string) => {
    // TODO: Appel API
    // await notificationsAPI.markAsRead(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
  };

  const handleDelete = async (id: string) => {
    // TODO: Appel API
    // await notificationsAPI.delete(id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const handleMarkAllAsRead = async () => {
    // TODO: Appel API
    // await notificationsAPI.markAllAsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const handleDeleteAllRead = async () => {
    // TODO: Appel API
    // await notificationsAPI.deleteAllRead();
    setNotifications((prev) => prev.filter((n) => !n.is_read));
  };

  const renderNotification = ({ item }: { item: Notification }) => {
    const timeAgo = formatDistanceToNow(new Date(item.created_at), {
      addSuffix: true,
      locale: fr,
    });

    const iconName = NOTIFICATION_ICONS[item.type] || 'information';
    const iconColor = NOTIFICATION_COLORS[item.type] || COLORS.gray500;

    return (
      <TouchableOpacity
        style={[styles.notifCard, !item.is_read && styles.notifCardUnread]}
        onPress={() => handleNotificationPress(item)}
        activeOpacity={0.7}
      >
        <View style={[styles.iconContainer, { backgroundColor: `${iconColor}15` }]}>
          <Icon name={iconName} size={24} color={iconColor} />
        </View>

        <View style={styles.notifContent}>
          <View style={styles.notifHeader}>
            <Text style={[styles.notifTitle, !item.is_read && styles.notifTitleUnread]}>
              {item.title}
            </Text>
            {!item.is_read && <View style={styles.unreadDot} />}
          </View>

          {item.message && (
            <Text style={styles.notifMessage} numberOfLines={2}>
              {item.message}
            </Text>
          )}

          <View style={styles.notifFooter}>
            <Text style={styles.notifTime}>{timeAgo}</Text>
            <View style={styles.notifActions}>
              {!item.is_read && (
                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation();
                    handleMarkAsRead(item.id);
                  }}
                  style={styles.actionBtn}
                >
                  <Icon name="check" size={18} color={COLORS.primary} />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation();
                  handleDelete(item.id);
                }}
                style={styles.actionBtn}
              >
                <Icon name="delete-outline" size={18} color={COLORS.danger} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Notifications</Text>
          {unreadCount > 0 && (
            <Text style={styles.headerSubtitle}>{unreadCount} non lues</Text>
          )}
        </View>
        <View style={styles.headerActions}>
          {unreadCount > 0 && (
            <TouchableOpacity onPress={handleMarkAllAsRead} style={styles.headerBtn}>
              <Icon name="check-all" size={22} color={COLORS.white} />
            </TouchableOpacity>
          )}
          {notifications.some((n) => n.is_read) && (
            <TouchableOpacity onPress={handleDeleteAllRead} style={styles.headerBtn}>
              <Icon name="delete-sweep" size={22} color={COLORS.white} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Liste */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={renderNotification}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[COLORS.primary]}
            />
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            <EmptyState
              title="Aucune notification"
              subtitle="Vous êtes à jour !"
            />
          }
          contentContainerStyle={notifications.length === 0 ? { flex: 1 } : { padding: 12 }}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.gray50 },
  header: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingBottom: 14,
    paddingHorizontal: 20,
  },
  headerTitle: { fontSize: SIZES.xl, fontWeight: '700', color: COLORS.white },
  headerSubtitle: { fontSize: SIZES.sm, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  headerActions: { flexDirection: 'row', gap: 8 },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notifCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderRadius: SIZES.radiusLg,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  notifCardUnread: {
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  notifContent: { flex: 1 },
  notifHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  notifTitle: {
    fontSize: SIZES.md,
    fontWeight: '500',
    color: COLORS.gray800,
    flex: 1,
  },
  notifTitleUnread: { fontWeight: '700', color: COLORS.gray900 },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
    marginLeft: 8,
  },
  notifMessage: {
    fontSize: SIZES.sm,
    color: COLORS.gray600,
    lineHeight: 20,
    marginBottom: 8,
  },
  notifFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  notifTime: { fontSize: SIZES.xs, color: COLORS.gray400 },
  notifActions: { flexDirection: 'row', gap: 4 },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.gray100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  separator: { height: 8 },
});

export default NotificationsScreen;
