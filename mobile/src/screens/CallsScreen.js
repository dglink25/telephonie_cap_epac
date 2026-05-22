// mobile/src/screens/CallsScreen.js
import React, { useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import api from '../config/api';
import useAuthStore from '../store/authStore';
import useSocketStore from '../store/socketStore';
import useCallStore from '../store/callStore';
import Avatar from '../components/ui/Avatar';

const STATUS = {
  completed: { label: 'Terminé',  color: '#16a34a', bg: '#dcfce7', icon: 'call' },
  missed:    { label: 'Manqué',   color: '#ef4444', bg: '#fee2e2', icon: 'call-outline' },
  rejected:  { label: 'Refusé',   color: '#f59e0b', bg: '#fef3c7', icon: 'call-outline' },
  failed:    { label: 'Échoué',   color: '#94a3b8', bg: '#f1f5f9', icon: 'call-outline' },
  ongoing:   { label: 'En cours', color: '#3b82f6', bg: '#dbeafe', icon: 'call' },
};

function formatDur(s) {
  if (!s) return '';
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

function CallRow({ call, currentUserId }) {
  const { emit } = useSocketStore();
  const { setOutgoingCall } = useCallStore();
  const isOut = call.caller_id === currentUserId;
  const other = isOut ? call.callee : call.caller;
  const cfg = STATUS[call.status] || STATUS.completed;

  const handleCallback = () => {
    if (!other) return;
    emit('call:initiate', { calleeId: other.id, type: call.type || 'audio' });
    setOutgoingCall({
      calleeId: other.id,
      calleeName: other.display_name,
      calleeInitial: other.display_name?.charAt(0)?.toUpperCase(),
      type: call.type || 'audio',
      callId: null,
    });
  };

  return (
    <View style={styles.row}>
      <View style={[styles.iconWrap, { backgroundColor: cfg.bg }]}>
        {isOut
          ? <Ionicons name="arrow-up-outline" size={18} color={cfg.color} />
          : call.status === 'missed'
          ? <Ionicons name="call-outline" size={18} color="#ef4444" style={{ transform: [{ rotate: '135deg' }] }} />
          : <Ionicons name="arrow-down-outline" size={18} color={cfg.color} />
        }
      </View>

      <View style={{ marginRight: 12 }}>
        <Avatar user={other} size="sm" />
      </View>

      <View style={styles.rowInfo}>
        <View style={styles.rowTop}>
          <Text style={styles.rowName}>{other?.display_name || 'Inconnu'}</Text>
          <Text style={[styles.rowStatus, { color: cfg.color }]}>{cfg.label}</Text>
        </View>
        <View style={styles.rowBottom}>
          <Text style={styles.rowTime}>
            {formatDistanceToNow(new Date(call.created_at), { addSuffix: true, locale: fr })}
          </Text>
          {call.type === 'video' && (
            <Ionicons name="videocam-outline" size={12} color="#94a3b8" style={{ marginLeft: 6 }} />
          )}
          {call.duration_seconds > 0 && (
            <Text style={styles.rowDuration}> · {formatDur(call.duration_seconds)}</Text>
          )}
        </View>
      </View>

      <TouchableOpacity onPress={handleCallback} style={styles.callbackBtn}>
        <Ionicons name="call-outline" size={20} color="#16a34a" />
      </TouchableOpacity>
    </View>
  );
}

const TABS = [
  { id: 'all',       label: 'Tous' },
  { id: 'completed', label: 'Terminés' },
  { id: 'missed',    label: 'Manqués' },
  { id: 'rejected',  label: 'Refusés' },
];

export default function CallsScreen() {
  const { user } = useAuthStore();
  const [filter, setFilter] = useState('all');

  const { data, isLoading } = useQuery({
    queryKey: ['calls', filter],
    queryFn: () =>
      api.get('/calls', {
        params: { limit: 100, ...(filter !== 'all' ? { status: filter } : {}) },
      }).then((r) => r.data.data.calls),
    refetchInterval: 30000,
  });
  const calls = data || [];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Appels</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {TABS.map((t) => (
          <TouchableOpacity
            key={t.id}
            style={[styles.tab, filter === t.id && styles.tabActive]}
            onPress={() => setFilter(t.id)}
          >
            <Text style={[styles.tabText, filter === t.id && styles.tabTextActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#16a34a" />
        </View>
      ) : calls.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="call-outline" size={56} color="#cbd5e1" />
          <Text style={styles.emptyText}>Aucun appel</Text>
        </View>
      ) : (
        <FlatList
          data={calls}
          keyExtractor={(c) => c.id}
          renderItem={({ item }) => <CallRow call={item} currentUserId={user.id} />}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fff' },
  header: {
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#0f172a' },
  tabs: {
    flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 8,
    gap: 6, backgroundColor: '#f8fafc',
    borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
  },
  tab: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 20, backgroundColor: '#fff',
    borderWidth: 1, borderColor: '#e2e8f0',
  },
  tabActive: { backgroundColor: '#16a34a', borderColor: '#16a34a' },
  tabText: { fontSize: 13, fontWeight: '500', color: '#64748b' },
  tabTextActive: { color: '#fff', fontWeight: '700' },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  iconWrap: {
    width: 36, height: 36, borderRadius: 18,
    justifyContent: 'center', alignItems: 'center',
    marginRight: 10,
  },
  rowInfo: { flex: 1 },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowName: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
  rowStatus: { fontSize: 12, fontWeight: '600' },
  rowBottom: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  rowTime: { fontSize: 12, color: '#94a3b8' },
  rowDuration: { fontSize: 12, color: '#94a3b8' },
  callbackBtn: { padding: 8 },
  sep: { height: 1, backgroundColor: '#f8fafc', marginLeft: 72 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  emptyText: { fontSize: 16, color: '#94a3b8', fontWeight: '500' },
});