// mobile/src/screens/ConversationScreen.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView,
  Platform, Alert, Image, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import Toast from 'react-native-toast-message';
import api from '../config/api';
import useAuthStore from '../store/authStore';
import useSocketStore from '../store/socketStore';
import Avatar from '../components/ui/Avatar';
import PresenceBadge from '../components/ui/PresenceBadge';

// ── Bulle de message ──────────────────────────────────────────────
function MessageBubble({ msg, currentUserId, onReply, onDelete }) {
  const isOwn = msg.sender_id === currentUserId;
  const [showActions, setShowActions] = useState(false);

  const renderContent = () => {
    if (msg.is_deleted) {
      return (
        <Text style={[styles.deletedText, isOwn && styles.deletedTextOwn]}>
          🗑 Message retiré
        </Text>
      );
    }
    switch (msg.type) {
      case 'image':
        return (
          <Image
            source={{ uri: msg.file_url }}
            style={styles.msgImage}
            resizeMode="cover"
          />
        );
      case 'audio':
        return (
          <View style={styles.audioMsg}>
            <Ionicons name="mic" size={16} color={isOwn ? '#fff' : '#16a34a'} />
            <Text style={[styles.audioText, isOwn && styles.audioTextOwn]}>
              Message vocal
            </Text>
          </View>
        );
      case 'file':
        return (
          <View style={styles.fileMsg}>
            <Ionicons name="document-attach" size={20} color={isOwn ? '#fff' : '#16a34a'} />
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={[styles.fileName, isOwn && styles.fileNameOwn]} numberOfLines={1}>
                {msg.file_name || 'Fichier'}
              </Text>
              {msg.file_size && (
                <Text style={[styles.fileSize, isOwn && styles.fileSizeOwn]}>
                  {(msg.file_size / 1024).toFixed(0)} Ko
                </Text>
              )}
            </View>
            <Ionicons name="download-outline" size={18} color={isOwn ? 'rgba(255,255,255,0.7)' : '#94a3b8'} />
          </View>
        );
      case 'system':
        return (
          <View style={styles.systemMsg}>
            <Text style={styles.systemText}>{msg.content}</Text>
          </View>
        );
      default:
        return (
          <Text style={[styles.msgText, isOwn && styles.msgTextOwn]}>
            {msg.content}
          </Text>
        );
    }
  };

  if (msg.type === 'system') {
    return (
      <View style={styles.systemWrap}>
        <Text style={styles.systemText}>{msg.content}</Text>
      </View>
    );
  }

  return (
    <Pressable
      onLongPress={() => setShowActions(!showActions)}
      style={[styles.bubbleWrap, isOwn ? styles.bubbleWrapOwn : styles.bubbleWrapOther]}
    >
      {/* Avatar côté gauche */}
      {!isOwn && (
        <View style={{ marginRight: 8, alignSelf: 'flex-end' }}>
          <Avatar user={msg.sender} size="sm" />
        </View>
      )}

      <View style={[styles.bubbleCol, isOwn && { alignItems: 'flex-end' }]}>
        {/* Nom expéditeur */}
        {!isOwn && (
          <Text style={styles.senderName}>{msg.sender?.display_name}</Text>
        )}

        {/* Réponse à */}
        {msg.replyTo && !msg.replyTo.is_deleted && (
          <View style={[styles.replyPreview, isOwn && styles.replyPreviewOwn]}>
            <Text style={styles.replyName}>{msg.replyTo.sender?.display_name}</Text>
            <Text style={styles.replyContent} numberOfLines={1}>
              {msg.replyTo.type !== 'text' ? '📎 Fichier' : msg.replyTo.content}
            </Text>
          </View>
        )}

        {/* Bulle */}
        <View style={[styles.bubble, isOwn ? styles.bubbleOwn : styles.bubbleOther]}>
          {renderContent()}
        </View>

        {/* Heure + édité */}
        <View style={styles.timeRow}>
          <Text style={styles.msgTime}>{format(new Date(msg.created_at), 'HH:mm')}</Text>
          {msg.is_edited && !msg.is_deleted && (
            <Text style={styles.editedLabel}> · modifié</Text>
          )}
        </View>

        {/* Actions rapides */}
        {showActions && !msg.is_deleted && (
          <View style={[styles.actions, isOwn && { right: 0, left: undefined }]}>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => { onReply(msg); setShowActions(false); }}
            >
              <Ionicons name="arrow-undo" size={14} color="#64748b" />
              <Text style={styles.actionText}>Répondre</Text>
            </TouchableOpacity>
            {isOwn && (
              <TouchableOpacity
                style={[styles.actionBtn, { borderLeftWidth: 1, borderLeftColor: '#f1f5f9' }]}
                onPress={() => { onDelete(msg); setShowActions(false); }}
              >
                <Ionicons name="trash-outline" size={14} color="#ef4444" />
                <Text style={[styles.actionText, { color: '#ef4444' }]}>Retirer</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </Pressable>
  );
}

// ── Bannière réponse ──────────────────────────────────────────────
function ReplyBanner({ msg, onClose }) {
  return (
    <View style={styles.replyBanner}>
      <Ionicons name="return-up-forward" size={16} color="#16a34a" />
      <View style={styles.replyBannerContent}>
        <Text style={styles.replyBannerName}>{msg.sender?.display_name}</Text>
        <Text style={styles.replyBannerText} numberOfLines={1}>
          {msg.type !== 'text' ? '📎 Fichier' : msg.content}
        </Text>
      </View>
      <TouchableOpacity onPress={onClose}>
        <Ionicons name="close" size={20} color="#94a3b8" />
      </TouchableOpacity>
    </View>
  );
}

// ── Page principale ───────────────────────────────────────────────
export default function ConversationScreen({ route, navigation }) {
  const { conversationId } = route.params;
  const { user } = useAuthStore();
  const { socket, emit } = useSocketStore();
  const qc = useQueryClient();

  const [message, setMessage] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [isTyping, setIsTyping] = useState({});
  const flatListRef = useRef(null);
  const typingTimer = useRef(null);

  // ── Requêtes ────────────────────────────────────────────────────
  const { data: convsData } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => api.get('/conversations').then((r) => r.data.data.conversations),
  });
  const activeConv = (convsData || []).find((c) => c.id === conversationId);

  const { data: msgsData, isLoading } = useQuery({
    queryKey: ['messages', conversationId],
    queryFn: () =>
      api.get(`/conversations/${conversationId}/messages?limit=50`)
        .then((r) => r.data.data.messages),
    enabled: !!conversationId,
  });
  const messages = msgsData || [];

  // ── Mutations ───────────────────────────────────────────────────
  const sendMutation = useMutation({
    mutationFn: (data) =>
      api.post(`/conversations/${conversationId}/messages`, data, {
        headers: data instanceof FormData ? { 'Content-Type': 'multipart/form-data' } : {},
      }),
    onSuccess: () => {
      qc.invalidateQueries(['messages', conversationId]);
      qc.invalidateQueries(['conversations']);
      setMessage('');
      setReplyTo(null);
    },
    onError: (err) => Toast.show({ type: 'error', text1: err.response?.data?.message || 'Erreur envoi' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (msgId) =>
      api.delete(`/conversations/${conversationId}/messages/${msgId}`),
    onSuccess: () => {
      qc.invalidateQueries(['messages', conversationId]);
      Toast.show({ type: 'success', text1: 'Message retiré' });
    },
  });

  // ── Socket ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket || !conversationId) return;

    const onNew = (data) => {
      if (data.message.conversation_id === conversationId) {
        qc.invalidateQueries(['messages', conversationId]);
        api.post(`/conversations/${conversationId}/read`).catch(() => {});
      }
      qc.invalidateQueries(['conversations']);
    };
    const onEdited  = () => qc.invalidateQueries(['messages', conversationId]);
    const onDeleted = () => qc.invalidateQueries(['messages', conversationId]);
    const onTyping  = ({ userId: uid, isTyping: t }) => {
      if (uid !== user.id) {
        setIsTyping((p) => ({ ...p, [uid]: t }));
        if (t) setTimeout(() => setIsTyping((p) => ({ ...p, [uid]: false })), 4000);
      }
    };

    socket.on('message:new',     onNew);
    socket.on('message:edited',  onEdited);
    socket.on('message:deleted', onDeleted);
    socket.on('message:typing',  onTyping);
    socket.emit('conversation:join', conversationId);

    return () => {
      socket.off('message:new',     onNew);
      socket.off('message:edited',  onEdited);
      socket.off('message:deleted', onDeleted);
      socket.off('message:typing',  onTyping);
    };
  }, [socket, conversationId]);

  // Marquer comme lu à l'ouverture
  useEffect(() => {
    api.post(`/conversations/${conversationId}/read`).catch(() => {});
  }, [conversationId]);

  // ── Handlers ────────────────────────────────────────────────────
  const handleSend = useCallback(() => {
    const content = message.trim();
    if (!content) return;
    sendMutation.mutate({
      content,
      type: 'text',
      ...(replyTo ? { reply_to_id: replyTo.id } : {}),
    });
    emit('message:typing', { conversationId, isTyping: false });
  }, [message, replyTo]);

  const handleTyping = () => {
    emit('message:typing', { conversationId, isTyping: true });
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(
      () => emit('message:typing', { conversationId, isTyping: false }),
      2000
    );
  };

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const fd = new FormData();
      fd.append('file', {
        uri: asset.uri,
        name: asset.fileName || `image_${Date.now()}.jpg`,
        type: asset.mimeType || 'image/jpeg',
      });
      if (replyTo) fd.append('reply_to_id', replyTo.id);
      sendMutation.mutate(fd);
    }
  };

  const handlePickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const fd = new FormData();
      fd.append('file', { uri: asset.uri, name: asset.name, type: asset.mimeType || 'application/octet-stream' });
      if (replyTo) fd.append('reply_to_id', replyTo.id);
      sendMutation.mutate(fd);
    }
  };

  const handleDelete = (msg) => {
    Alert.alert(
      'Retirer le message',
      'Ce message sera retiré pour tout le monde.',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Retirer', style: 'destructive', onPress: () => deleteMutation.mutate(msg.id) },
      ]
    );
  };

  const handleCall = (type) => {
    const other = activeConv?.members?.find((m) => m.id !== user.id);
    if (!other) return;
    emit('call:initiate', { calleeId: other.id, type });
    // Mettre à jour le store appel sortant
    import('../store/callStore').then(({ default: useCallStore }) => {
      useCallStore.getState().setOutgoingCall({
        calleeId: other.id,
        calleeName: other.display_name,
        calleeInitial: other.display_name?.charAt(0)?.toUpperCase(),
        type,
        callId: null,
      });
    });
  };

  // Infos de la conv
  const otherMember = activeConv?.type === 'direct'
    ? activeConv.members?.find((m) => m.id !== user.id)
    : null;
  const convName = otherMember?.display_name || activeConv?.name || '…';
  const typingUsers = activeConv?.members?.filter(
    (m) => m.id !== user.id && isTyping[m.id]
  ) || [];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color="#16a34a" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.headerCenter} activeOpacity={0.7}>
          <View style={{ position: 'relative' }}>
            {otherMember
              ? <><Avatar user={otherMember} size="sm" /><PresenceBadge status={otherMember.presence_status} /></>
              : (
                <View style={styles.groupAvatarSm}>
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>
                    {convName?.charAt(0)?.toUpperCase()}
                  </Text>
                </View>
              )
            }
          </View>
          <View style={{ marginLeft: 10 }}>
            <Text style={styles.headerName}>{convName}</Text>
            <Text style={styles.headerStatus}>
              {otherMember
                ? otherMember.presence_status === 'online' ? '● En ligne'
                  : otherMember.presence_status === 'away' ? '● Absent'
                  : '● Hors ligne'
                : `${activeConv?.members?.length || 0} membres`
              }
            </Text>
          </View>
        </TouchableOpacity>

        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => handleCall('audio')} style={styles.headerBtn}>
            <Ionicons name="call-outline" size={22} color="#16a34a" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleCall('video')} style={styles.headerBtn}>
            <Ionicons name="videocam-outline" size={22} color="#16a34a" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Messages */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#16a34a" />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={[...messages].reverse()}
            keyExtractor={(m) => m.id}
            inverted
            renderItem={({ item }) => (
              <MessageBubble
                msg={item}
                currentUserId={user.id}
                onReply={setReplyTo}
                onDelete={handleDelete}
              />
            )}
            contentContainerStyle={styles.msgList}
            ListHeaderComponent={
              typingUsers.length > 0 ? (
                <View style={styles.typingWrap}>
                  <View style={styles.typingDots}>
                    {[0, 1, 2].map((i) => (
                      <View key={i} style={styles.typingDot} />
                    ))}
                  </View>
                  <Text style={styles.typingText}>{typingUsers[0]?.display_name} écrit…</Text>
                </View>
              ) : null
            }
          />
        )}

        {/* Zone de saisie */}
        <View style={styles.inputArea}>
          {/* Bannière réponse */}
          {replyTo && <ReplyBanner msg={replyTo} onClose={() => setReplyTo(null)} />}

          <View style={styles.inputRow}>
            {/* Bouton fichier */}
            <TouchableOpacity style={styles.attachBtn} onPress={handlePickFile}>
              <Ionicons name="attach" size={22} color="#64748b" />
            </TouchableOpacity>

            {/* Bouton image */}
            <TouchableOpacity style={styles.attachBtn} onPress={handlePickImage}>
              <Ionicons name="image-outline" size={22} color="#64748b" />
            </TouchableOpacity>

            {/* Champ texte */}
            <TextInput
              style={styles.textInput}
              placeholder="Message…"
              placeholderTextColor="#94a3b8"
              value={message}
              onChangeText={(v) => { setMessage(v); handleTyping(); }}
              multiline
              maxLength={2000}
              returnKeyType="default"
            />

            {/* Bouton envoyer */}
            <TouchableOpacity
              style={[styles.sendBtn, !message.trim() && styles.sendBtnDisabled]}
              onPress={handleSend}
              disabled={!message.trim() || sendMutation.isPending}
            >
              {sendMutation.isPending
                ? <ActivityIndicator size="small" color="#fff" />
                : <Ionicons name="send" size={18} color="#fff" />
              }
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fff' },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
    backgroundColor: '#fff',
  },
  backBtn: { padding: 4, marginRight: 4 },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  groupAvatarSm: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: '#16a34a', justifyContent: 'center', alignItems: 'center',
  },
  headerName: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  headerStatus: { fontSize: 11, color: '#94a3b8', marginTop: 1 },
  headerActions: { flexDirection: 'row', gap: 4 },
  headerBtn: { padding: 8 },

  // Messages
  msgList: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 8 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  bubbleWrap: { flexDirection: 'row', marginVertical: 3, paddingHorizontal: 4 },
  bubbleWrapOwn: { justifyContent: 'flex-end' },
  bubbleWrapOther: { justifyContent: 'flex-start' },
  bubbleCol: { maxWidth: '78%' },

  senderName: { fontSize: 11, fontWeight: '600', color: '#64748b', marginBottom: 2, marginLeft: 4 },

  bubble: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9 },
  bubbleOwn: { backgroundColor: '#16a34a', borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: '#f1f5f9', borderBottomLeftRadius: 4 },

  msgText: { fontSize: 15, color: '#1e293b', lineHeight: 22 },
  msgTextOwn: { color: '#fff' },

  deletedText: { fontSize: 14, color: '#94a3b8', fontStyle: 'italic' },
  deletedTextOwn: { color: 'rgba(255,255,255,0.6)' },

  msgImage: { width: 200, height: 150, borderRadius: 12 },

  audioMsg: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 2 },
  audioText: { fontSize: 14, color: '#475569' },
  audioTextOwn: { color: '#fff' },

  fileMsg: { flexDirection: 'row', alignItems: 'center', minWidth: 160, maxWidth: 220 },
  fileName: { fontSize: 13, fontWeight: '600', color: '#1e293b' },
  fileNameOwn: { color: '#fff' },
  fileSize: { fontSize: 11, color: '#94a3b8', marginTop: 1 },
  fileSizeOwn: { color: 'rgba(255,255,255,0.7)' },

  systemWrap: { alignItems: 'center', marginVertical: 8 },
  systemText: { fontSize: 12, color: '#94a3b8', fontStyle: 'italic', textAlign: 'center' },
  systemMsg: {},

  timeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3, paddingHorizontal: 4 },
  msgTime: { fontSize: 10, color: '#94a3b8' },
  editedLabel: { fontSize: 10, color: '#94a3b8', fontStyle: 'italic' },

  // Réponse dans bulle
  replyPreview: {
    backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: 10,
    padding: 8, marginBottom: 4, borderLeftWidth: 3, borderLeftColor: '#16a34a',
  },
  replyPreviewOwn: { backgroundColor: 'rgba(255,255,255,0.2)', borderLeftColor: 'rgba(255,255,255,0.7)' },
  replyName: { fontSize: 11, fontWeight: '700', color: '#16a34a', marginBottom: 2 },
  replyContent: { fontSize: 12, color: '#64748b' },

  // Actions longpress
  actions: {
    position: 'absolute', bottom: -36, left: 0,
    flexDirection: 'row', backgroundColor: '#fff',
    borderRadius: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12, shadowRadius: 6, elevation: 4, zIndex: 10,
  },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8 },
  actionText: { fontSize: 12, color: '#64748b', fontWeight: '600' },

  // Typing
  typingWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingBottom: 8 },
  typingDots: { flexDirection: 'row', gap: 3 },
  typingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#94a3b8' },
  typingText: { fontSize: 12, color: '#94a3b8', fontStyle: 'italic' },

  // Zone de saisie
  inputArea: { borderTopWidth: 1, borderTopColor: '#f1f5f9', backgroundColor: '#fff' },
  replyBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: '#f0fdf4', borderTopWidth: 1, borderTopColor: '#dcfce7',
  },
  replyBannerContent: { flex: 1 },
  replyBannerName: { fontSize: 12, fontWeight: '700', color: '#16a34a' },
  replyBannerText: { fontSize: 12, color: '#64748b' },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 8, paddingVertical: 8, gap: 6 },
  attachBtn: { padding: 6, alignSelf: 'flex-end', marginBottom: 2 },
  textInput: {
    flex: 1, backgroundColor: '#f8fafc',
    borderWidth: 1, borderColor: '#e2e8f0',
    borderRadius: 22, paddingHorizontal: 16,
    paddingTop: 10, paddingBottom: 10,
    fontSize: 15, color: '#1e293b',
    maxHeight: 120, minHeight: 42,
  },
  sendBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: '#16a34a',
    justifyContent: 'center', alignItems: 'center',
    alignSelf: 'flex-end',
    shadowColor: '#16a34a', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3, shadowRadius: 4, elevation: 3,
  },
  sendBtnDisabled: { backgroundColor: '#cbd5e1', shadowOpacity: 0 },
});