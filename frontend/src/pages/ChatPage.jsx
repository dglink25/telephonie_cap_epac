import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Send, Paperclip, Phone, Video, Search, Plus, ArrowLeft,
  Edit2, Trash2, Reply, MessageSquare, Loader2, X, Mic,
  Image, Film, FileText, Music, Settings, Smile, Users,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import api from '../services/api';
import useAuthStore from '../store/authStore';
import useSocketStore from '../store/socketStore';
import { useVoiceRecorder } from '../hooks/useVoiceRecorder';
import AudioPlayer from '../components/chat/AudioPlayer';
import FilePreview from '../components/chat/FilePreview';
import GroupSettings from '../components/chat/GroupSettings';
import MentionPicker from '../components/chat/MentionPicker';
import EmojiPickerPanel from '../components/chat/EmojiPicker';
import { useMention } from '../hooks/useMention';
import { useFeedback } from '../components/ui/FeedbackModal';
import MeetingModal from '../components/meeting/MeetingModal';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Avatar({ user, size = 'md' }) {
  const sizes = { sm: 'w-8 h-8 text-xs', md: 'w-10 h-10 text-sm', lg: 'w-12 h-12 text-base' };
  const l = user?.display_name?.charAt(0)?.toUpperCase() || '?';
  if (user?.avatar_url)
    return <img src={user.avatar_url} alt={user.display_name} className={`${sizes[size]} rounded-full object-cover flex-shrink-0`} />;
  return (
    <div className={`${sizes[size]} rounded-full bg-primary-100 text-primary-700 font-semibold flex items-center justify-center flex-shrink-0`}>
      {l}
    </div>
  );
}

function PresenceBadge({ status }) {
  const colors = { online: 'bg-primary-600', away: 'bg-yellow-400', dnd: 'bg-red-500', offline: 'bg-slate-400' };
  return <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${colors[status] || colors.offline}`} />;
}

// ─── Rendu texte avec @mentions ───────────────────────────────────────────────

function renderTextWithMentions(text, isOwn) {
  if (!text) return null;
  const parts = text.split(/(@[^\s@]+)/g);
  return parts.map((part, i) => {
    if (part.startsWith('@') && part.length > 1) {
      return (
        <span key={i} className={`font-semibold ${isOwn ? 'text-white underline decoration-white/50' : 'text-primary-600'}`}>
          {part}
        </span>
      );
    }
    return part;
  });
}

// ─── Bulle de message ─────────────────────────────────────────────────────────

function MessageBubble({ msg, currentUserId, onReply, onEdit, onDelete }) {
  const isOwn = msg.sender_id === currentUserId;
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const h = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const renderContent = () => {
    if (msg.is_deleted) {
      return (
        <p className={`text-sm italic flex items-center gap-1.5 ${isOwn ? 'text-primary-200' : 'text-slate-400'}`}>
          <Trash2 className="w-3.5 h-3.5" /> Message retiré
        </p>
      );
    }
    switch (msg.type) {
      case 'audio':
        return <AudioPlayer src={msg.file_url} isOwn={isOwn} />;
      case 'image':
        return (
          <a href={msg.file_url} target="_blank" rel="noopener noreferrer">
            <img
              src={msg.file_url}
              alt={msg.file_name || 'Image'}
              className="max-w-[200px] md:max-w-[240px] rounded-xl cursor-pointer hover:opacity-90 transition-opacity"
              loading="lazy"
            />
            {msg.content && <p className={`text-sm mt-1.5 ${isOwn ? 'text-white' : 'text-slate-800'}`}>{msg.content}</p>}
          </a>
        );
      case 'video':
        return (
          <div className="max-w-[240px] md:max-w-[280px]">
            <video src={msg.file_url} controls className="rounded-xl w-full" preload="metadata" />
            {msg.content && <p className={`text-sm mt-1.5 ${isOwn ? 'text-white' : 'text-slate-800'}`}>{msg.content}</p>}
          </div>
        );
      case 'file':
        return <FilePreview fileUrl={msg.file_url} fileName={msg.file_name} fileSize={msg.file_size} fileMime={msg.file_mime} isOwn={isOwn} />;
      default:
        return <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{renderTextWithMentions(msg.content, isOwn)}</p>;
    }
  };

  const canEdit   = msg.canEdit && !msg.is_deleted && msg.type === 'text' && isOwn;
  const canDelete = !msg.is_deleted && isOwn;

  return (
    <div className={`flex gap-2 group mb-3 md:mb-4 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
      {!isOwn && <Avatar user={msg.sender} size="sm" />}

      <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} max-w-[85%] md:max-w-[70%]`}>
        {!isOwn && (
          <span className="text-xs text-slate-500 mb-1 ml-1 font-medium">{msg.sender?.display_name}</span>
        )}

        {msg.replyTo && !msg.replyTo.is_deleted && (
          <div className={`text-xs px-3 py-2 rounded-xl mb-1 max-w-full border-l-2 border-primary-400 
            ${isOwn ? 'bg-primary-700/50 text-primary-100' : 'bg-primary-50 text-slate-600'}`}>
            <span className="font-semibold text-primary-600">{msg.replyTo.sender?.display_name}</span>
            <p className="truncate opacity-80">{msg.replyTo.type !== 'text' ? `📎 ${msg.replyTo.file_name || 'Fichier'}` : msg.replyTo.content}</p>
          </div>
        )}

        <div className="relative">
          <div className={`rounded-2xl px-4 py-2.5 shadow-sm
            ${isOwn
              ? 'bg-primary-600 text-white rounded-br-sm'
              : 'bg-white text-slate-800 rounded-bl-sm border border-slate-100'
            }`}
          >
            {renderContent()}
          </div>

          {(canEdit || canDelete || !msg.is_deleted) && (
            <div className={`absolute top-0 ${isOwn ? 'left-0 -translate-x-full pr-1' : 'right-0 translate-x-full pl-1'} 
              hidden group-hover:flex items-center gap-0.5`} ref={menuRef}>
              {!msg.is_deleted && (
                <button onClick={() => onReply(msg)}
                  className="btn-icon w-7 h-7 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-full">
                  <Reply className="w-3.5 h-3.5" />
                </button>
              )}
              {canEdit && (
                <button onClick={() => onEdit(msg)}
                  className="btn-icon w-7 h-7 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full">
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              )}
              {canDelete && (
                <button onClick={() => onDelete(msg)}
                  className="btn-icon w-7 h-7 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>

        <div className={`flex items-center gap-1 mt-0.5 px-1 ${isOwn ? 'flex-row-reverse' : ''}`}>
          <span className="text-[10px] text-slate-400">{format(new Date(msg.created_at), 'HH:mm')}</span>
          {msg.is_edited && !msg.is_deleted && (
            <span className="text-[10px] text-slate-400 italic">· modifié</span>
          )}
          {isOwn && !msg.is_deleted && (
            <span className="flex items-center gap-0.5" title={
              msg.isRead ? `Lu par ${msg.readBy?.length || 0} personne(s)` : 
              msg.isDelivered ? 'Délivré' : 
              'Envoyé'
            }>
              {msg.isRead ? (
                // Double coche bleue (lu)
                <svg className="w-4 h-4 text-blue-500" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.879a.32.32 0 0 1-.484.033l-.358-.325a.319.319 0 0 0-.484.032l-.378.483a.418.418 0 0 0 .036.541l1.32 1.266c.143.14.361.125.484-.033l6.272-8.048a.366.366 0 0 0-.064-.512zm-4.1 0l-.478-.372a.365.365 0 0 0-.51.063L4.566 9.879a.32.32 0 0 1-.484.033L1.891 7.769a.366.366 0 0 0-.515.006l-.423.433a.364.364 0 0 0 .006.514l3.258 3.185c.143.14.361.125.484-.033l6.272-8.048a.365.365 0 0 0-.063-.51z"/>
                </svg>
              ) : msg.isDelivered ? (
                // Double coche grise (délivré mais pas lu)
                <svg className="w-4 h-4 text-slate-400" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.879a.32.32 0 0 1-.484.033l-.358-.325a.319.319 0 0 0-.484.032l-.378.483a.418.418 0 0 0 .036.541l1.32 1.266c.143.14.361.125.484-.033l6.272-8.048a.366.366 0 0 0-.064-.512zm-4.1 0l-.478-.372a.365.365 0 0 0-.51.063L4.566 9.879a.32.32 0 0 1-.484.033L1.891 7.769a.366.366 0 0 0-.515.006l-.423.433a.364.364 0 0 0 .006.514l3.258 3.185c.143.14.361.125.484-.033l6.272-8.048a.365.365 0 0 0-.063-.51z"/>
                </svg>
              ) : (
                // Simple coche grise (envoyé mais pas délivré)
                <svg className="w-4 h-4 text-slate-400" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M13.485 1.431a1.473 1.473 0 0 1 2.104 2.062l-7.84 9.801a1.473 1.473 0 0 1-2.12.04L.431 8.138a1.473 1.473 0 0 1 2.084-2.083l4.111 4.112 6.82-8.69a.486.486 0 0 1 .04-.045z"/>
                </svg>
              )}
            </span>
          )}
          {isOwn && !msg.is_deleted && msg.type === 'text' && msg.canEdit && (
            <span title="Modifiable encore" className="text-[10px] text-primary-400">✎</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Item conversation ────────────────────────────────────────────────────────

function ConversationItem({ conv, isActive, currentUserId, onClick }) {
  const other = conv.members?.find((m) => m.id !== currentUserId);
  const name  = conv.type === 'direct' ? other?.display_name : conv.name;

  const lastMsgPreview = () => {
    const m = conv.lastMessage;
    if (!m) return 'Aucun message';
    if (m.is_deleted) return 'Message retiré';
    if (m.type === 'audio') return 'Message vocal';
    if (m.type === 'image') return 'Image';
    if (m.type === 'video') return 'Vidéo';
    if (m.type === 'file')  return `${m.file_name || 'Fichier'}`;
    return m.content || '';
  };

  return (
    <button onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all text-left
        ${isActive ? 'bg-primary-50 border border-primary-200' : 'hover:bg-slate-50'}`}>
      <div className="relative flex-shrink-0">
        {other
          ? <><Avatar user={other} size="md" /><PresenceBadge status={other.presence_status} /></>
          : <div className="w-10 h-10 rounded-full bg-primary-600 flex items-center justify-center text-white text-sm font-semibold">{name?.charAt(0)||'#'}</div>
        }
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className={`text-sm font-medium truncate ${isActive ? 'text-primary-700' : 'text-slate-800'}`}>{name}</span>
          {conv.lastMessage && (
            <span className="text-[10px] text-slate-400 ml-1 flex-shrink-0">
              {formatDistanceToNow(new Date(conv.lastMessage.created_at), { addSuffix: false, locale: fr })}
            </span>
          )}
        </div>
        <p className="text-xs text-slate-500 truncate mt-0.5">{lastMsgPreview()}</p>
      </div>
      {conv.unreadCount > 0 && (
        <span className="bg-primary-600 text-white text-[10px] rounded-full px-1.5 py-0.5 min-w-[18px] text-center flex-shrink-0 font-medium">
          {conv.unreadCount > 99 ? '99+' : conv.unreadCount}
        </span>
      )}
    </button>
  );
}

// ─── Modal Retirer message ────────────────────────────────────────────────────

function DeleteModal({ message, onConfirm, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5 md:p-6">
        <h3 className="font-semibold text-slate-800 mb-2 text-base md:text-lg">Retirer le message ?</h3>
        <p className="text-xs md:text-sm text-slate-500 mb-4 md:mb-5">
          Le message sera retiré pour tout le monde et remplacé par "Message retiré".
        </p>
        <div className="flex gap-2 md:gap-3">
          <button onClick={onClose} className="btn-secondary flex-1 text-sm">Annuler</button>
          <button onClick={onConfirm} className="btn-danger flex-1 text-sm">Retirer</button>
        </div>
      </div>
    </div>
  );
}

// ─── Barre de saisie vocale ───────────────────────────────────────────────────

function VoiceBar({ recorder, onSend, onCancel }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border-t border-red-100">
      <div className="flex items-center gap-2 flex-1">
        <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
        <span className="text-sm font-medium text-red-700">
          Enregistrement : {recorder.formatDuration(recorder.duration)}
        </span>
      </div>
      <button onClick={onCancel} className="btn-icon text-slate-500 hover:text-slate-700 hover:bg-slate-100" title="Annuler">
        <X className="w-5 h-5" />
      </button>
      <button onClick={onSend} className="w-10 h-10 rounded-full bg-primary-600 hover:bg-primary-700 text-white flex items-center justify-center shadow" title="Envoyer">
        <Send className="w-4 h-4" />
      </button>
    </div>
  );
}

// ─── Indicateur visuel de survol pour paste ───────────────────────────────────

function PasteDropOverlay({ fileName }) {
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-xl pointer-events-none"
      style={{
        background: 'rgba(99,102,241,0.08)',
        border: '2px dashed rgba(99,102,241,0.45)',
      }}
    >
      <Paperclip className="w-8 h-8 text-primary-500 mb-2" />
      <p className="text-sm font-semibold text-primary-700">
        {fileName ? `Coller : ${fileName}` : 'Coller un fichier'}
      </p>
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────

export default function ChatPage() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const { socket, emit } = useSocketStore();

  const [message, setMessage] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [editingMsg, setEditingMsg] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isTyping, setIsTyping] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewConv, setShowNewConv] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showGroupSettings, setShowGroupSettings] = useState(false);
  const [showMeeting, setShowMeeting] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  // Paste / drag-over indicator
  const [pasteHover, setPasteHover] = useState(false);
  const [pasteFileName, setPasteFileName] = useState('');

  const { isMentioning, mentionQuery, handleChange: handleMentionChange, insertMention, cancel: cancelMention } = useMention();
  const { show: showFeedback, node: feedbackNode } = useFeedback();

  const messagesEndRef  = useRef(null);
  const typingTimer     = useRef(null);
  const fileInputRef    = useRef(null);
  const imageInputRef   = useRef(null);
  const videoInputRef   = useRef(null);
  const attachMenuRef   = useRef(null);
  const textareaRef     = useRef(null);
  const chatAreaRef     = useRef(null);   // zone de dépôt paste / drag

  // ── Enregistrement vocal ─────────────────────────────────────────
  const recorder = useVoiceRecorder({
    onComplete: async (blob, duration) => {
      if (!blob || duration < 1) return;
      const ext  = blob.type.includes('ogg') ? '.ogg' : '.webm';
      const file = new File([blob], `vocal_${Date.now()}${ext}`, { type: blob.type });
      const fd   = new FormData();
      fd.append('file', file);
      if (replyTo) fd.append('reply_to_id', replyTo.id);
      sendMutation.mutate(fd);
    },
  });

  // ── Requêtes ──────────────────────────────────────────────────────
  const { data: convsData, isLoading: convsLoading } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => api.get('/conversations').then((r) => r.data.data.conversations),
    refetchInterval: 30000,
  });
  const conversations = convsData || [];
  const activeConv    = conversations.find((c) => c.id === conversationId);

  const { data: msgsData, isLoading: msgsLoading } = useQuery({
    queryKey: ['messages', conversationId],
    queryFn: () => api.get(`/conversations/${conversationId}/messages?limit=50`).then((r) => r.data.data.messages),
    enabled: !!conversationId,
  });
  const messages = msgsData || [];

  // ── Mutations ─────────────────────────────────────────────────────
  const sendMutation = useMutation({
    mutationFn: (data) => api.post(`/conversations/${conversationId}/messages`, data, {
      headers: data instanceof FormData ? { 'Content-Type': 'multipart/form-data' } : {},
    }),
    onSuccess: (resp) => {
      qc.invalidateQueries(['messages', conversationId]);
      // Remonter la conversation en haut immédiatement après envoi
      const sentMsg = resp?.data?.data?.message;
      qc.setQueryData(['conversations'], (old) => {
        if (!old) return old;
        const now = sentMsg?.created_at || new Date().toISOString();
        const updated = old.map((c) =>
          c.id === conversationId
            ? { ...c, lastMessage: sentMsg || c.lastMessage, updated_at: now, unreadCount: 0 }
            : c
        );
        return [...updated].sort(
          (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        );
      });
      setMessage('');
      setReplyTo(null);
      setEditingMsg(null);
    },
    onError: (err) => showFeedback('error', err.response?.data?.message || 'Erreur lors de l\'envoi.'),
  });

  const editMutation = useMutation({
    mutationFn: ({ msgId, content }) =>
      api.put(`/conversations/${conversationId}/messages/${msgId}`, { content }),
    onSuccess: () => {
      qc.invalidateQueries(['messages', conversationId]);
      setEditingMsg(null);
      setMessage('');
      showFeedback('success', 'Message modifié avec succès.');
    },
    onError: (err) => {
      const code = err.response?.data?.code;
      if (code === 'EDIT_WINDOW_EXPIRED') {
        showFeedback('error', '⏱ Délai de 15 minutes dépassé — modification impossible.');
      } else {
        showFeedback('error', err.response?.data?.message || 'Erreur lors de la modification.');
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (msgId) => api.delete(`/conversations/${conversationId}/messages/${msgId}`),
    onSuccess: () => {
      qc.invalidateQueries(['messages', conversationId]);
      setDeleteTarget(null);
    },
    onError: () => showFeedback('error', 'Erreur lors de la suppression.'),
  });

  const markAsReadMutation = useMutation({
    mutationFn: (messageIds) => api.post(`/conversations/${conversationId}/read`, { messageIds }),
    onSuccess: () => {
      qc.invalidateQueries(['messages', conversationId]);
    },
  });

  // ── Marquer les messages comme lus automatiquement ────────────────
  useEffect(() => {
    if (!conversationId || !messages.length || !user) return;

    // Trouver les messages non lus qui ne sont pas envoyés par l'utilisateur actuel
    const unreadMessageIds = messages
      .filter(msg => 
        msg.sender_id !== user.id && 
        !msg.is_deleted &&
        (!msg.readBy || !msg.readBy.some(r => r.user_id === user.id))
      )
      .map(msg => msg.id);

    if (unreadMessageIds.length > 0) {
      // Marquer comme lus après un court délai (pour simuler la lecture)
      const timer = setTimeout(() => {
        markAsReadMutation.mutate(unreadMessageIds);
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [conversationId, messages, user]);

  // ── Socket : écouter les mises à jour de lecture ──────────────────
  useEffect(() => {
    if (!socket || !conversationId) return;

    const handleMessagesRead = ({ userId, messageIds }) => {
      // Mettre à jour les messages localement
      qc.invalidateQueries(['messages', conversationId]);
    };

    socket.on('messages:read', handleMessagesRead);

    return () => {
      socket.off('messages:read', handleMessagesRead);
    };
  }, [socket, conversationId, qc]);

  // ── Socket.IO ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket || !conversationId) return;

    const onNew = (data) => {
      const msg = data.message;

      // 1. Mettre à jour les messages si c'est la conversation active
      if (msg.conversation_id === conversationId) {
        qc.invalidateQueries(['messages', conversationId]);
        api.post(`/conversations/${conversationId}/read`).catch(() => {});
      }

      // 2. Remonter immédiatement la conversation en haut du cache local
      //    sans attendre l'API (comme WhatsApp)
      qc.setQueryData(['conversations'], (old) => {
        if (!old) return old;
        const convId = msg.conversation_id;
        const now    = msg.created_at || new Date().toISOString();

        // Mettre à jour la conversation avec le nouveau lastMessage + updated_at
        const updated = old.map((c) =>
          c.id === convId
            ? {
                ...c,
                lastMessage: msg,
                updated_at:  now,
                unreadCount: c.id === conversationId ? 0 : (c.unreadCount || 0) + 1,
              }
            : c
        );

        // Trier par updated_at décroissant → conversation avec nouveau message en haut
        return [...updated].sort(
          (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        );
      });
    };
    const onEdited  = () => qc.invalidateQueries(['messages', conversationId]);
    const onDeleted = () => qc.invalidateQueries(['messages', conversationId]);
    const onTyping  = ({ userId: uid, isTyping: t }) => {
      if (uid !== user.id) {
        setIsTyping((p) => ({ ...p, [uid]: t }));
        if (t) setTimeout(() => setIsTyping((p) => ({ ...p, [uid]: false })), 4000);
      }
    };

    socket.on('message:new',    onNew);
    socket.on('message:edited', onEdited);
    socket.on('message:deleted',onDeleted);
    socket.on('message:typing', onTyping);
    socket.emit('conversation:join', conversationId);

    return () => {
      socket.off('message:new',    onNew);
      socket.off('message:edited', onEdited);
      socket.off('message:deleted',onDeleted);
      socket.off('message:typing', onTyping);
    };
  }, [socket, conversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Fermer menu pièce jointe en cliquant ailleurs
  useEffect(() => {
    const h = (e) => { if (attachMenuRef.current && !attachMenuRef.current.contains(e.target)) setShowAttachMenu(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  // ── Handlers ──────────────────────────────────────────────────────

  const handleSend = useCallback(() => {
    const content = message.trim();
    if (!content) return;
    if (editingMsg) {
      editMutation.mutate({ msgId: editingMsg.id, content });
    } else {
      const body = { content, type: 'text', ...(replyTo ? { reply_to_id: replyTo.id } : {}) };
      sendMutation.mutate(body);
    }
  }, [message, editingMsg, replyTo]);

  const handleEmojiSelect = useCallback((emoji) => {
    const textarea = textareaRef.current;
    if (!textarea) { setMessage((m) => m + emoji); setShowEmojiPicker(false); return; }
    const start  = textarea.selectionStart;
    const end    = textarea.selectionEnd;
    const newVal = message.slice(0, start) + emoji + message.slice(end);
    setMessage(newVal);
    setShowEmojiPicker(false);
    setTimeout(() => { textarea.selectionStart = textarea.selectionEnd = start + emoji.length; textarea.focus(); }, 0);
  }, [message]);

  const handleMentionSelect = useCallback((member) => {
    const newVal = insertMention(message, member);
    setMessage(newVal);
    textareaRef.current?.focus();
  }, [message, insertMention]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleTyping = () => {
    emit('message:typing', { conversationId, isTyping: true });
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => emit('message:typing', { conversationId, isTyping: false }), 2000);
  };

  // ─ Envoi de fichier (upload + paste) ─────────────────────────────
  const handleFileUpload = useCallback((file) => {
    if (!file) return;
    // Vérification taille (50 Mo max)
    const MAX_SIZE = 50 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      showFeedback('error', `Fichier trop volumineux (max 50 Mo). "${file.name}" fait ${(file.size / 1024 / 1024).toFixed(1)} Mo.`);
      return;
    }
    const fd = new FormData();
    fd.append('file', file);
    if (replyTo) fd.append('reply_to_id', replyTo.id);
    sendMutation.mutate(fd);
    setShowAttachMenu(false);
  }, [replyTo, showFeedback]);

  // ─ Coller depuis le presse-papiers ───────────────────────────────
  const handlePaste = useCallback((e) => {
    if (!conversationId) return;
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.kind === 'file') {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) handleFileUpload(file);
        setPasteHover(false);
        break;
      }
    }
  }, [conversationId, handleFileUpload]);

  // ─ Drag & drop (bonus) ───────────────────────────────────────────
  const handleDragOver = useCallback((e) => {
    if (!conversationId) return;
    e.preventDefault();
    const file = e.dataTransfer?.items?.[0];
    setPasteHover(true);
    setPasteFileName(file?.getAsFile?.()?.name || '');
  }, [conversationId]);

  const handleDragLeave = useCallback((e) => {
    // Éviter les faux leave sur les enfants
    if (!chatAreaRef.current?.contains(e.relatedTarget)) {
      setPasteHover(false);
      setPasteFileName('');
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setPasteHover(false);
    setPasteFileName('');
    if (!conversationId) return;
    const file = e.dataTransfer?.files?.[0];
    if (file) handleFileUpload(file);
  }, [conversationId, handleFileUpload]);

  const handleEditStart  = (msg) => { setEditingMsg(msg); setMessage(msg.content || ''); setReplyTo(null); };
  const handleEditCancel = ()    => { setEditingMsg(null); setMessage(''); };
  const handleVoiceSend  = ()    => { recorder.stop(); };
  const handleVoiceCancel= ()    => { recorder.cancel(); };

  const handleCall = (type) => {
    if (!activeConv) return;
  
    if (activeConv.type === 'direct') {
      // ── Appel direct 1-1 ────────────────────────────────────────────
      const other = activeConv.members?.find((m) => m.id !== user.id);
      if (!other) return;
      window.__capEpacInitiateCall?.(other.id, other.display_name, type);
      emit('call:initiate', { calleeId: other.id, type });
  
    } 
    else {
     
      const firstOther = activeConv.members?.find((m) => m.id !== user.id);
      const groupName  = activeConv.name || 'Groupe';
  
      // Afficher le modal sortant côté appelant
      window.__capEpacInitiateCall?.(
        firstOther?.id || 'group',
        groupName,
        type
      );
  
      emit('call:initiate', {
        calleeId:       firstOther?.id || '', // callee principal (pour compat DB)
        type,
        conversationId: activeConv.id,        
      });
    }
  };

  const typingUsers    = activeConv?.members?.filter((m) => m.id !== user.id && isTyping[m.id]);
  const otherMember    = activeConv?.type === 'direct' ? activeConv.members?.find((m) => m.id !== user.id) : null;
  const filteredConvs  = conversations.filter((c) => {
    const other = c.members?.find((m) => m.id !== user.id);
    const name  = c.type === 'direct' ? other?.display_name : c.name;
    return name?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // ─── Render ───────────────────────────────────────────────────────
  return (
    <div className="flex h-full" onPaste={handlePaste}>

      {/* ── Liste des conversations ─────────────────────────────── */}
      <div className={`
        w-full md:w-80 flex flex-col border-r border-slate-200 bg-white
        ${conversationId ? 'hidden md:flex' : 'flex'}
      `}>
        <div className="p-4 border-b border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-slate-800">Messages</h2>
            <button onClick={() => setShowNewConv(true)} className="btn-icon text-primary-600 hover:bg-primary-50">
              <Plus className="w-5 h-5" />
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input className="input pl-9 text-sm py-2" placeholder="Rechercher..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {convsLoading
            ? <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary-500" /></div>
            : filteredConvs.length === 0
            ? <div className="text-center py-12 text-slate-400"><MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-40" /><p className="text-sm">Aucune conversation</p></div>
            : filteredConvs.map((conv) => (
              <ConversationItem key={conv.id} conv={conv} isActive={conv.id === conversationId} currentUserId={user.id} onClick={() => navigate(`/chat/${conv.id}`)} />
            ))
          }
        </div>
      </div>

      {/* ── Zone de chat ────────────────────────────────────────── */}
      {conversationId && activeConv ? (
        <div
          ref={chatAreaRef}
          className="flex-1 flex flex-col bg-white relative"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {/* Overlay drag & drop */}
          {pasteHover && <PasteDropOverlay fileName={pasteFileName} />}

          {/* Header */}
          <div className="flex items-center gap-3 px-4 md:px-5 py-3.5 border-b border-slate-100 shadow-sm">
            <button onClick={() => navigate('/chat')} className="md:hidden btn-icon text-slate-500">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="relative">
              {otherMember
                ? <><Avatar user={otherMember} size="md" /><PresenceBadge status={otherMember.presence_status} /></>
                : <div className="w-10 h-10 rounded-full bg-primary-600 flex items-center justify-center text-white font-semibold">{activeConv.name?.charAt(0)||'#'}</div>
              }
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-slate-800">{otherMember?.display_name || activeConv.name}</h3>
              <p className="text-xs text-slate-500">
                {otherMember
                  ? otherMember.presence_status === 'online' ? '● En ligne' : otherMember.presence_status === 'away' ? '● Absent' : '● Hors ligne'
                  : `${activeConv.members?.length} membres`
                }
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => handleCall('audio')} className="btn-icon text-primary-600 hover:bg-primary-50"><Phone className="w-5 h-5" /></button>
              <button onClick={() => handleCall('video')} className="btn-icon text-primary-600 hover:bg-primary-50"><Video className="w-5 h-5" /></button>
              <button
                onClick={() => setShowMeeting(true)}
                className="btn-icon text-primary-600 hover:bg-primary-50"
                title="Démarrer une visioconférence"
              >
                <Users className="w-5 h-5" />
              </button>
              {activeConv?.type === 'group' && (
                <button onClick={() => setShowGroupSettings(true)} className="btn-icon text-slate-500 hover:bg-slate-100 hover:text-primary-600" title="Paramètres du groupe">
                  <Settings className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 md:px-5 py-4">
            {msgsLoading
              ? <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary-500" /></div>
              : messages.length === 0
              ? <div className="flex flex-col items-center justify-center h-full text-slate-400">
                  <MessageSquare className="w-14 h-14 mb-3 opacity-30" />
                  <p className="font-medium">Aucun message</p>
                  <p className="text-sm mt-1">Envoyez le premier message !</p>
                </div>
              : messages.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  msg={msg}
                  currentUserId={user.id}
                  onReply={(m) => { setReplyTo(m); setEditingMsg(null); }}
                  onEdit={handleEditStart}
                  onDelete={(m) => setDeleteTarget(m)}
                />
              ))
            }

            {/* Indicateur de saisie */}
            {typingUsers?.length > 0 && (
              <div className="flex items-center gap-2 pl-10 mb-3">
                <div className="flex gap-1 bg-white border border-slate-200 rounded-2xl px-3 py-2 shadow-sm">
                  {[0,150,300].map((d) => <span key={d} className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />)}
                </div>
                <span className="text-xs text-slate-400">{typingUsers[0]?.display_name} écrit…</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Zone de saisie */}
          {recorder.isRecording ? (
            <VoiceBar recorder={recorder} onSend={handleVoiceSend} onCancel={handleVoiceCancel} />
          ) : (
            <div className="border-t border-slate-100 px-4 py-3 bg-white">
              {/* Bannière Réponse */}
              {replyTo && (
                <div className="flex items-center gap-2 mb-2 px-3 py-2 bg-primary-50 rounded-lg border-l-2 border-primary-400">
                  <Reply className="w-3.5 h-3.5 text-primary-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-medium text-primary-700">{replyTo.sender?.display_name}</span>
                    <p className="text-xs text-slate-600 truncate">
                      {replyTo.type !== 'text' ? `📎 ${replyTo.file_name || 'Fichier'}` : replyTo.content}
                    </p>
                  </div>
                  <button onClick={() => setReplyTo(null)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
                </div>
              )}

              {/* Bannière Édition */}
              {editingMsg && (
                <div className="flex items-center gap-2 mb-2 px-3 py-2 bg-yellow-50 rounded-lg border-l-2 border-yellow-400">
                  <Edit2 className="w-3.5 h-3.5 text-yellow-600 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-medium text-yellow-700">Modification</span>
                    <p className="text-xs text-slate-600 truncate">{editingMsg.content}</p>
                  </div>
                  <button onClick={handleEditCancel} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
                </div>
              )}

              {/* Indice paste (affiché uniquement quand une conversation est active) */}
              <div className="flex items-end gap-2 relative">
                {/* Bouton pièces jointes */}
                <div className="relative" ref={attachMenuRef}>
                  <button
                    onClick={() => setShowAttachMenu(!showAttachMenu)}
                    className={`btn-icon self-end mb-0.5 transition-colors ${showAttachMenu ? 'text-primary-600 bg-primary-50' : 'text-slate-500 hover:text-primary-600 hover:bg-primary-50'}`}
                    title="Joindre un fichier (ou Ctrl+V pour coller)"
                  >
                    <Paperclip className="w-5 h-5" />
                  </button>

                  {/* Menu pièces jointes */}
                  {showAttachMenu && (
                    <div className="absolute bottom-12 left-0 bg-white rounded-2xl shadow-xl border border-slate-100 p-2 space-y-1 z-10 min-w-[160px]">
                      {[
                        { label: 'Image',    icon: Image,    accept: 'image/*',                                                    ref: imageInputRef, color: 'text-primary-600 bg-primary-50' },
                        { label: 'Vidéo',    icon: Film,     accept: 'video/*',                                                    ref: videoInputRef, color: 'text-purple-600 bg-purple-50' },
                        { label: 'Document', icon: FileText, accept: '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.txt,.csv', ref: fileInputRef,  color: 'text-blue-600 bg-blue-50' },
                        { label: 'Audio',    icon: Music,    accept: 'audio/*',                                                    ref: null,          color: 'text-pink-600 bg-pink-50' },
                      ].map(({ label, icon: Icon, accept, ref: inputRef, color }) => (
                        <button key={label}
                          onClick={() => {
                            if (inputRef) {
                              inputRef.current.click();
                            } else {
                              const inp = document.createElement('input');
                              inp.type = 'file'; inp.accept = accept;
                              inp.onchange = (e) => handleFileUpload(e.target.files[0]);
                              inp.click();
                            }
                            setShowAttachMenu(false);
                          }}
                          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors text-left"
                        >
                          <span className={`w-8 h-8 rounded-full flex items-center justify-center ${color.split(' ')[1]}`}>
                            <Icon className={`w-4 h-4 ${color.split(' ')[0]}`} />
                          </span>
                          <span className="text-sm font-medium text-slate-700">{label}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Inputs fichiers cachés */}
                  <input ref={imageInputRef} type="file" className="hidden" accept="image/*"                                                            onChange={(e) => handleFileUpload(e.target.files[0])} />
                  <input ref={videoInputRef} type="file" className="hidden" accept="video/*"                                                            onChange={(e) => handleFileUpload(e.target.files[0])} />
                  <input ref={fileInputRef}  type="file" className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.txt,.csv"          onChange={(e) => handleFileUpload(e.target.files[0])} />
                </div>

                {/* Textarea */}
                <textarea
                  ref={textareaRef}
                  className="flex-1 input resize-none min-h-[42px] max-h-36 py-2.5 text-sm"
                  placeholder={editingMsg ? 'Modifier le message…' : 'Écrire un message… (Ctrl+V pour coller un fichier)'}
                  value={message}
                  onChange={(e) => {
                    const val = e.target.value;
                    setMessage(val);
                    handleTyping();
                    handleMentionChange(val, e.target.selectionStart);
                  }}
                  onKeyDown={handleKeyDown}
                  rows={1}
                />

                {/* Bouton emoji */}
                <div className="relative self-end mb-0.5">
                  <button
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className={`btn-icon transition-colors ${showEmojiPicker ? 'text-primary-600 bg-primary-50' : 'text-slate-500 hover:text-primary-600 hover:bg-primary-50'}`}
                    title="Emojis"
                  >
                    <Smile className="w-5 h-5" />
                  </button>
                  {showEmojiPicker && (
                    <EmojiPickerPanel onSelect={handleEmojiSelect} onClose={() => setShowEmojiPicker(false)} />
                  )}
                </div>

                {/* MentionPicker */}
                {isMentioning && activeConv?.type === 'group' && (
                  <div className="absolute bottom-full left-16 mb-1 z-20">
                    <MentionPicker
                      members={(activeConv?.members || []).filter((m) => m.id !== user.id)}
                      query={mentionQuery}
                      onSelect={handleMentionSelect}
                    />
                  </div>
                )}

                {/* Bouton micro OU envoyer */}
                {message.trim() || editingMsg ? (
                  <button
                    onClick={handleSend}
                    disabled={sendMutation.isPending || editMutation.isPending}
                    className="btn-primary px-4 py-2.5 self-end"
                  >
                    {(sendMutation.isPending || editMutation.isPending)
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Send className="w-4 h-4" />
                    }
                  </button>
                ) : (
                  <button
                    onMouseDown={async (e) => { e.preventDefault(); try { await recorder.start(); } catch { showFeedback('error', 'Accès au microphone refusé.'); } }}
                    className="btn-icon text-primary-600 hover:bg-primary-50 self-end mb-0.5"
                    title="Maintenir pour enregistrer"
                  >
                    <Mic className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Écran vide - masqué sur mobile si aucune conversation sélectionnée */
        <div className="flex-1 hidden md:flex flex-col items-center justify-center bg-gradient-to-br from-primary-50 to-white text-slate-400">
          <div className="w-20 h-20 bg-primary-100 rounded-2xl flex items-center justify-center mb-4">
            <MessageSquare className="w-10 h-10 text-primary-500" />
          </div>
          <h3 className="text-lg font-semibold text-slate-600">Sélectionnez une conversation</h3>
          <p className="text-sm mt-1">ou créez-en une nouvelle</p>
          <button onClick={() => setShowNewConv(true)} className="btn-primary mt-4">
            <Plus className="w-4 h-4" /> Nouvelle conversation
          </button>
        </div>
      )}

      {/* Paramètres groupe */}
      {showGroupSettings && activeConv?.type === 'group' && (
        <GroupSettings
          conversationId={conversationId}
          onClose={() => setShowGroupSettings(false)}
          onLeft={() => { setShowGroupSettings(false); navigate('/chat'); qc.invalidateQueries(['conversations']); }}
        />
      )}

      {/* Modal visioconférence */}
      {showMeeting && (
        <MeetingModal
          onClose={() => setShowMeeting(false)}
          conversationName={activeConv?.name || otherMember?.display_name || ''}
        />
      )}

      {/* Modal retirer message */}
      {deleteTarget && (
        <DeleteModal
          message={deleteTarget}
          onConfirm={() => deleteMutation.mutate(deleteTarget.id)}
          onClose={() => setDeleteTarget(null)}
        />
      )}

      {/* Modal nouvelle conversation */}
      {showNewConv && (
        <NewConversationModal
          onClose={() => setShowNewConv(false)}
          currentUserId={user.id}
          onCreated={(id) => { setShowNewConv(false); navigate(`/chat/${id}`); qc.invalidateQueries(['conversations']); }}
        />
      )}

      {/* Feedback modal — au-dessus de tout */}
      {feedbackNode}
    </div>
  );
}

// ─── Modal nouvelle conversation ──────────────────────────────────────────────

function NewConversationModal({ onClose, currentUserId, onCreated }) {
  const [search,    setSearch]    = useState('');
  const [selected,  setSelected]  = useState([]);
  const [groupName, setGroupName] = useState('');
  const [loading,   setLoading]   = useState(false);
  const { show: showFeedback, node: feedbackNode } = useFeedback();

  const { data: users } = useQuery({
    queryKey: ['users-search', search],
    queryFn: () => api.get('/users', { params: { search, limit: 20 } }).then((r) => r.data.data.users),
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
    } catch {
      showFeedback('error', 'Erreur lors de la création de la conversation.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl w-full max-w-md shadow-xl max-h-[90vh] flex flex-col">
          <div className="flex items-center justify-between p-4 md:p-5 border-b flex-shrink-0">
            <h3 className="font-semibold text-base md:text-lg">Nouvelle conversation</h3>
            <button onClick={onClose}><X className="w-5 h-5 text-slate-500" /></button>
          </div>
          <div className="p-4 md:p-5 space-y-3 md:space-y-4 overflow-y-auto flex-1">
            <input className="input text-sm md:text-base" placeholder="Rechercher un utilisateur..." value={search} onChange={(e) => setSearch(e.target.value)} autoFocus />
            {selected.length > 1 && (
              <input className="input text-sm md:text-base" placeholder="Nom du groupe" value={groupName} onChange={(e) => setGroupName(e.target.value)} />
            )}
            {selected.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selected.map((u) => (
                  <span key={u.id} className="flex items-center gap-1.5 bg-primary-100 text-primary-700 text-xs px-2.5 py-1 rounded-full">
                    {u.display_name} <button onClick={() => toggle(u)}><X className="w-3 h-3" /></button>
                  </span>
                ))}
              </div>
            )}
            <div className="max-h-60 overflow-y-auto space-y-1">
              {(users || []).filter((u) => u.id !== currentUserId).map((u) => (
                <button key={u.id} onClick={() => toggle(u)}
                  className={`w-full flex items-center gap-3 p-2.5 rounded-lg transition-colors text-left
                    ${selected.find((x) => x.id === u.id) ? 'bg-primary-50 border border-primary-200' : 'hover:bg-slate-50'}`}>
                  <div className="w-9 h-9 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-sm font-semibold flex-shrink-0">
                    {u.display_name?.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{u.display_name}</p>
                    <p className="text-xs text-slate-500 truncate">@{u.username}{u.department ? ` · ${u.department}` : ''}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2 md:gap-3 p-4 md:p-5 border-t flex-shrink-0">
            <button onClick={onClose} className="btn-secondary flex-1 text-sm md:text-base">Annuler</button>
            <button onClick={handleCreate} disabled={!selected.length || loading} className="btn-primary flex-1 text-sm md:text-base">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Créer'}
            </button>
          </div>
        </div>
      </div>
      {feedbackNode}
    </>
  );
}