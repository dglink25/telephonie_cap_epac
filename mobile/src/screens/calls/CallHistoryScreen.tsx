// src/screens/calls/CallHistoryScreen.tsx
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl,
} from 'react-native';
import { callsAPI } from '../../services/api';
import { Avatar, EmptyState } from '../../components/common';
import { COLORS, SIZES } from '../../utils/constants';
import { useAuthStore } from '../../store/authStore';
import { useCallStore, CallLog } from '../../store/callStore';
import dayjs from 'dayjs';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

interface Props {
  navigation: NativeStackNavigationProp<any>;
}

const STATUS_LABELS: Record<string, { label: string; color: string; iconName: string }> = {
  completed: { label: 'Terminé', color: COLORS.primary, iconName: 'phone-check' },
  missed: { label: 'Manqué', color: COLORS.danger, iconName: 'phone-missed' },
  rejected: { label: 'Refusé', color: COLORS.warning, iconName: 'phone-cancel' },
  failed: { label: 'Échoué', color: COLORS.gray500, iconName: 'phone-remove' },
  ongoing: { label: 'En cours', color: COLORS.primary, iconName: 'phone-in-talk' },
};

const TYPE_ICON_NAMES: Record<string, string> = {
  audio: 'phone',
  video: 'video',
  group_audio: 'account-group',
  group_video: 'account-group',
};

const formatDuration = (secs: number): string => {
  if (!secs || secs === 0) return '-';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
};

const CallHistoryScreen: React.FC<Props> = ({ navigation }) => {
  const { user } = useAuthStore();
  const [calls, setCalls] = useState<CallLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [filter, setFilter] = useState<string | null>(null);

  const fetchCalls = useCallback(async (pg = 1, status?: string | null) => {
    if (loading && pg > 1) return;
    setLoading(true);
    try {
      const params: Record<string, unknown> = { page: pg, limit: 30 };
      if (status) params.status = status;
      const resp = await callsAPI.getLogs(params);
      const data: CallLog[] = resp.data.data.calls;
      const total: number = resp.data.data.pagination.total;
      setCalls((prev) => (pg === 1 ? data : [...prev, ...data]));
      setHasMore(pg * 30 < total);
      setPage(pg);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchCalls(1, filter);
  }, [filter]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchCalls(1, filter);
    setRefreshing(false);
  };

  const getOtherParty = (call: CallLog) => {
    const isCalller = call.caller_id === user?.id;
    return isCalller ? call.callee : call.caller;
  };

  const isIncoming = (call: CallLog) => call.callee_id === user?.id;

  const renderCall = ({ item }: { item: CallLog }) => {
    const other = getOtherParty(item);
    const info = STATUS_LABELS[item.status] || STATUS_LABELS.failed;
    const typeIconName = TYPE_ICON_NAMES[item.type] || 'phone';
    const incoming = isIncoming(item);
    const time = dayjs(item.created_at).format('DD/MM · HH:mm');

    return (
      <TouchableOpacity
        style={styles.callItem}
        onPress={() =>
          other &&
          navigation.navigate('OutgoingCall', {
            calleeId: other.id,
            calleeName: other.display_name,
            calleeAvatar: other.avatar_url,
            type: item.type.includes('video') ? 'video' : 'audio',
          })
        }
        activeOpacity={0.7}
      >
        <Avatar
          url={other?.avatar_url || null}
          name={other?.display_name || '?'}
          size={44}
        />
        <View style={styles.callInfo}>
          <View style={styles.callHeader}>
            <Text style={styles.callerName}>{other?.display_name || 'Inconnu'}</Text>
            <Text style={styles.callTime}>{time}</Text>
          </View>
          <View style={styles.callMeta}>
            <Icon 
              name={incoming ? 'arrow-bottom-left' : 'arrow-top-right'} 
              size={14} 
              color={COLORS.gray500} 
              style={{ marginRight: 4 }}
            />
            <Text style={[styles.callStatus, { color: info.color }]}>
              {info.label}
            </Text>
            <Text style={styles.callType}> · </Text>
            <Icon name={typeIconName} size={14} color={COLORS.gray500} />
            {item.duration_seconds > 0 && (
              <Text style={styles.callDuration}> · {formatDuration(item.duration_seconds)}</Text>
            )}
          </View>
        </View>

        {/* Rappel rapide */}
        <TouchableOpacity
          style={styles.callBackBtn}
          onPress={() =>
            other &&
            navigation.navigate('OutgoingCall', {
              calleeId: other.id,
              calleeName: other.display_name,
              calleeAvatar: other.avatar_url,
              type: 'audio',
            })
          }
        >
          <Icon name="phone" size={18} color={COLORS.primary} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const FILTERS = [
    { label: 'Tous', value: null },
    { label: 'Terminés', value: 'completed' },
    { label: 'Manqués', value: 'missed' },
    { label: 'Refusés', value: 'rejected' },
  ];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Appels</Text>
      </View>

      {/* Filtres */}
      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={String(f.value)}
            style={[styles.filterChip, filter === f.value && styles.filterChipActive]}
            onPress={() => setFilter(f.value)}
          >
            <Text style={[styles.filterText, filter === f.value && styles.filterTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={calls}
        keyExtractor={(item) => item.id}
        renderItem={renderCall}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
        }
        onEndReached={() => hasMore && fetchCalls(page + 1, filter)}
        onEndReachedThreshold={0.2}
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              title="Aucun appel"
              subtitle="Votre historique d'appels apparaîtra ici"
            />
          ) : null
        }
        contentContainerStyle={calls.length === 0 ? { flex: 1 } : undefined}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  header: {
    backgroundColor: COLORS.primary,
    paddingTop: 50,
    paddingBottom: 14,
    paddingHorizontal: 20,
  },
  headerTitle: { fontSize: SIZES.xl, fontWeight: '700', color: COLORS.white },
  filterRow: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray100,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: SIZES.radiusFull,
    backgroundColor: COLORS.gray100,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  filterChipActive: {
    backgroundColor: COLORS.primaryXLight,
    borderColor: COLORS.primary,
  },
  filterText: { fontSize: SIZES.sm, color: COLORS.gray600 },
  filterTextActive: { color: COLORS.primaryDark, fontWeight: '600' },
  callItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  callInfo: { flex: 1, marginLeft: 12 },
  callHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  callerName: { fontSize: SIZES.md, fontWeight: '500', color: COLORS.gray900 },
  callTime: { fontSize: SIZES.xs, color: COLORS.gray400 },
  callMeta: { flexDirection: 'row', alignItems: 'center' },
  callDirection: { fontSize: SIZES.sm, color: COLORS.gray500 },
  callStatus: { fontSize: SIZES.sm, fontWeight: '500' },
  callType: { fontSize: SIZES.sm, color: COLORS.gray500 },
  callDuration: { fontSize: SIZES.sm, color: COLORS.gray400 },
  callBackBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.primaryXLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  callBackIcon: { fontSize: 16 },
  separator: { height: 1, backgroundColor: COLORS.gray100, marginLeft: 72 },
});

export default CallHistoryScreen;
