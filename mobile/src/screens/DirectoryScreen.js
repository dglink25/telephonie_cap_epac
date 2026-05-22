// mobile/src/screens/DirectoryScreen.js
import React, { useState } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import api from '../config/api';
import useAuthStore from '../store/authStore';
import useSocketStore from '../store/socketStore';
import useCallStore from '../store/callStore';
import Avatar from '../components/ui/Avatar';
import PresenceBadge from '../components/ui/PresenceBadge';

const PRESENCE = {
  online:  { label: 'En ligne',        dot: '#22c55e' },
  away:    { label: 'Absent',           dot: '#facc15' },
  dnd:     { label: 'Ne pas déranger',  dot: '#ef4444' },
  offline: { label: 'Hors ligne',       dot: '#94a3b8' },
};

function UserCard({ user, currentUserId, onMessage, onCall }) {
  const p = PRESENCE[user.presence_status] || PRESENCE.offline;
  if (user.id === currentUserId) return null;

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        {/* Avatar */}
        <View style={{ position: 'relative', marginRight: 14 }}>
          <Avatar user={user} size="lg" />
          <PresenceBadge status={user.presence_status} size={14} />
        </View>

        {/* Infos */}
        <View style={{ flex: 1 }}>
          <View style={styles.nameRow}>
            <Text style={styles.displayName} numberOfLines={1}>{user.display_name}</Text>
            {user.role === 'admin' && (
              <View style={styles.adminBadge}>
                <Text style={styles.adminText}>Admin</Text>
              </View>
            )}
          </View>
          <Text style={styles.username}>@{user.username}</Text>
          {user.department && <Text style={styles.department}>{user.department}</Text>}
          <View style={styles.presenceRow}>
            <View style={[styles.presenceDot, { backgroundColor: p.dot }]} />
            <Text style={styles.presenceLabel}>{p.label}</Text>
          </View>
          {user.phone_extension && (
            <Text style={styles.extension}>Poste : {user.phone_extension}</Text>
          )}
        </View>
      </View>

      {/* Actions */}
      <View style={styles.cardActions}>
        <TouchableOpacity style={styles.actionMsg} onPress={() => onMessage(user)}>
          <Ionicons name="chatbubble-outline" size={16} color="#16a34a" />
          <Text style={styles.actionMsgText}>Message</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionCall} onPress={() => onCall(user, 'audio')}>
          <Ionicons name="call" size={16} color="#fff" />
          <Text style={styles.actionCallText}>Appeler</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionVideo} onPress={() => onCall(user, 'video')}>
          <Ionicons name="videocam" size={18} color="#16a34a" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function DirectoryScreen() {
  const navigation = useNavigation();
  const { user: currentUser } = useAuthStore();
  const { emit } = useSocketStore();
  const { setOutgoingCall } = useCallStore();
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['users', search, department],
    queryFn: () =>
      api.get('/users', {
        params: { search, department: department || undefined, limit: 100 },
      }).then((r) => r.data.data.users),
    staleTime: 30000,
  });
  const users = data || [];
  const departments = [...new Set(users.map((u) => u.department).filter(Boolean))].sort();

  const handleMessage = async (user) => {
    try {
      const { data: res } = await api.post('/conversations', {
        type: 'direct', member_ids: [user.id],
      });
      navigation.navigate('Chat', {
        screen: 'Conversation',
        params: { conversationId: res.data.conversation.id },
      });
    } catch {
      Toast.show({ type: 'error', text1: 'Impossible d\'ouvrir la conversation' });
    }
  };

  const handleCall = (user, type) => {
    emit('call:initiate', { calleeId: user.id, type });
    setOutgoingCall({
      calleeId: user.id,
      calleeName: user.display_name,
      calleeInitial: user.display_name?.charAt(0)?.toUpperCase(),
      type,
      callId: null,
    });
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Annuaire</Text>
      </View>

      {/* Recherche */}
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={16} color="#94a3b8" />
        <TextInput
          style={styles.searchInput}
          placeholder="Rechercher par nom…"
          placeholderTextColor="#94a3b8"
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color="#94a3b8" />
          </TouchableOpacity>
        )}
      </View>

      {/* Filtre département */}
      {departments.length > 0 && (
        <View style={styles.depsWrap}>
          <TouchableOpacity
            style={[styles.depChip, !department && styles.depChipActive]}
            onPress={() => setDepartment('')}
          >
            <Text style={[styles.depChipText, !department && styles.depChipTextActive]}>Tous</Text>
          </TouchableOpacity>
          {departments.map((d) => (
            <TouchableOpacity
              key={d}
              style={[styles.depChip, department === d && styles.depChipActive]}
              onPress={() => setDepartment(department === d ? '' : d)}
            >
              <Text style={[styles.depChipText, department === d && styles.depChipTextActive]} numberOfLines={1}>
                {d}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Compteur */}
      <Text style={styles.count}>
        {isLoading ? '' : `${users.filter(u => u.id !== currentUser.id).length} utilisateur(s)`}
      </Text>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#16a34a" />
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(u) => u.id}
          renderItem={({ item }) => (
            <UserCard
              user={item}
              currentUserId={currentUser.id}
              onMessage={handleMessage}
              onCall={handleCall}
            />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="book-outline" size={56} color="#cbd5e1" />
              <Text style={styles.emptyText}>Aucun utilisateur</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#0f172a' },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    margin: 12, backgroundColor: '#fff',
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 11,
    borderWidth: 1, borderColor: '#e2e8f0',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 15, color: '#1e293b' },
  depsWrap: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
    paddingHorizontal: 12, marginBottom: 4,
  },
  depChip: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, backgroundColor: '#fff',
    borderWidth: 1, borderColor: '#e2e8f0',
  },
  depChipActive: { backgroundColor: '#16a34a', borderColor: '#16a34a' },
  depChipText: { fontSize: 12, color: '#64748b', fontWeight: '500' },
  depChipTextActive: { color: '#fff', fontWeight: '700' },
  count: { fontSize: 12, color: '#94a3b8', paddingHorizontal: 16, marginBottom: 8 },
  list: { paddingHorizontal: 12, paddingBottom: 24, gap: 10 },
  card: {
    backgroundColor: '#fff', borderRadius: 18,
    padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  cardTop: { flexDirection: 'row', marginBottom: 14 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  displayName: { fontSize: 16, fontWeight: '700', color: '#0f172a', flex: 1 },
  adminBadge: {
    backgroundColor: '#dcfce7', borderRadius: 8,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  adminText: { fontSize: 10, fontWeight: '700', color: '#15803d' },
  username: { fontSize: 12, color: '#94a3b8', marginBottom: 2 },
  department: { fontSize: 13, color: '#64748b', marginBottom: 4 },
  presenceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  presenceDot: { width: 8, height: 8, borderRadius: 4 },
  presenceLabel: { fontSize: 12, color: '#64748b' },
  extension: { fontSize: 12, color: '#94a3b8' },
  cardActions: { flexDirection: 'row', gap: 8 },
  actionMsg: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 9, borderRadius: 12,
    borderWidth: 1, borderColor: '#16a34a', backgroundColor: '#fff',
  },
  actionMsgText: { fontSize: 13, fontWeight: '600', color: '#16a34a' },
  actionCall: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 9, borderRadius: 12, backgroundColor: '#16a34a',
  },
  actionCallText: { fontSize: 13, fontWeight: '600', color: '#fff' },
  actionVideo: {
    width: 42, height: 42, borderRadius: 12,
    borderWidth: 1, borderColor: '#16a34a',
    justifyContent: 'center', alignItems: 'center',
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, paddingTop: 60 },
  emptyText: { fontSize: 16, color: '#94a3b8', fontWeight: '500' },
});