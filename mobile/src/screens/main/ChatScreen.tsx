// src/screens/main/ChatScreen.tsx
import React, {
  useState, useEffect, useRef, useCallback,
} from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
  Modal, Pressable, Animated,
} from 'react-native';
import FastImage from 'react-native-fast-image';
import ImageView from 'react-native-image-viewing';
import Video from 'react-native-video';
import { CachedImage } from '../../components/CachedImage';
import { ImageViewer, VideoPlayer } from '../../components/MediaViewers';
import { useChatStore, Message } from '../../store/chatStore';
import { useAuthStore } from '../../store/authStore';
import { socketService } from '../../services/socket';
import { conversationsAPI, getMediaUrl } from '../../services/api';
import { Avatar } from '../../components/common';
import { COLORS, SIZES } from '../../utils/constants';
import dayjs from 'dayjs';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { launchImageLibrary } from 'react-native-image-picker';
import DocumentPicker from 'react-native-document-picker';
import { showMessage } from 'react-native-flash-message';
import { request, PERMISSIONS, RESULTS } from 'react-native-permissions';
import { audioRecorderService } from '../../services/audioRecorder';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { downloadAndOpenFile } from '../../utils/fileDownload';

interface Props {
  navigation: NativeStackNavigationProp<any>;
  route: RouteProp<{ Chat: { conversationId: string; name: string; avatar?: string; type: string } }, 'Chat'>;
}

const REACTIONS = [
  { emoji: '👍', icon: 'thumb-up',        label: 'J\'approuve'    },
  { emoji: '❤️', icon: 'heart',           label: 'J\'aime'        },
  { emoji: '😂', icon: 'emoticon-lol',    label: 'Drôle'          },
  { emoji: '😮', icon: 'emoticon-excited',label: 'Surpris'        },
  { emoji: '😢', icon: 'emoticon-sad',    label: 'Triste'         },
  { emoji: '🙏', icon: 'hand-okay',       label: 'Merci'          },
];

// ✅ Composant animation point clignotant pour "est en train d'écrire"
const TypingDot: React.FC<{ delay: number }> = ({ delay }) => {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.delay(600),
      ])
    ).start();
    return () => anim.stopAnimation();
  }, []);

  return (
    <Animated.View
      style={[
        styles.typingDot,
        {
          transform: [{
            translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }),
          }],
          opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }),
        },
      ]}
    />
  );
};

const ChatScreen: React.FC<Props> = ({ navigation, route }) => {
  const { conversationId, name, type } = route.params;
  const { user } = useAuthStore();
  const {
    messages: allMessages, loadMessages, addMessage, updateMessage,
    deleteMessage: deleteMessageFromStore, markAsRead,
    setTyping, setActiveConversation, typingUsers,
  } = useChatStore();

  const messages = allMessages[conversationId] || [];

  // ✅ Extraire les typingUsers de façon réactive depuis le store
  const convTypingUsers = typingUsers.filter(
    (t) => t.conversationId === conversationId && t.userId !== user?.id
  );
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [imageViewerIndex, setImageViewerIndex] = useState(0);
  const [videoPlayerVisible, setVideoPlayerVisible] = useState(false);
  const [currentVideoUrl, setCurrentVideoUrl] = useState('');
  const [downloadProgress, setDownloadProgress] = useState<Record<string, number>>({});
  const [editingMsg, setEditingMsg] = useState<Message | null>(null);
  const [contextMenu, setContextMenu] = useState<{ msg: Message; x: number; y: number } | null>(null);
  const [emojiMenu, setEmojiMenu] = useState<{ msgId: string } | null>(null);
  const [attachmentMenu, setAttachmentMenu] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [recordingAudio, setRecordingAudio] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const [audioDuration, setAudioDuration] = useState<Record<string, number>>({});
  const recordAnim = useRef(new Animated.Value(0)).current;

  const flatListRef = useRef<FlatList>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    setActiveConversation(conversationId);
    socketService.joinConversation(conversationId);
    loadMessages(conversationId).then((more) => setHasMore(!!more));
    markAsRead(conversationId);

    // ✅ Écouter les événements socket directement dans ce screen
    // pour un rechargement instantané comme sur le web
    const unsubNewMsg = socketService.on('message:new', (data: unknown) => {
      const { message } = data as { message: Message };
      if (message.conversation_id === conversationId) {
        addMessage(message);
        markAsRead(conversationId);
        // Scroll immédiat au nouveau message
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);
      }
    });

    const unsubEdited = socketService.on('message:edited', (data: unknown) => {
      const { message } = data as { message: Message };
      if (message.conversation_id === conversationId) {
        updateMessage(message);
      }
    });

    const unsubDeleted = socketService.on('message:deleted', (data: unknown) => {
      const { messageId, conversationId: convId } = data as { messageId: string; conversationId: string };
      if (convId === conversationId) {
        deleteMessageFromStore(conversationId, messageId);
      }
    });

    // ✅ Typing : écouter directement dans ce screen pour réactivité maximale
    const unsubTyping = socketService.on('message:typing', (data: unknown) => {
      const { userId: typingUserId, conversationId: convId, isTyping: isTypingBool } = data as {
        userId: string; conversationId: string; isTyping: boolean;
      };
      if (convId === conversationId && typingUserId !== user?.id) {
        setTyping(typingUserId, conversationId, isTypingBool);
      }
    });

    // ✅ Si le socket se reconnecte, rejoindre à nouveau et recharger
    const unsubReconnect = socketService.on('socket:connected', () => {
      socketService.joinConversation(conversationId);
      loadMessages(conversationId).then((more) => setHasMore(!!more));
      markAsRead(conversationId);
    });

    return () => {
      unsubNewMsg();
      unsubEdited();
      unsubDeleted();
      unsubTyping();
      unsubReconnect();
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

  const requestStoragePermission = async (): Promise<boolean> => {
    try {
      if (Platform.OS === 'ios') {
        const result = await request(PERMISSIONS.IOS.PHOTO_LIBRARY);
        return result === RESULTS.GRANTED || result === RESULTS.LIMITED;
      } else {
        // Android 13+ (API 33+) utilise READ_MEDIA_IMAGES et READ_MEDIA_VIDEO
        const androidVersion = Platform.Version;
        
        if (androidVersion >= 33) {
          const imageResult = await request(PERMISSIONS.ANDROID.READ_MEDIA_IMAGES);
          const videoResult = await request(PERMISSIONS.ANDROID.READ_MEDIA_VIDEO);
          return (
            imageResult === RESULTS.GRANTED || 
            videoResult === RESULTS.GRANTED
          );
        } else {
          const result = await request(PERMISSIONS.ANDROID.READ_EXTERNAL_STORAGE);
          return result === RESULTS.GRANTED;
        }
      }
    } catch (err) {
      console.warn('Permission error:', err);
      return false;
    }
  };

  const handleImagePicker = async () => {
    setAttachmentMenu(false);
    
    const hasPermission = await requestStoragePermission();
    if (!hasPermission) {
      Alert.alert('Permission refusée', 'Accès à la galerie photo nécessaire');
      return;
    }

    try {
      const result = await launchImageLibrary({
        mediaType: 'mixed', // photos + vidéos
        selectionLimit: 1,
        quality: 0.8,
      });

      if (result.didCancel) return;
      if (result.errorCode) {
        throw new Error(result.errorMessage || 'Erreur sélection');
      }

      const asset = result.assets?.[0];
      if (!asset || !asset.uri) return;

      setUploadingFile(true);
      const formData = new FormData();
      
      formData.append('file', {
        uri: asset.uri,
        type: asset.type || 'image/jpeg',
        name: asset.fileName || `upload_${Date.now()}.jpg`,
      } as any);

      formData.append('type', asset.type?.startsWith('video') ? 'video' : 'image');
      if (replyTo) formData.append('reply_to_id', replyTo.id);

      await conversationsAPI.sendMessage(conversationId, formData, true);
      setReplyTo(null);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 300);
      showMessage({ message: 'Fichier envoyé', type: 'success' });
    } catch (error: any) {
      console.error('Upload error:', error);
      Alert.alert('Erreur', error?.response?.data?.message || 'Échec envoi fichier');
    } finally {
      setUploadingFile(false);
    }
  };

  const handleDocumentPicker = async () => {
    setAttachmentMenu(false);

    try {
      const result = await DocumentPicker.pick({
        type: [DocumentPicker.types.allFiles],
        copyTo: 'cachesDirectory',
      });

      const file = result[0];
      if (!file) return;

      // Vérifier la taille (max 100MB comme backend)
      if (file.size && file.size > 100 * 1024 * 1024) {
        Alert.alert('Erreur', 'Fichier trop volumineux (max 100 MB)');
        return;
      }

      setUploadingFile(true);
      const formData = new FormData();

      formData.append('file', {
        uri: file.fileCopyUri || file.uri,
        type: file.type || 'application/octet-stream',
        name: file.name,
      } as any);

      // Déterminer le type
      let messageType = 'file';
      if (file.type?.startsWith('audio/')) messageType = 'audio';
      else if (file.type?.startsWith('video/')) messageType = 'video';
      else if (file.type?.startsWith('image/')) messageType = 'image';

      formData.append('type', messageType);
      if (replyTo) formData.append('reply_to_id', replyTo.id);

      await conversationsAPI.sendMessage(conversationId, formData, true);
      setReplyTo(null);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 300);
      showMessage({ message: 'Fichier envoyé', type: 'success' });
    } catch (error: any) {
      if (DocumentPicker.isCancel(error)) return;
      console.error('Document picker error:', error);
      Alert.alert('Erreur', error?.response?.data?.message || 'Échec envoi document');
    } finally {
      setUploadingFile(false);
    }
  };

  const requestAudioPermission = async (): Promise<boolean> => {
    try {
      const permission = Platform.OS === 'ios'
        ? PERMISSIONS.IOS.MICROPHONE
        : PERMISSIONS.ANDROID.RECORD_AUDIO;

      const result = await request(permission);
      return result === RESULTS.GRANTED;
    } catch (err) {
      console.warn('Audio permission error:', err);
      return false;
    }
  };

  const startAudioRecording = async () => {
    const hasPermission = await requestAudioPermission();
    if (!hasPermission) {
      Alert.alert('Permission refusée', 'Accès au microphone nécessaire pour enregistrer');
      return;
    }

    try {
      ReactNativeHapticFeedback.trigger('impactMedium');
      
      await audioRecorderService.startRecording();

      // ✅ Émettre le typing pendant l'enregistrement
      socketService.sendTyping(conversationId, true);
      
      // Listener pour la durée
      audioRecorderService.onRecordProgress((duration) => {
        setRecordDuration(duration);
      });

      setRecordingAudio(true);

      // Animation de pulsation
      Animated.loop(
        Animated.sequence([
          Animated.timing(recordAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(recordAnim, {
            toValue: 0,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      ).start();

      console.log('[Chat] Audio recording started');
    } catch (error: any) {
      console.error('Audio recording error:', error);
      Alert.alert('Erreur', error.message || 'Impossible de démarrer l\'enregistrement');
    }
  };

  const stopAudioRecording = async (): Promise<string | null> => {
    if (!recordingAudio) return null;

    try {
      const filePath = await audioRecorderService.stopRecording();
      setRecordingAudio(false);
      recordAnim.setValue(0);
      return filePath;
    } catch (error) {
      console.error('Stop recording error:', error);
      return null;
    }
  };

  const cancelAudioRecording = async () => {
    await stopAudioRecording();
    setRecordDuration(0);
    // ✅ Arrêter le signal typing
    socketService.sendTyping(conversationId, false);
    ReactNativeHapticFeedback.trigger('notificationWarning');
  };

  const sendAudioRecording = async () => {
    const filePath = await stopAudioRecording();
    if (!filePath) return;

    // ✅ Arrêter le signal typing
    socketService.sendTyping(conversationId, false);
    ReactNativeHapticFeedback.trigger('notificationSuccess');
    setUploadingFile(true);

    try {
      const formData = new FormData();
      
      // Fix du path pour Android
      const uri = Platform.OS === 'android' && !filePath.startsWith('file://') 
        ? `file://${filePath}` 
        : filePath;

      formData.append('file', {
        uri,
        type: 'audio/mp4',
        name: `audio_${Date.now()}.${Platform.OS === 'ios' ? 'm4a' : 'mp4'}`,
      } as any);

      formData.append('type', 'audio');
      if (replyTo) formData.append('reply_to_id', replyTo.id);

      await conversationsAPI.sendMessage(conversationId, formData, true);
      setReplyTo(null);
      setRecordDuration(0);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 300);
      showMessage({ message: 'Message vocal envoyé', type: 'success' });
    } catch (error: any) {
      console.error('Send audio error:', error);
      Alert.alert('Erreur', error?.response?.data?.message || 'Échec envoi audio');
    } finally {
      setUploadingFile(false);
    }
  };

  const isMyMessage = (msg: Message) => msg.sender_id === user?.id;

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const toggleAudioPlay = async (messageId: string, fileUrl: string) => {
    if (!fileUrl) {
      Alert.alert('Erreur', 'Fichier audio introuvable');
      return;
    }

    const url = getMediaUrl(fileUrl);
    console.log('[Audio] Toggle play:', url);

    if (playingAudio === messageId) {
      // Stop
      try {
        await audioRecorderService.stopPlayer();
        setPlayingAudio(null);
      } catch (error) {
        console.error('[Audio] Stop error:', error);
      }
    } else {
      // Play
      try {
        setPlayingAudio(messageId);

        await audioRecorderService.startPlayer(
          url,
          // Callback de fin de lecture
          () => {
            console.log('[Audio] Playback finished');
            setPlayingAudio(null);
          },
          // Callback de progression
          (currentPosition, audioDurationMs) => {
            setAudioDuration((prev) => ({
              ...prev,
              [messageId]: Math.floor(currentPosition / 1000),
            }));
          }
        );
      } catch (error: any) {
        console.error('[Audio] Play error:', error);
        setPlayingAudio(null);
        Alert.alert('Erreur', error.message || 'Impossible de lire l\'audio');
      }
    }
  };

  const renderTypingIndicator = () => {
    if (!convTypingUsers.length) return null;

    // Récupérer les noms depuis les membres de la conversation dans le store
    const { conversations } = useChatStore.getState();
    const conv = conversations.find((c) => c.id === conversationId);
    const typingNames = convTypingUsers.map((t) => {
      const member = conv?.members?.find((m) => m.id === t.userId);
      return member?.display_name || 'Quelqu\'un';
    });

    const label = typingNames.length === 1
      ? `${typingNames[0]} est en train d'écrire...`
      : `${typingNames.join(', ')} sont en train d'écrire...`;

    return (
      <View style={styles.typingContainer}>
        <View style={styles.typingDots}>
          {[0, 150, 300].map((delay) => (
            <TypingDot key={delay} delay={delay} />
          ))}
        </View>
        <Text style={styles.typingText}>{label}</Text>
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
                {msg.replyTo.content || (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Icon name="paperclip" size={12} color={COLORS.gray500} />
                    <Text>Fichier</Text>
                  </View>
                )}
              </Text>
            </View>
          )}

          {msg.type === 'text' && (
            <Text style={[styles.msgText, isMine && styles.msgTextMe]}>{msg.content}</Text>
          )}
          {msg.type === 'image' && (
            <TouchableOpacity onPress={() => {
              if (msg.file_url) {
                // Trouver l'index de cette image parmi toutes les images de la conversation
                const imageMessages = messages.filter(m => m.type === 'image' && m.file_url);
                const index = imageMessages.findIndex(m => m.id === msg.id);
                setImageViewerIndex(index >= 0 ? index : 0);
                setImageViewerVisible(true);
              }
            }}>
              {msg.file_url ? (
                <CachedImage 
                  source={{ 
                    uri: getMediaUrl(msg.file_url),
                    priority: FastImage.priority.normal,
                  }}
                  style={styles.imageMsg}
                  resizeMode={FastImage.resizeMode.cover}
                  onLoadStart={() => {
                    console.log('[Image] 🔄 Chargement via cache...');
                  }}
                  onLoad={() => {
                    console.log('[Image] ✅ Image affichée!');
                  }}
                  onError={() => {
                    console.error('[Image] ❌ Erreur d\'affichage');
                  }}
                />
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Icon name="image" size={18} color={isMine ? COLORS.white : COLORS.primary} />
                  <Text style={[styles.mediaMsg, isMine && styles.msgTextMe]}>
                    {msg.file_name || 'Image'}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          )}
          {msg.type === 'file' && (
            <TouchableOpacity onPress={async () => {
              if (msg.file_url) {
                const url = getMediaUrl(msg.file_url);
                console.log('[File] Download:', url);
                
                Alert.alert(
                  'Document',
                  `${msg.file_name || 'Fichier'}\n${msg.file_size ? `Taille: ${formatFileSize(msg.file_size)}` : ''}\n\nQue souhaitez-vous faire?`,
                  [
                    {
                      text: 'Copier le lien',
                      onPress: () => {
                        import('@react-native-clipboard/clipboard').then(({ default: Clipboard }) => {
                          Clipboard.setString(url);
                          showMessage({
                            message: 'Lien copié',
                            description: 'Le lien du fichier a été copié dans le presse-papier',
                            type: 'success',
                          });
                        });
                      }
                    },
                    {
                      text: 'Télécharger et ouvrir',
                      onPress: async () => {
                        try {
                          setDownloadProgress({ ...downloadProgress, [msg.id]: 0 });
                          
                          await downloadAndOpenFile(
                            url,
                            msg.file_name || 'document.pdf',
                            (progress) => {
                              setDownloadProgress({ ...downloadProgress, [msg.id]: progress });
                            }
                          );
                          
                          // Retirer la progression après le téléchargement
                          const newProgress = { ...downloadProgress };
                          delete newProgress[msg.id];
                          setDownloadProgress(newProgress);
                          
                          showMessage({
                            message: 'Téléchargement terminé',
                            description: 'Le fichier a été téléchargé et ouvert',
                            type: 'success',
                          });
                        } catch (error: any) {
                          const newProgress = { ...downloadProgress };
                          delete newProgress[msg.id];
                          setDownloadProgress(newProgress);
                          
                          showMessage({
                            message: 'Erreur de téléchargement',
                            description: error.message || 'Impossible de télécharger le fichier',
                            type: 'danger',
                            duration: 4000,
                          });
                        }
                      }
                    },
                    { text: 'Annuler', style: 'cancel' }
                  ]
                );
              }
            }}>
              <View style={styles.fileContainer}>
                <View style={styles.fileIcon}>
                  <Icon name="file-document" size={24} color={COLORS.primary} />
                </View>
                <View style={styles.fileInfo}>
                  <Text style={[styles.fileName, isMine && styles.fileNameMe]} numberOfLines={2}>
                    {msg.file_name || 'Fichier'}
                  </Text>
                  {downloadProgress[msg.id] !== undefined ? (
                    <Text style={[styles.fileSize, isMine && styles.fileSizeMe]}>
                      Téléchargement... {Math.round(downloadProgress[msg.id])}%
                    </Text>
                  ) : msg.file_size ? (
                    <Text style={[styles.fileSize, isMine && styles.fileSizeMe]}>
                      {formatFileSize(msg.file_size)}
                    </Text>
                  ) : null}
                </View>
                {downloadProgress[msg.id] !== undefined ? (
                  <ActivityIndicator size="small" color={isMine ? COLORS.white : COLORS.primary} />
                ) : (
                  <Icon 
                    name="download" 
                    size={20} 
                    color={isMine ? COLORS.white : COLORS.primary} 
                  />
                )}
              </View>
            </TouchableOpacity>
          )}
          {msg.type === 'audio' && (
            <TouchableOpacity 
              onPress={() => toggleAudioPlay(msg.id, msg.file_url || '')}
              disabled={!msg.file_url}
            >
              <View style={styles.audioContainer}>
                <View style={styles.audioIcon}>
                  <Icon 
                    name={playingAudio === msg.id ? 'pause-circle' : 'play-circle'} 
                    size={32} 
                    color={isMine ? COLORS.white : COLORS.primary} 
                  />
                </View>
                <View style={styles.audioInfo}>
                  <Text style={[styles.audioName, isMine && styles.audioNameMe]}>
                    Message vocal
                  </Text>
                  <Text style={[styles.audioDuration, isMine && styles.audioDurationMe]}>
                    {audioDuration[msg.id] 
                      ? formatDuration(audioDuration[msg.id]) 
                      : (msg.duration ? formatDuration(msg.duration) : '0:00')
                    }
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          )}
          {msg.type === 'video' && (
            <TouchableOpacity onPress={() => {
              if (msg.file_url) {
                const url = getMediaUrl(msg.file_url);
                setCurrentVideoUrl(url);
                setVideoPlayerVisible(true);
              }
            }}>
              {msg.file_url ? (
                <View style={styles.videoContainer}>
                  <CachedImage 
                    source={{ 
                      uri: getMediaUrl(msg.file_url),
                      priority: FastImage.priority.normal,
                    }}
                    style={styles.videoThumbnail}
                    resizeMode={FastImage.resizeMode.cover}
                  />
                  <View style={styles.videoOverlay}>
                    <Icon name="play-circle" size={48} color={COLORS.white} />
                  </View>
                  {msg.duration && (
                    <View style={styles.videoDuration}>
                      <Text style={styles.videoDurationText}>
                        {formatDuration(msg.duration)}
                      </Text>
                    </View>
                  )}
                </View>
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Icon name="video" size={18} color={isMine ? COLORS.white : COLORS.primary} />
                  <Text style={styles.mediaMsg}>{msg.file_name || 'Vidéo'}</Text>
                </View>
              )}
            </TouchableOpacity>
          )}

          <View style={styles.msgMeta}>
            <Text style={[styles.msgTime, isMine && styles.msgTimMe]}>
              {time}
              {msg.is_edited && ' · modifié'}
            </Text>
            {isMine && !msg.is_deleted && (
              <View style={styles.readStatus}>
                {msg.isRead ? (
                  // Double coche bleue (lu)
                  <Icon name="check-all" size={16} color={COLORS.primary} />
                ) : msg.isDelivered ? (
                  // Double coche grise (délivré mais pas lu)
                  <Icon name="check-all" size={16} color={COLORS.gray400} />
                ) : (
                  // Simple coche grise (envoyé mais pas délivré)
                  <Icon name="check" size={16} color={COLORS.gray400} />
                )}
              </View>
            )}
          </View>

          {/* Réactions */}
          {msg.reactions && msg.reactions.length > 0 && (
            <View style={styles.reactionsRow}>
              {Object.entries(
                msg.reactions.reduce((acc: Record<string, number>, r) => {
                  acc[r.emoji] = (acc[r.emoji] || 0) + 1;
                  return acc;
                }, {})
              ).map(([emoji, count]) => {
                const reaction = REACTIONS.find(r => r.emoji === emoji);
                return (
                  <TouchableOpacity
                    key={emoji}
                    style={styles.reactionPill}
                    onPress={() => addReaction(msg.id, emoji)}
                  >
                    {reaction ? (
                      <Icon name={reaction.icon} size={14} color={COLORS.primary} />
                    ) : (
                      <Text style={styles.reactionEmoji}>{emoji}</Text>
                    )}
                    <Text style={styles.reactionCount}>{count}</Text>
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity
                style={styles.addReactionBtn}
                onPress={() => setEmojiMenu({ msgId: msg.id })}
              >
                <Icon name="emoticon-happy-outline" size={16} color={COLORS.gray500} />
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
          <Icon name="arrow-left" size={24} color={COLORS.white} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerName} numberOfLines={1}>{name}</Text>
          <Text style={styles.headerType}>
            {type === 'group' ? 'Groupe' : 'Message direct'}
          </Text>
        </View>

        {/* Boutons d'appel */}
        <View style={styles.headerActions}>
          {/* Appel audio */}
          <TouchableOpacity
            style={styles.callBtn}
            onPress={() => {
              if (type === 'direct') {
                const conv = useChatStore.getState().conversations.find(c => c.id === conversationId);
                const other = conv?.members?.find(m => m.id !== user?.id);
                if (!other) return;
                navigation.navigate('OutgoingCall', {
                  calleeId: other.id,
                  calleeName: other.display_name,
                  calleeAvatar: other.avatar_url ?? undefined,
                  type: 'audio',
                });
              } else {
                // Groupe : appel vers le premier autre membre
                const conv = useChatStore.getState().conversations.find(c => c.id === conversationId);
                const other = conv?.members?.find(m => m.id !== user?.id);
                if (!other) return;
                navigation.navigate('OutgoingCall', {
                  calleeId: other.id,
                  calleeName: name,
                  type: 'audio',
                  conversationId,
                });
              }
            }}
          >
            <Icon name="phone" size={22} color={COLORS.white} />
          </TouchableOpacity>

          {/* Appel vidéo */}
          <TouchableOpacity
            style={styles.callBtn}
            onPress={() => {
              if (type === 'direct') {
                const conv = useChatStore.getState().conversations.find(c => c.id === conversationId);
                const other = conv?.members?.find(m => m.id !== user?.id);
                if (!other) return;
                navigation.navigate('OutgoingCall', {
                  calleeId: other.id,
                  calleeName: other.display_name,
                  calleeAvatar: other.avatar_url ?? undefined,
                  type: 'video',
                });
              } else {
                const conv = useChatStore.getState().conversations.find(c => c.id === conversationId);
                const other = conv?.members?.find(m => m.id !== user?.id);
                if (!other) return;
                navigation.navigate('OutgoingCall', {
                  calleeId: other.id,
                  calleeName: name,
                  type: 'video',
                  conversationId,
                });
              }
            }}
          >
            <Icon name="video" size={22} color={COLORS.white} />
          </TouchableOpacity>

          {/* Bouton info pour les groupes */}
          {type === 'group' && (
            <TouchableOpacity
              onPress={() => navigation.navigate('GroupInfo', { groupId: conversationId })}
              style={styles.callBtn}
            >
              <Icon name="information" size={22} color={COLORS.white} />
            </TouchableOpacity>
          )}
        </View>
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
            <Icon name="reply" size={18} color={COLORS.primary} style={{ marginRight: 8 }} />
            <View style={styles.replyBannerContent}>
              <Text style={styles.replyBannerLabel}>Répondre à</Text>
              <Text style={styles.replyBannerText} numberOfLines={1}>
                {replyTo.content || 'Fichier'}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setReplyTo(null)}>
              <Icon name="close" size={20} color={COLORS.gray500} />
            </TouchableOpacity>
          </View>
        )}

        {/* Edit banner */}
        {editingMsg && (
          <View style={[styles.replyBanner, styles.editBanner]}>
            <Icon name="pencil" size={18} color={COLORS.warning} style={{ marginRight: 8 }} />
            <View style={styles.replyBannerContent}>
              <Text style={styles.editBannerLabel}>Modifier le message</Text>
              <Text style={styles.replyBannerText} numberOfLines={1}>
                {editingMsg.content}
              </Text>
            </View>
            <TouchableOpacity onPress={() => { setEditingMsg(null); setText(''); }}>
              <Icon name="close" size={20} color={COLORS.gray500} />
            </TouchableOpacity>
          </View>
        )}

        {/* Input bar */}
        <View style={styles.inputBar}>
          {!recordingAudio && (
            <>
              <TouchableOpacity 
                style={styles.attachBtn}
                onPress={() => setAttachmentMenu(true)}
                disabled={uploadingFile}
              >
                <Icon 
                  name="paperclip" 
                  size={24} 
                  color={uploadingFile ? COLORS.gray400 : COLORS.primary} 
                />
              </TouchableOpacity>
              
              <TextInput
                style={styles.textInput}
                value={text}
                onChangeText={(v) => { setText(v); handleTyping(); }}
                placeholder="Message..."
                placeholderTextColor={COLORS.gray400}
                multiline
                maxLength={10000}
                returnKeyType="default"
                editable={!uploadingFile}
              />
            </>
          )}

          {recordingAudio ? (
            // UI enregistrement audio
            <>
              <TouchableOpacity 
                style={styles.cancelRecordBtn}
                onPress={cancelAudioRecording}
              >
                <Icon name="close" size={24} color={COLORS.danger} />
              </TouchableOpacity>

              <View style={styles.recordingIndicator}>
                <Animated.View 
                  style={[
                    styles.recordingDot,
                    {
                      opacity: recordAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.3, 1],
                      }),
                    },
                  ]}
                />
                <Text style={styles.recordingTime}>{formatDuration(recordDuration)}</Text>
                <Text style={styles.recordingHint}>← Glisser pour annuler</Text>
              </View>

              <TouchableOpacity
                style={styles.sendAudioBtn}
                onPress={sendAudioRecording}
              >
                <Icon name="send" size={20} color={COLORS.white} />
              </TouchableOpacity>
            </>
          ) : text.trim() ? (
            // Bouton envoi
            <TouchableOpacity
              style={[styles.sendBtn, (!text.trim() || sending || uploadingFile) && styles.sendBtnDisabled]}
              onPress={sendMessage}
              disabled={!text.trim() || sending || uploadingFile}
            >
              {sending ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <Icon 
                  name={editingMsg ? 'check' : 'send'} 
                  size={20} 
                  color={COLORS.white} 
                />
              )}
            </TouchableOpacity>
          ) : (
            // Bouton micro (style WhatsApp)
            <TouchableOpacity
              style={styles.micBtn}
              onLongPress={startAudioRecording}
              onPressOut={() => {
                if (recordingAudio && recordDuration > 1) {
                  sendAudioRecording();
                } else if (recordingAudio) {
                  cancelAudioRecording();
                }
              }}
              delayLongPress={200}
            >
              <Icon name="microphone" size={24} color={COLORS.white} />
            </TouchableOpacity>
          )}
        </View>

        {/* Upload progress */}
        {uploadingFile && (
          <View style={styles.uploadProgress}>
            <ActivityIndicator size="small" color={COLORS.primary} />
            <Text style={styles.uploadText}>Envoi du fichier...</Text>
          </View>
        )}
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
                  <Icon name="reply" size={18} color={COLORS.primary} style={{ marginRight: 8 }} />
                  <Text style={styles.contextText}>Répondre</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.contextItem}
                  onPress={() => {
                    setEmojiMenu({ msgId: contextMenu.msg.id });
                    setContextMenu(null);
                  }}
                >
                  <Icon name="emoticon-happy-outline" size={18} color={COLORS.primary} style={{ marginRight: 8 }} />
                  <Text style={styles.contextText}>Réagir</Text>
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
                    <Icon name="pencil" size={18} color={COLORS.primary} style={{ marginRight: 8 }} />
                    <Text style={styles.contextText}>Modifier</Text>
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
                    <Icon name="delete" size={18} color={COLORS.danger} style={{ marginRight: 8 }} />
                    <Text style={[styles.contextText, styles.contextDangerText]}>
                      Supprimer
                    </Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        </Pressable>
      </Modal>

      {/* Panneau de réactions */}
      <Modal
        transparent
        visible={!!emojiMenu}
        animationType="slide"
        onRequestClose={() => setEmojiMenu(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setEmojiMenu(null)}>
          <View style={styles.emojiPanel}>
            <Text style={styles.emojiTitle}>Réagir au message</Text>
            <View style={styles.emojiRow}>
              {REACTIONS.map(({ emoji, icon, label }) => (
                <TouchableOpacity
                  key={emoji}
                  style={styles.emojiBtn}
                  onPress={() => emojiMenu && addReaction(emojiMenu.msgId, emoji)}
                >
                  <Icon name={icon} size={28} color={COLORS.primary} />
                  <Text style={styles.reactionLabel}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* Attachment Menu */}
      <Modal
        transparent
        visible={attachmentMenu}
        animationType="slide"
        onRequestClose={() => setAttachmentMenu(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setAttachmentMenu(false)}>
          <View style={styles.attachmentPanel}>
            <Text style={styles.emojiTitle}>Envoyer un fichier</Text>
            
            <TouchableOpacity 
              style={styles.attachmentOption}
              onPress={handleImagePicker}
            >
              <Icon name="image" size={28} color={COLORS.primary} />
              <Text style={styles.attachmentText}>Photo/Vidéo</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.attachmentOption}
              onPress={handleDocumentPicker}
            >
              <Icon name="file-document" size={28} color={COLORS.success} />
              <Text style={styles.attachmentText}>Document</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.attachmentOption, styles.attachmentCancel]}
              onPress={() => setAttachmentMenu(false)}
            >
              <Icon name="close" size={28} color={COLORS.gray600} />
              <Text style={styles.attachmentText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Image Viewer */}
      <ImageViewer
        visible={imageViewerVisible}
        images={messages.filter(m => m.type === 'image' && m.file_url)}
        imageIndex={imageViewerIndex}
        onClose={() => setImageViewerVisible(false)}
      />

      {/* Video Player */}
      <VideoPlayer
        visible={videoPlayerVisible}
        videoUrl={currentVideoUrl}
        onClose={() => {
          setVideoPlayerVisible(false);
          setCurrentVideoUrl('');
        }}
      />
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  callBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
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
  msgMeta: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 3, alignItems: 'center', gap: 4 },
  msgTime: { fontSize: 10, color: COLORS.gray400 },
  msgTimMe: { color: 'rgba(255,255,255,0.65)' },
  readStatus: { marginLeft: 2 },
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
  typingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  typingDots: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: SIZES.radiusFull,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.gray400,
  },
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
  micBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelRecordBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.dangerLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  recordingIndicator: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.dangerLight,
    borderRadius: SIZES.radiusLg,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.danger,
    marginRight: 8,
  },
  recordingTime: {
    fontSize: SIZES.md,
    fontWeight: '600',
    color: COLORS.danger,
    marginRight: 12,
  },
  recordingHint: {
    flex: 1,
    fontSize: SIZES.xs,
    color: COLORS.gray600,
    fontStyle: 'italic',
  },
  sendAudioBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
    alignItems: 'center',
    padding: 10,
    gap: 4,
    flex: 1,
  },
  reactionLabel: { fontSize: SIZES.xs, color: COLORS.gray600, textAlign: 'center' },
  attachBtn: {
    padding: 8,
    marginRight: 8,
  },
  uploadProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primaryXLight,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.primaryXXLight,
  },
  uploadText: {
    marginLeft: 10,
    fontSize: SIZES.sm,
    color: COLORS.primary,
    fontWeight: '500',
  },
  imageMsg: {
    width: 200,
    height: 200,
    borderRadius: SIZES.radiusMd,
    marginVertical: 4,
    backgroundColor: COLORS.gray200,
  },
  attachmentPanel: {
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
  attachmentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.gray50,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: SIZES.radiusLg,
    marginBottom: 12,
  },
  attachmentCancel: {
    backgroundColor: COLORS.gray200,
  },
  attachmentText: {
    fontSize: SIZES.md,
    fontWeight: '500',
    color: COLORS.gray800,
    marginLeft: 16,
  },
  fileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: SIZES.radiusMd,
    padding: 12,
    minWidth: 200,
    maxWidth: 280,
  },
  fileIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primaryXLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    fontSize: SIZES.sm,
    fontWeight: '500',
    color: COLORS.gray900,
    marginBottom: 2,
  },
  fileNameMe: {
    color: COLORS.white,
  },
  fileSize: {
    fontSize: SIZES.xs,
    color: COLORS.gray500,
  },
  fileSizeMe: {
    color: 'rgba(255,255,255,0.7)',
  },
  audioContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 200,
    maxWidth: 280,
  },
  audioIcon: {
    marginRight: 12,
  },
  audioInfo: {
    flex: 1,
  },
  audioName: {
    fontSize: SIZES.sm,
    fontWeight: '500',
    color: COLORS.gray900,
    marginBottom: 2,
  },
  audioNameMe: {
    color: COLORS.white,
  },
  audioDuration: {
    fontSize: SIZES.xs,
    color: COLORS.gray500,
  },
  audioDurationMe: {
    color: 'rgba(255,255,255,0.7)',
  },
  videoContainer: {
    position: 'relative',
    width: 200,
    height: 200,
    borderRadius: SIZES.radiusMd,
    overflow: 'hidden',
  },
  videoThumbnail: {
    width: '100%',
    height: '100%',
  },
  videoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoDuration: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: SIZES.radiusSm,
  },
  videoDurationText: {
    color: COLORS.white,
    fontSize: SIZES.xs,
    fontWeight: '600',
  },
});

export default ChatScreen;
