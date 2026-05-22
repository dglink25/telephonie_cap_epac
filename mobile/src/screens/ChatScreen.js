// mobile/src/screens/ChatScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, Modal, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import api from '../config/api';
import useAuthStore from '../store/authStore';
import useSocketStore from '../store/socketStore';
import Avatar from '../components/ui/Avatar';
import PresenceBadge from '../components/ui/PresenceBadge';

// ── Aperçu du dernier message ────────────────────────────────────
function lastMsgPreview(conv) {
  const m = conv.lastMessage;
  if (!m) return 'Aucun message';
  if (m.is_deleted) return 'Message retiré';
  if (m.type === 'audio') return '🎤 Message vocal';
  if (m.type === 'image') return '🖼 Image';
  if (m.type === 'video') return '🎥 Vidéo';
  if (m.type === 'file') return `📎 ${m.file_name || 'Fichier'}`;
  return m.content || '';
}

// ── Item conversation ─────────────────────────────────────────────
function ConvItem({ conv, currentUserId, onPress }) {
  const other = conv.members?.find((m) => m.id !== currentUserId);
  const name = conv.type === 'direct' ? other?.display_name : conv.name;
  const initial = name?.charAt(0)?.toUpperCase() || '?';
  const preview = lastMsgPreview(conv);
  const hasUnread = conv.unreadCount > 0;

  return (
    <TouchableOpacity style={styles.convItem} onPress={onPress} activeOpacity={0.7}>
      {/* Avatar */}
      <View style={styles.avatarWrap}>
        {other
          ? <><Avatar user={other} size="md" /><PresenceBadge status={other.presence_status} /></>
          : (
            <View style={styles.groupAvatar}>
              <Text style={styles.groupAvatarText}>{initial}</Text>
            </View>
          )
        }
      </View>

      {/* Infos */}
      <View style={styles.convInfo}>
        <View style={styles.convRow}>
          <Text style={[styles.convName, hasUnread && styles.convNameBold]} numberOfLines={1}>
            {name}
          </Text>
          {conv.lastMessage && (
            <Text style={styles.convTime}>
              {formatDistanceToNow(new Date(conv.lastMessage.created_at), { locale: fr, addSuffix: false })}
            </Text>
          )}
        </View>
        <View style={styles.convRow}>
          <Text style={[styles.convPreview, hasUnread && styles.convPreviewBold]} numberOfLines={1}>
            {preview}
          </Text>
          {hasUnread && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{conv.unreadCount > 99 ? '99+' : conv.unreadCount}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ── Modal nouvelle conversation ───────────────────────────────────
function NewConvModal({ visible, onClose, currentUserId, onCreated }) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState([]);
  const [groupName, setGroupName] = useState('');
  const [loading, setLoading] = useState(false);

  const { data: users } = useQuery({
    queryKey: ['users-search', search],
    queryFn: () => api.get('/users', { params: { search, limit: 20 } }).then((r) => r.data.data.users),
    enabled: visible,
  });

  const toggle = (u) => setSelected((s) =>
    s.find((x) => x.id === u.id) ? s.filter((x) => x.id !== u.id) : [...s, u]
  );

  const handleCreate = async () => {
    if (!selected.length) return;
    setLoading(true);
    try {
      const type = selected.length > 1 ? 'group' : 'direct';
      const { data } = await api.post('/conversations', {
        type,
        name: type === 'group' ? groupName || 'Nouveau groupe' : undefined,
        member_ids: selected.map((u) => u.id),
      });
      onCreated(data.data.conversation.id);
      setSelected([]);
      setGroupName('');
      setSearch('');
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSelected([]);
    setGroupName('');
    setSearch('');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
        {/* Header */}
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={handleClose}>
            <Text style={styles.modalCancel}>Annuler</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Nouvelle conversation</Text>
          <TouchableOpacity
            onPress={handleCreate}
            disabled={!selected.length || loading}
            style={[styles.modalCreate, (!selected.length || loading) && { opacity: 0.4 }]}
          >
            {loading
              ? <ActivityIndicator size="small" color="#16a34a" />
              : <Text style={styles.modalCreateText}>Créer</Text>
            }
          </TouchableOpacity>
        </View>

        <View style={styles.modalBody}>
          {/* Chips sélectionnés */}
          {selected.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>
              {selected.map((u) => (
                <TouchableOpacity key={u.id} style={styles.chip} onPress={() => toggle(u)}>
                  <Text style={styles.chipText}>{u.display_name}</Text>
                  <Ionicons name="close-circle" size={14} color="#15803d" />
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {/* Nom de groupe si > 1 */}
          {selected.length > 1 && (
            <TextInput
              style={styles.groupInput}
              placeholder="Nom du groupe…"
              placeholderTextColor="#94a3b8"
              value={groupName}
              onChangeText={setGroupName}
            />
          )}

          {/* Recherche */}
          <View style={styles.searchWrap}>
            <Ionicons name="search" size={16} color="#94a3b8" />
            <TextInput
              style={styles.searchInput}
              placeholder="Rechercher un utilisateur…"
              placeholderTextColor="#94a3b8"
              value={search}
              onChangeText={setSearch}
              autoFocus
            />
          </View>

          {/* Liste utilisateurs */}
          <FlatList
            data={(users || []).filter((u) => u.id !== currentUserId)}
            keyExtractor={(u) => u.id}
            renderItem={({ item: u }) => {
              const isSelected = !!selected.find((x) => x.id === u.id);
              return (
                <TouchableOpacity
                  style={[styles.userItem, isSelected && styles.userItemSelected]}
                  onPress={() => toggle(u)}
                  activeOpacity={0.7}
                >
                  <Avatar user={u} size="sm" />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.userName}>{u.display_name}</Text>
                    <Text style={styles.userSub}>@{u.username}{u.department ? ` · ${u.department}` : ''}</Text>
                  </View>
                  {isSelected && <Ionicons name="checkmark-circle" size={20} color="#16a34a" />}
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <Text style={styles.emptyText}>Aucun utilisateur trouvé</Text>
            }
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

// ── Page principale ───────────────────────────────────────────────
export default function ChatScreen({ navigation }) {
  const { user } = useAuthStore();
  const { socket } = useSocketStore();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [showNew, setShowNew] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => api.get('/conversations').then((r) => r.data.data.conversations),
    refetchInterval: 30000,
  });
  const conversations = data || [];

  // Écouter les nouveaux messages via socket
  useEffect(() => {
    if (!socket) return;
    const onNew = () => qc.invalidateQueries(['conversations']);
    socket.on('message:new', onNew);
    socket.on('conversation:new', onNew);
    return () => {
      socket.off('message:new', onNew);
      socket.off('conversation:new', onNew);
    };
  }, [socket]);

  const filtered = conversations.filter((c) => {
    const other = c.members?.find((m) => m.id !== user.id);
    const name = c.type === 'direct' ? other?.display_name : c.name;
    return name?.toLowerCase().includes(search.toLowerCase());
  });

  const handleCreated = (convId) => {
    setShowNew(false);
    qc.invalidateQueries(['conversations']);
    navigation.navigate('Conversation', { conversationId: convId });
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Messages</Text>
        <TouchableOpacity onPress={() => setShowNew(true)} style={styles.addBtn}>
          <Ionicons name="create-outline" size={24} color="#16a34a" />
        </TouchableOpacity>
      </View>

      {/* Barre de recherche */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={16} color="#94a3b8" style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchBarInput}
          placeholder="Rechercher…"
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

      {/* Liste */}
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#16a34a" />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="chatbubbles-outline" size={56} color="#cbd5e1" />
          <Text style={styles.emptyTitle}>Aucune conversation</Text>
          <Text style={styles.emptySubtitle}>Créez-en une nouvelle</Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={() => setShowNew(true)}>
            <Text style={styles.emptyBtnText}>Nouvelle conversation</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(c) => c.id}
          renderItem={({ item }) => (
            <ConvItem
              conv={item}
              currentUserId={user.id}
              onPress={() => navigation.navigate('Conversation', { conversationId: item.id })}
            />
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      )}

      {/* Modal nouvelle conv */}
      <NewConvModal
        visible={showNew}
        onClose={() => setShowNew(false)}
        currentUserId={user.id}
        onCreated={handleCreated}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#0f172a' },
  addBtn: { padding: 4 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginVertical: 10,
    backgroundColor: '#f1f5f9', borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  searchBarInput: { flex: 1, fontSize: 15, color: '#1e293b' },
  convItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 13,
  },
  avatarWrap: { position: 'relative', marginRight: 12 },
  groupAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#16a34a', justifyContent: 'center', alignItems: 'center',
  },
  groupAvatarText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  convInfo: { flex: 1 },
  convRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  convName: { fontSize: 15, color: '#1e293b', flex: 1, marginRight: 8 },
  convNameBold: { fontWeight: '700' },
  convTime: { fontSize: 11, color: '#94a3b8' },
  convPreview: { fontSize: 13, color: '#94a3b8', flex: 1, marginRight: 8, marginTop: 2 },
  convPreviewBold: { color: '#475569', fontWeight: '600' },
  badge: {
    backgroundColor: '#16a34a', borderRadius: 10,
    paddingHorizontal: 6, paddingVertical: 2, minWidth: 20, alignItems: 'center',
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  separator: { height: 1, backgroundColor: '#f8fafc', marginLeft: 72 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: '#475569' },
  emptySubtitle: { fontSize: 14, color: '#94a3b8' },
  emptyBtn: {
    backgroundColor: '#16a34a', borderRadius: 12,
    paddingHorizontal: 20, paddingVertical: 10, marginTop: 8,
  },
  emptyBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  emptyText: { textAlign: 'center', color: '#94a3b8', marginTop: 24 },
  // Modal
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
  },
  modalCancel: { fontSize: 16, color: '#64748b' },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#0f172a' },
  modalCreate: { padding: 4 },
  modalCreateText: { fontSize: 16, color: '#16a34a', fontWeight: '700' },
  modalBody: { flex: 1, padding: 16 },
  chips: { flexDirection: 'row', marginBottom: 12, maxHeight: 40 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#dcfce7', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 6, marginRight: 8,
  },
  chipText: { color: '#15803d', fontSize: 13, fontWeight: '600' },
  groupInput: {
    borderWidth: 1, borderColor: '#d1d5db', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 15,
    color: '#1e293b', backgroundColor: '#f9fafb', marginBottom: 12,
  },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#f1f5f9', borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12,
  },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 15, color: '#1e293b' },
  userItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, paddingHorizontal: 4, borderRadius: 12,
  },
  userItemSelected: { backgroundColor: '#f0fdf4' },
  userName: { fontSize: 14, fontWeight: '600', color: '#1e293b' },
  userSub: { fontSize: 12, color: '#94a3b8', marginTop: 1 },
});