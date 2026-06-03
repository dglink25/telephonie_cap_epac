// src/screens/main/ConversationsScreen.tsx
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, RefreshControl, StatusBar,
} from 'react-native';
import { useChatStore, Conversation } from '../../store/chatStore';
import { useAuthStore } from '../../store/authStore';
import { Avatar, Badge, EmptyState } from '../../components/common';
import { COLORS, SIZES } from '../../utils/constants';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/fr';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { socketService } from '../../services/socket';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

dayjs.extend(relativeTime);
dayjs.locale('fr');

interface Props {
  navigation: NativeStackNavigationProp<any>;
}

const ConversationsScreen: React.FC<Props> = ({ navigation }) => {
  const { conversations, loadConversations, isLoadingConversations } = useChatStore();
  const { user } = useAuthStore();
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadConversations();
  }, []);

  // ✅ Recharger les conversations si le socket se reconnecte pendant qu'on est sur cet écran
  useEffect(() => {
    const unsub = socketService.on('socket:connected', () => {
      loadConversations().catch(() => {});
    });
    return () => unsub();
  }, [loadConversations]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadConversations();
    setRefreshing(false);
  }, [loadConversations]);

  const getConvName = (conv: Conversation): string => {
    if (conv.type === 'group') return conv.name || 'Groupe';
    const other = conv.members?.find((m) => m.id !== user?.id);
    return other?.display_name || 'Conversation';
  };

  const getConvAvatar = (conv: Conversation) => {
    if (conv.type === 'group') return conv.avatar_url;
    const other = conv.members?.find((m) => m.id !== user?.id);
    return other?.avatar_url || null;
  };

  const getPresenceStatus = (conv: Conversation): string | undefined => {
    if (conv.type !== 'direct') return undefined;
    const other = conv.members?.find((m) => m.id !== user?.id);
    return other?.presence_status;
  };

  const formatTime = (dateStr: string | null): string => {
    if (!dateStr) return '';
    const d = dayjs(dateStr);
    const now = dayjs();
    if (d.isSame(now, 'day')) return d.format('HH:mm');
    if (d.isSame(now.subtract(1, 'day'), 'day')) return 'Hier';
    return d.format('DD/MM');
  };

  const formatLastMessage = (msg: Conversation['lastMessage']): string => {
    if (!msg) return 'Aucun message';
    if (msg.is_deleted) return 'Message supprimé';
    if (msg.type === 'image') return 'Image';
    if (msg.type === 'file') return 'Fichier';
    if (msg.type === 'audio') return 'Audio';
    if (msg.type === 'video') return 'Vidéo';
    if (msg.type === 'system') return msg.content || '';
    return msg.content || '';
  };

  const filtered = conversations.filter((c) => {
    const name = getConvName(c).toLowerCase();
    return name.includes(search.toLowerCase());
  });

  const renderItem = ({ item }: { item: Conversation }) => {
    const name = getConvName(item);
    const avatar = getConvAvatar(item);
    const presence = getPresenceStatus(item);
    const lastMsg = formatLastMessage(item.lastMessage);
    const time = formatTime(item.lastMessage?.created_at || item.updated_at);
    const hasUnread = item.unreadCount > 0;

    return (
      <TouchableOpacity
        style={styles.convItem}
        onPress={() =>
          navigation.navigate('Chat', {
            conversationId: item.id,
            name,
            avatar,
            type: item.type,
          })
        }
        activeOpacity={0.7}
      >
        <View style={styles.avatarWrap}>
          <Avatar
            url={avatar}
            name={name}
            size={50}
            presenceStatus={presence}
          />
        </View>
        <View style={styles.convContent}>
          <View style={styles.convHeader}>
            <Text
              style={[styles.convName, hasUnread && styles.convNameBold]}
              numberOfLines={1}
            >
              {item.is_general && <Icon name="earth" size={14} color={COLORS.primary} />}{' '}{name}
            </Text>
            <Text style={[styles.convTime, hasUnread && styles.convTimeBold]}>
              {time}
            </Text>
          </View>
          <View style={styles.convFooter}>
            <Text
              style={[styles.lastMsg, hasUnread && styles.lastMsgBold]}
              numberOfLines={1}
            >
              {lastMsg}
            </Text>
            <Badge count={item.unreadCount} />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Messages</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('NewConversation')}
          style={styles.newBtn}
        >
          <Icon name="plus" size={24} color={COLORS.white} />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchBar}>
        <Icon name="magnify" size={20} color={COLORS.gray400} style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Rechercher une conversation..."
          placeholderTextColor={COLORS.gray400}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Icon name="close" size={20} color={COLORS.gray400} />
          </TouchableOpacity>
        )}
      </View>

      {/* Liste */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.primary]}
          />
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          isLoadingConversations ? null : (
            <EmptyState
              title={search ? 'Aucun résultat' : 'Aucune conversation'}
              subtitle={
                search
                  ? `Aucune conversation ne correspond à "${search}"`
                  : 'Commencez une nouvelle conversation'
              }
              action={
                !search
                  ? {
                      label: '+ Nouvelle conversation',
                      onPress: () => navigation.navigate('NewConversation'),
                    }
                  : undefined
              }
            />
          )
        }
        contentContainerStyle={filtered.length === 0 ? { flex: 1 } : undefined}
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
  headerTitle: {
    fontSize: SIZES.xl,
    fontWeight: '700',
    color: COLORS.white,
  },
  newBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  newBtnText: { fontSize: 22, color: COLORS.white, lineHeight: 30 },
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
  searchInput: {
    flex: 1,
    fontSize: SIZES.md,
    color: COLORS.gray900,
  },
  clearSearch: { color: COLORS.gray400, fontSize: 14, padding: 4 },
  convItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  avatarWrap: { marginRight: 14 },
  convContent: { flex: 1 },
  convHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 3,
  },
  convName: {
    fontSize: SIZES.md,
    color: COLORS.gray800,
    flex: 1,
    marginRight: 8,
  },
  convNameBold: { fontWeight: '700', color: COLORS.gray900 },
  convTime: { fontSize: SIZES.xs, color: COLORS.gray400 },
  convTimeBold: { color: COLORS.primary, fontWeight: '600' },
  convFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  lastMsg: {
    fontSize: SIZES.sm,
    color: COLORS.gray500,
    flex: 1,
    marginRight: 8,
  },
  lastMsgBold: { color: COLORS.gray700, fontWeight: '500' },
  separator: { height: 1, backgroundColor: COLORS.gray100, marginLeft: 80 },
});

export default ConversationsScreen;
