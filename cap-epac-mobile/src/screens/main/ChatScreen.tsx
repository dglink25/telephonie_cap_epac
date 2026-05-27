// src/screens/main/ChatScreen.tsx
import React, {
  useState, useEffect, useRef, useCallback,
  useMemo,
} from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
  Modal, Pressable,
} from 'react-native';
import { useChatStore, Message } from '../../store/chatStore';
import { useAuthStore } from '../../store/authStore';
import { socketService } from '../../services/socket';
import { conversationsAPI, getMediaUrl } from '../../services/api';
import { Avatar } from '../../components/common';
import { COLORS, SIZES } from '../../utils/constants';
import dayjs from 'dayjs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';

interface Props {
  navigation: NativeStackNavigationProp<any>;
  route: RouteProp<{ Chat: { conversationId: string; name: string; avatar?: string; type: string } }, 'Chat'>;
}

const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

const ChatScreen: React.FC<Props> = ({ navigation, route }) => {
  const { conversationId, name, type } = route.params;
  const { user } = useAuthStore();
  const {
    messages: allMessages, loadMessages, addMessage, markAsRead,
    setTyping, setActiveConversation,
  } = useChatStore();

  const messages = allMessages[conversationId] || [];
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editingMsg, setEditingMsg] = useState<Message | null>(null);
  const [contextMenu, setContextMenu] = useState<{ msg: Message; x: number; y: number } | null>(null);
  const [emojiMenu, setEmojiMenu] = useState<{ msgId: string } | null>(null);

  const flatListRef = useRef<FlatList>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    setActiveConversation(conversationId);
    socketService.joinConversation(conversationId);
    loadMessages(conversationId).then((more) => setHasMore(!!more));
    markAsRead(conversationId);
    return () => {
      socketService.leaveConversation(conversationId);
      setActiveConversation(null);
    };
  }, [conversationId]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 100);
    }
  }, [messages.length]);

  const handleTyping = useCallback(() => {
    socketService.sendTyping(conversationId, true);
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      socketService.sendTyping(conversationId, false);
    }, 2000);
  }, [conversationId]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore || messages.length === 0) return;
    setLoadingMore(true);
    const oldest = messages[0];
    const more = await loadMessages(conversationId, oldest.created_at);
    setHasMore(!!more);
    setLoadingMore(false);
  }, [hasMore, loadingMore, messages, conversationId, loadMessages]);

  const sendMessage = async () => {
    const content = text.trim();
    if (!content || sending) return;

    // Mode édition
    if (editingMsg) {
      try {
        const resp = await conversationsAPI.editMessage(conversationId, editingMsg.id, content);
        useChatStore.getState().updateMessage(resp.data.data.message);
        setEditingMsg(null);
        setText('');
      } catch (e: any) {
        Alert.alert('Erreur', e?.response?.data?.message || 'Impossible de modifier');
      }
      return;
    }

    setSending(true);
    setText('');
    try {
      const body: any = { content, type: 'text' };
      if (replyTo) body.reply_to_id = replyTo.id;
      await conversationsAPI.sendMessage(conversationId, body);
      setReplyTo(null);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 200);
    } catch {
      Alert.alert('Erreur', 'Message non envoyé');
    } finally {
      setSending(false);
    }
  };

  const deleteMessage = async (msg: Message) => {
    Alert.alert(
      'Supprimer le message',
      'Ce message sera supprimé pour tout le monde.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            await conversationsAPI.deleteMessage(conversationId, msg.id);
          },
        },
      ]
    );
  };

  const addReaction = async (msgId: string, emoji: string) => {
    setEmojiMenu(null);
    try {
      await conversationsAPI.addReaction(conversationId, msgId, emoji);
    } catch {}
  };

  const isMyMessage = (msg: Message) => msg.sender_id === user?.id;

  const renderTypingIndicator = () => {
    const { typingUsers } = useChatStore.getState();
    const convTyping = typingUsers.filter(
      (t) => t.conversationId === conversationId && t.userId !== user?.id
    );
    if (!convTyping.length) return null;
    return (
      <View style={styles.typingContainer}>
        <Text style={styles.typingText}>Quelqu'un est en train d'écrire...</Text>
      </View>
    );
  };

  const renderMessage = ({ item: msg }: { item: Message }) => {
    if (msg.is_deleted) {
      return (
        <View style={[styles.msgRow, isMyMessage(msg) && styles.msgRowMe]}>
          <Text style={styles.deletedMsg}>Message supprimé</Text>
        </View>
      );
    }

    if (msg.type === 'system') {
      return (
        <View style={styles.systemMsgRow}>
          <Text style={styles.systemMsg}>{msg.content}</Text>
        </View>
      );
    }

    const isMine = isMyMessage(msg);
    const time = dayjs(msg.created_at).format('HH:mm');

    return (
      <TouchableOpacity
        style={[styles.msgRow, isMine && styles.msgRowMe]}
        onLongPress={(e) => {
          setContextMenu({ msg, x: e.nativeEvent.pageX, y: e.nativeEvent.pageY });
        }}
        activeOpacity={0.9}
        delayLongPress={400}
      >
        {!isMine && type === 'group' && (
          <Avatar
            url={msg.sender?.avatar_url}
            name={msg.sender?.display_name || '?'}
            size={28}
            style={styles.msgAvatar}
          />
        )}
        <View style={[styles.bubble, isMine ? styles.bubbleMe : styles.bubbleThem]}>
          {!isMine && type === 'group' && (
            <Text style={styles.senderName}>{msg.sender?.display_name}</Text>
          )}
          {msg.replyTo && (
            <View style={[styles.replyPreview, isMine && styles.replyPreviewMe]}>
              <Text style={styles.replyName}>{msg.replyTo.sender?.display_name}</Text>
              <Text style={styles.replyContent} numberOfLines={1}>
                {msg.replyTo.content || '📎 Fichier'}
              </Text>
            </View>
          )}

          {msg.type === 'text' && (
            <Text style={[styles.msgText, isMine && styles.msgTextMe]}>{msg.content}</Text>
          )}
          {msg.type === 'image' && (
            <TouchableOpacity>
              <Text style={styles.mediaMsg}>📷 {msg.file_name || 'Image'}</Text>
            </TouchableOpacity>
          )}
          {msg.type === 'file' && (
            <TouchableOpacity>
              <Text style={styles.mediaMsg}>📎 {msg.file_name || 'Fichier'}</Text>
            </TouchableOpacity>
          )}
          {msg.type === 'audio' && (
            <Text style={styles.mediaMsg}>🎵 {msg.file_name || 'Audio'}</Text>
          )}
          {msg.type === 'video' && (
            <Text style={styles.mediaMsg}>🎬 {msg.file_name || 'Vidéo'}</Text>
          )}

          <View style={styles.msgMeta}>
            <Text style={[styles.msgTime, isMine && styles.msgTimMe]}>
              {time}
              {msg.is_edited && ' · modifié'}
            </Text>
          </View>

          {/* Réactions */}
          {msg.reactions && msg.reactions.length > 0 && (
            <View style={styles.reactionsRow}>
              {Object.entries(
                msg.reactions.reduce((acc: Record<string, number>, r) => {
                  acc[r.emoji] = (acc[r.emoji] || 0) + 1;
                  return acc;
                }, {})
              ).map(([emoji, count]) => (
                <TouchableOpacity
                  key={emoji}
                  style={styles.reactionPill}
                  onPress={() => addReaction(msg.id, emoji)}
                >
                  <Text style={styles.reactionEmoji}>{emoji}</Text>
                  <Text style={styles.reactionCount}>{count}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={styles.addReactionBtn}
                onPress={() => setEmojiMenu({ msgId: msg.id })}
              >
                <Text style={styles.addReactionText}>+</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerName} numberOfLines={1}>{name}</Text>
          <Text style={styles.headerType}>
            {type === 'group' ? 'Groupe' : 'Message direct'}
          </Text>
        </View>
        {type === 'group' && (
          <TouchableOpacity
            onPress={() => navigation.navigate('GroupInfo', { groupId: conversationId })}
            style={styles.infoBtn}
          >
            <Text style={styles.infoBtnText}>ⓘ</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Messages */}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messagesList}
          onEndReached={loadMore}
          onEndReachedThreshold={0.1}
          ListHeaderComponent={
            loadingMore ? (
              <ActivityIndicator color={COLORS.primary} style={{ margin: 12 }} />
            ) : null
          }
          ListFooterComponent={renderTypingIndicator()}
          showsVerticalScrollIndicator={false}
        />

        {/* Reply banner */}
        {replyTo && (
          <View style={styles.replyBanner}>
            <View style={styles.replyBannerContent}>
              <Text style={styles.replyBannerLabel}>Répondre à</Text>
              <Text style={styles.replyBannerText} numberOfLines={1}>
                {replyTo.content || 'Fichier'}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setReplyTo(null)}>
              <Text style={styles.replyClose}>✕</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Edit banner */}
        {editingMsg && (
          <View style={[styles.replyBanner, styles.editBanner]}>
            <View style={styles.replyBannerContent}>
              <Text style={styles.editBannerLabel}>Modifier le message</Text>
              <Text style={styles.replyBannerText} numberOfLines={1}>
                {editingMsg.content}
              </Text>
            </View>
            <TouchableOpacity onPress={() => { setEditingMsg(null); setText(''); }}>
              <Text style={styles.replyClose}>✕</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Input bar */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.textInput}
            value={text}
            onChangeText={(v) => { setText(v); handleTyping(); }}
            placeholder="Message..."
            placeholderTextColor={COLORS.gray400}
            multiline
            maxLength={10000}
            returnKeyType="default"
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!text.trim() || sending) && styles.sendBtnDisabled]}
            onPress={sendMessage}
            disabled={!text.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <Text style={styles.sendBtnText}>
                {editingMsg ? '✓' : '↑'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Context Menu */}
      <Modal
        transparent
        visible={!!contextMenu}
        animationType="fade"
        onRequestClose={() => setContextMenu(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setContextMenu(null)}>
          <View style={styles.contextMenu}>
            {contextMenu && (
              <>
                <TouchableOpacity
                  style={styles.contextItem}
                  onPress={() => {
                    setReplyTo(contextMenu.msg);
                    setContextMenu(null);
                  }}
                >
                  <Text style={styles.contextText}>↩ Répondre</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.contextItem}
                  onPress={() => {
                    setEmojiMenu({ msgId: contextMenu.msg.id });
                    setContextMenu(null);
                  }}
                >
                  <Text style={styles.contextText}>😊 Réagir</Text>
                </TouchableOpacity>

                {isMyMessage(contextMenu.msg) && contextMenu.msg.canEdit && (
                  <TouchableOpacity
                    style={styles.contextItem}
                    onPress={() => {
                      setEditingMsg(contextMenu.msg);
                      setText(contextMenu.msg.content || '');
                      setContextMenu(null);
                    }}
                  >
                    <Text style={styles.contextText}>✏️ Modifier</Text>
                  </TouchableOpacity>
                )}

                {(isMyMessage(contextMenu.msg) || user?.role === 'admin') && (
                  <TouchableOpacity
                    style={[styles.contextItem, styles.contextDanger]}
                    onPress={() => {
                      deleteMessage(contextMenu.msg);
                      setContextMenu(null);
                    }}
                  >
                    <Text style={[styles.contextText, styles.contextDangerText]}>
                      🗑 Supprimer
                    </Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        </Pressable>
      </Modal>

      {/* Emoji Picker */}
      <Modal
        transparent
        visible={!!emojiMenu}
        animationType="slide"
        onRequestClose={() => setEmojiMenu(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setEmojiMenu(null)}>
          <View style={styles.emojiPanel}>
            <Text style={styles.emojiTitle}>Réagir</Text>
            <View style={styles.emojiRow}>
              {EMOJIS.map((emoji) => (
                <TouchableOpacity
                  key={emoji}
                  style={styles.emojiBtn}
                  onPress={() => emojiMenu && addReaction(emojiMenu.msgId, emoji)}
                >
                  <Text style={styles.emojiText}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.gray50 },
  flex: { flex: 1 },
  header: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 48,
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  backBtn: { marginRight: 12, padding: 4 },
  backText: { color: COLORS.white, fontSize: 22 },
  headerInfo: { flex: 1 },
  headerName: { color: COLORS.white, fontSize: SIZES.lg, fontWeight: '700' },
  headerType: { color: 'rgba(255,255,255,0.7)', fontSize: SIZES.xs, marginTop: 1 },
  infoBtn: { padding: 4 },
  infoBtnText: { color: COLORS.white, fontSize: 20 },
  messagesList: { padding: 12, paddingBottom: 8 },
  msgRow: {
    flexDirection: 'row',
    marginVertical: 3,
    alignItems: 'flex-end',
  },
  msgRowMe: { flexDirection: 'row-reverse' },
  msgAvatar: { marginRight: 8, marginBottom: 4 },
  bubble: {
    maxWidth: '78%',
    borderRadius: SIZES.radiusLg,
    paddingHorizontal: 14,
    paddingVertical: 8,
    paddingBottom: 6,
  },
  bubbleThem: {
    backgroundColor: COLORS.white,
    borderBottomLeftRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  bubbleMe: {
    backgroundColor: COLORS.primary,
    borderBottomRightRadius: 4,
  },
  senderName: {
    fontSize: SIZES.xs,
    fontWeight: '600',
    color: COLORS.primary,
    marginBottom: 3,
  },
  msgText: { fontSize: SIZES.md, color: COLORS.gray900, lineHeight: 22 },
  msgTextMe: { color: COLORS.white },
  mediaMsg: { fontSize: SIZES.md, color: COLORS.primary },
  msgMeta: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 3 },
  msgTime: { fontSize: 10, color: COLORS.gray400 },
  msgTimMe: { color: 'rgba(255,255,255,0.65)' },
  deletedMsg: { fontSize: SIZES.sm, color: COLORS.gray400, fontStyle: 'italic', padding: 4 },
  systemMsgRow: { alignItems: 'center', marginVertical: 8 },
  systemMsg: {
    backgroundColor: COLORS.gray200,
    color: COLORS.gray600,
    fontSize: SIZES.xs,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: SIZES.radiusFull,
  },
  replyPreview: {
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primaryLight,
    paddingLeft: 8,
    marginBottom: 6,
    opacity: 0.85,
  },
  replyPreviewMe: { borderLeftColor: 'rgba(255,255,255,0.5)' },
  replyName: { fontSize: SIZES.xs, fontWeight: '600', color: COLORS.primaryLight },
  replyContent: { fontSize: SIZES.xs, color: COLORS.gray500 },
  reactionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 6,
    gap: 4,
  },
  reactionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primaryXLight,
    borderRadius: SIZES.radiusFull,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  reactionEmoji: { fontSize: 14 },
  reactionCount: {
    fontSize: SIZES.xs,
    color: COLORS.primaryDark,
    fontWeight: '600',
    marginLeft: 3,
  },
  addReactionBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: COLORS.gray200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addReactionText: { fontSize: 16, color: COLORS.gray600, lineHeight: 20 },
  typingContainer: { paddingHorizontal: 16, paddingVertical: 6 },
  typingText: { fontSize: SIZES.xs, color: COLORS.gray400, fontStyle: 'italic' },
  replyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primaryXXLight,
    borderTopWidth: 1,
    borderTopColor: COLORS.primaryXLight,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  editBanner: { backgroundColor: COLORS.warningLight },
  replyBannerContent: { flex: 1 },
  replyBannerLabel: {
    fontSize: SIZES.xs,
    fontWeight: '600',
    color: COLORS.primary,
    marginBottom: 2,
  },
  editBannerLabel: { color: COLORS.warning },
  replyBannerText: { fontSize: SIZES.sm, color: COLORS.gray600 },
  replyClose: { fontSize: 16, color: COLORS.gray500, padding: 4 },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray200,
    padding: 10,
    paddingHorizontal: 14,
  },
  textInput: {
    flex: 1,
    backgroundColor: COLORS.gray100,
    borderRadius: SIZES.radiusLg,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: SIZES.md,
    color: COLORS.gray900,
    maxHeight: 120,
    marginRight: 10,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.5 },
  sendBtnText: { color: COLORS.white, fontSize: 18, fontWeight: '700' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  contextMenu: {
    backgroundColor: COLORS.white,
    borderRadius: SIZES.radiusLg,
    padding: 8,
    minWidth: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  contextItem: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: SIZES.radiusMd,
  },
  contextDanger: { backgroundColor: COLORS.dangerLight },
  contextText: { fontSize: SIZES.md, color: COLORS.gray800 },
  contextDangerText: { color: COLORS.danger },
  emojiPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },
  emojiTitle: {
    fontSize: SIZES.lg,
    fontWeight: '600',
    color: COLORS.gray800,
    marginBottom: 16,
    textAlign: 'center',
  },
  emojiRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  emojiBtn: {
    padding: 10,
  },
  emojiText: { fontSize: 32 },
});

export default ChatScreen;
