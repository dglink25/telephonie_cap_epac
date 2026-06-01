// src/screens/main/ContactsScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, RefreshControl, Alert,
} from 'react-native';
import { usersAPI } from '../../services/api';
import { conversationsAPI } from '../../services/api';
import { Avatar, EmptyState } from '../../components/common';
import { COLORS, SIZES, PRESENCE_COLORS, PRESENCE_LABELS } from '../../utils/constants';
import { useAuthStore } from '../../store/authStore';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

interface User {
  id: string;
  username: string;
  display_name: string;
  email: string;
  avatar_url: string | null;
  role: string;
  presence_status: string;
  department: string | null;
  phone_extension: string | null;
  last_seen_at: string | null;
  is_active: boolean;
}

interface Props {
  navigation: NativeStackNavigationProp<any>;
}

const ContactsScreen: React.FC<Props> = ({ navigation }) => {
  const { user: me } = useAuthStore();
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const fetchUsers = useCallback(async (pg = 1, q = '') => {
    if (loading && pg > 1) return;
    if (pg === 1) setLoading(true);
    try {
      const resp = await usersAPI.getAll({ page: pg, limit: 50, search: q });
      const data: User[] = resp.data.data.users;
      const total: number = resp.data.data.pagination.total;
      setUsers((prev) => (pg === 1 ? data : [...prev, ...data]));
      setHasMore((pg * 50) < total);
      setPage(pg);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchUsers(1, search);
  }, [search]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchUsers(1, search);
    setRefreshing(false);
  };

  const startDirectChat = async (targetUser: User) => {
    try {
      const resp = await conversationsAPI.create({
        type: 'direct',
        member_ids: [targetUser.id],
      });
      const conv = resp.data.data.conversation;
      navigation.navigate('Chat', {
        conversationId: conv.id,
        name: targetUser.display_name,
        avatar: targetUser.avatar_url,
        type: 'direct',
      });
    } catch {
      Alert.alert('Erreur', 'Impossible d\'ouvrir la conversation');
    }
  };

  const initiateCall = (targetUser: User, type: 'audio' | 'video') => {
    navigation.navigate('OutgoingCall', {
      calleeId: targetUser.id,
      calleeName: targetUser.display_name,
      calleeAvatar: targetUser.avatar_url,
      type,
    });
  };

  const grouped = users.reduce((acc: Record<string, User[]>, u) => {
    if (u.id === me?.id) return acc;
    const dept = u.department || 'Autre';
    if (!acc[dept]) acc[dept] = [];
    acc[dept].push(u);
    return acc;
  }, {});

  const sections = Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));

  const renderUser = (u: User) => (
    <TouchableOpacity
      key={u.id}
      style={styles.userItem}
      onPress={() => navigation.navigate('UserProfile', { userId: u.id, startChat: startDirectChat })}
      activeOpacity={0.7}
    >
      <Avatar
        url={u.avatar_url}
        name={u.display_name}
        size={44}
        presenceStatus={u.presence_status}
      />
      <View style={styles.userInfo}>
        <Text style={styles.userName}>{u.display_name}</Text>
        <View style={styles.userMeta}>
          <View
            style={[
              styles.presenceDot,
              { backgroundColor: PRESENCE_COLORS[u.presence_status] || COLORS.offline },
            ]}
          />
          <Text style={styles.presenceLabel}>
            {PRESENCE_LABELS[u.presence_status] || 'Hors ligne'}
          </Text>
          {u.phone_extension && (
            <Text style={styles.extText}> · Ext. {u.phone_extension}</Text>
          )}
        </View>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => startDirectChat(u)}
        >
          <Icon name="message-text" size={18} color={COLORS.primary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => initiateCall(u, 'audio')}
        >
          <Icon name="phone" size={18} color={COLORS.primary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => initiateCall(u, 'video')}
        >
          <Icon name="video" size={18} color={COLORS.primary} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Contacts</Text>
        <View style={styles.onlineCount}>
          <View style={styles.onlineDot} />
          <Text style={styles.onlineText}>
            {users.filter((u) => u.presence_status === 'online').length} en ligne
          </Text>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchBar}>
        <Icon name="magnify" size={20} color={COLORS.gray400} style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Rechercher un contact..."
          placeholderTextColor={COLORS.gray400}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <FlatList
        data={sections}
        keyExtractor={([dept]) => dept}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
        }
        renderItem={({ item: [dept, deptUsers] }) => (
          <View>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{dept}</Text>
              <Text style={styles.sectionCount}>{deptUsers.length}</Text>
            </View>
            {deptUsers.map(renderUser)}
          </View>
        )}
        onEndReached={() => hasMore && fetchUsers(page + 1, search)}
        onEndReachedThreshold={0.2}
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              title="Aucun contact"
              subtitle={search ? 'Aucun résultat pour cette recherche' : ''}
            />
          ) : null
        }
        contentContainerStyle={sections.length === 0 ? { flex: 1 } : undefined}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
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
  onlineCount: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4ade80' },
  onlineText: { fontSize: SIZES.sm, color: 'rgba(255,255,255,0.85)' },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.gray100,
    margin: 12,
    borderRadius: SIZES.radiusLg,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  searchIcon: { fontSize: 14, marginRight: 8 },
  searchInput: { flex: 1, fontSize: SIZES.md, color: COLORS.gray900 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.gray50,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray200,
  },
  sectionTitle: {
    fontSize: SIZES.sm,
    fontWeight: '600',
    color: COLORS.gray600,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionCount: {
    fontSize: SIZES.xs,
    color: COLORS.gray400,
    backgroundColor: COLORS.gray200,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: SIZES.radiusFull,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.white,
  },
  userInfo: { flex: 1, marginLeft: 12 },
  userName: { fontSize: SIZES.md, fontWeight: '500', color: COLORS.gray900 },
  userMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  presenceDot: { width: 7, height: 7, borderRadius: 3.5, marginRight: 5 },
  presenceLabel: { fontSize: SIZES.xs, color: COLORS.gray500 },
  extText: { fontSize: SIZES.xs, color: COLORS.gray400 },
  actions: { flexDirection: 'row', gap: 2 },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primaryXXLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIcon: { fontSize: 16 },
});

export default ContactsScreen;
