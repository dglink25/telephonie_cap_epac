// src/pages/ChatPage.jsx
import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Send, Paperclip, Smile, Phone, Video, Search,
  Plus, ArrowLeft, MoreVertical, Edit2, Trash2, Reply,
  MessageSquare, Loader2, X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import useAuthStore from '../store/authStore';
import useSocketStore from '../store/socketStore';
import { initiateCall } from '../services/webrtcService';
import { formatDistanceToNow, format } from 'date-fns';
import { fr } from 'date-fns/locale';

// ── Sous-composants ─────────────────────────────────────────────

function PresenceDot({ status }) {
  const map = { online: 'presence-online', away: 'presence-away', dnd: 'presence-dnd', offline: 'presence-offline' };
  return <span className={`presence-dot ${map[status] || 'presence-offline'}`} />;
}

function Avatar({ user, size = 'md' }) {
  const sizes = { sm: 'w-8 h-8 text-xs', md: 'w-10 h-10 text-sm', lg: 'w-12 h-12 text-base' };
  const letter = user?.display_name?.charAt(0)?.toUpperCase() || '?';
  if (user?.avatar_url) {
    return <img src={user.avatar_url} alt={user.display_name} className={`${sizes[size]} rounded-full object-cover flex-shrink-0`} />;
  }
  return (
    <div className={`${sizes[size]} rounded-full bg-primary-100 text-primary-700 font-semibold flex items-center justify-center flex-shrink-0`}>
      {letter}
    </div>
  );
}

function MessageBubble({ msg, currentUserId, onReply, onEdit, onDelete }) {
  const isOwn = msg.sender_id === currentUserId;
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div className={`flex gap-2 group mb-3 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
      {!isOwn && <Avatar user={msg.sender} size="sm" />}

      <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} max-w-[70%]`}>
        {!isOwn && (
          <span className="text-xs text-slate-500 mb-1 ml-1">{msg.sender?.display_name}</span>
        )}

        {msg.reply_to_id && msg.replyTo && (
          <div className={`text-xs px-3 py-1.5 rounded-lg mb-1 border-l-2 border-primary-400 bg-primary-50 text-slate-600 max-w-full`}>
            <span className="font-medium text-primary-700">{msg.replyTo.sender?.display_name}</span>
            <p className="truncate">{msg.replyTo.content}</p>
          </div>
        )}

        <div className="relative">
          {msg.is_deleted ? (
            <div className="px-4 py-2 rounded-2xl bg-slate-100 text-slate-400 text-sm italic">
              Message supprimé
            </div>
          ) : (
            <div className={isOwn ? 'msg-bubble-own' : 'msg-bubble-other'}>
              {msg.type === 'file' && (
                <a href={msg.file_url} target="_blank" rel="noopener noreferrer"
                   className={`flex items-center gap-2 text-sm ${isOwn ? 'text-primary-100' : 'text-primary-600'} hover:underline mb-1`}>
                  <Paperclip className="w-4 h-4" />
                  {msg.file_name}
                  {msg.file_size && <span className="text-xs opacity-70">({(msg.file_size / 1024).toFixed(1)} Ko)</span>}
                </a>
              )}
              {msg.content && <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>}
              {msg.is_edited && (
                <span className={`text-xs ${isOwn ? 'text-primary-200' : 'text-slate-400'} mt-0.5`}>(modifié)</span>
              )}
            </div>
          )}

          {/* Menu contextuel */}
          {!msg.is_deleted && (
            <div className={`absolute top-0 ${isOwn ? 'left-0 -translate-x-full pr-1' : 'right-0 translate-x-full pl-1'} hidden group-hover:flex items-center gap-1`}>
              <button onClick={() => onReply(msg)} className="btn-icon w-7 h-7 text-slate-400 hover:text-primary-600 hover:bg-primary-50">
                <Reply className="w-3.5 h-3.5" />
              </button>
              {isOwn && (
                <>
                  <button onClick={() => onEdit(msg)} className="btn-icon w-7 h-7 text-slate-400 hover:text-primary-600 hover:bg-primary-50">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => onDelete(msg.id)} className="btn-icon w-7 h-7 text-slate-400 hover:text-red-500 hover:bg-red-50">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        <span className="text-xs text-slate-400 mt-0.5 px-1">
          {format(new Date(msg.created_at), 'HH:mm')}
        </span>
      </div>
    </div>
  );
}

function ConversationItem({ conv, isActive, currentUserId, onClick }) {
  const other = conv.members?.find((m) => m.id !== currentUserId);
  const name = conv.type === 'direct' ? other?.display_name : conv.name;
  const avatar = conv.type === 'direct' ? other : null;

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all ${
        isActive ? 'bg-primary-50 border border-primary-200' : 'hover:bg-slate-50'
      }`}
    >
      <div className="relative">
        {avatar ? <Avatar user={avatar} size="md" /> : (
          <div className="w-10 h-10 rounded-full bg-primary-600 flex items-center justify-center text-white text-sm font-semibold">
            {name?.charAt(0) || '#'}
          </div>
        )}
        {conv.type === 'direct' && other?.presence_status && (
          <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
            other.presence_status === 'online' ? 'bg-green-500' :
            other.presence_status === 'away' ? 'bg-yellow-400' :
            other.presence_status === 'dnd' ? 'bg-red-500' : 'bg-slate-400'
          }`} />
        )}
      </div>
      <div className="flex-1 min-w-0 text-left">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-slate-800 truncate">{name}</span>
          {conv.lastMessage && (
            <span className="text-xs text-slate-400 ml-2 flex-shrink-0">
              {formatDistanceToNow(new Date(conv.lastMessage.created_at), { addSuffix: false, locale: fr })}
            </span>
          )}
        </div>
        <p className="text-xs text-slate-500 truncate mt-0.5">
          {conv.lastMessage?.is_deleted ? 'Message supprimé' : conv.lastMessage?.content || 'Aucun message'}
        </p>
      </div>
      {conv.unreadCount > 0 && (
        <span className="bg-primary-600 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[20px] text-center flex-shrink-0">
          {conv.unreadCount}
        </span>
      )}
    </button>
  );
}

// ── Page principale ─────────────────────────────────────────────

export default function ChatPage() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const { socket, on, off, emit } = useSocketStore();

  const [message, setMessage] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [editingMsg, setEditingMsg] = useState(null);
  const [isTyping, setIsTyping] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewConv, setShowNewConv] = useState(false);

  const messagesEndRef = useRef(null);
  const typingTimer = useRef(null);
  const fileInputRef = useRef(null);

  // ── Requêtes ────────────────────────────────────────────────────

  const { data: convsData, isLoading: convsLoading } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => api.get('/conversations').then((r) => r.data.data.conversations),
    refetchInterval: 30000,
  });

  const conversations = convsData || [];
  const activeConv = conversations.find((c) => c.id === conversationId);

  const { data: messagesData, isLoading: msgsLoading } = useQuery({
    queryKey: ['messages', conversationId],
    queryFn: () => api.get(`/conversations/${conversationId}/messages`).then((r) => r.data.data.messages),
    enabled: !!conversationId,
  });

  const messages = messagesData || [];

  // Mutations
  const sendMutation = useMutation({
    mutationFn: (formData) => api.post(`/conversations/${conversationId}/messages`, formData, {
      headers: formData instanceof FormData ? { 'Content-Type': 'multipart/form-data' } : {},
    }),
    onSuccess: () => {
      qc.invalidateQueries(['messages', conversationId]);
      qc.invalidateQueries(['conversations']);
      setMessage('');
      setReplyTo(null);
    },
    onError: () => toast.error('Erreur envoi message'),
  });

  const editMutation = useMutation({
    mutationFn: ({ msgId, content }) =>
      api.put(`/conversations/${conversationId}/messages/${msgId}`, { content }),
    onSuccess: () => {
      qc.invalidateQueries(['messages', conversationId]);
      setEditingMsg(null);
      setMessage('');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (msgId) => api.delete(`/conversations/${conversationId}/messages/${msgId}`),
    onSuccess: () => qc.invalidateQueries(['messages', conversationId]),
  });

  // ── Socket.IO ────────────────────────────────────────────────────

  useEffect(() => {
    if (!socket || !conversationId) return;

    const onNewMsg = (data) => {
      if (data.message.conversation_id === conversationId) {
        qc.invalidateQueries(['messages', conversationId]);
        api.post(`/conversations/${conversationId}/read`).catch(() => {});
      }
      qc.invalidateQueries(['conversations']);
    };

    const onTyping = ({ userId: uid, isTyping: typing }) => {
      if (uid !== user.id) {
        setIsTyping((prev) => ({ ...prev, [uid]: typing }));
        if (typing) setTimeout(() => setIsTyping((prev) => ({ ...prev, [uid]: false })), 4000);
      }
    };

    on('message:new', onNewMsg);
    on('message:edited', () => qc.invalidateQueries(['messages', conversationId]));
    on('message:deleted', () => qc.invalidateQueries(['messages', conversationId]));
    on('message:typing', onTyping);

    // Rejoindre la room
    emit('conversation:join', conversationId);

    return () => {
      off('message:new', onNewMsg);
      off('message:edited');
      off('message:deleted');
      off('message:typing', onTyping);
    };
  }, [socket, conversationId]);

  // Scroll vers le bas
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Handlers ─────────────────────────────────────────────────────

  const handleSend = useCallback(() => {
    const content = message.trim();
    if (!content && !editingMsg) return;

    if (editingMsg) {
      editMutation.mutate({ msgId: editingMsg.id, content });
    } else {
      sendMutation.mutate({ content, type: 'text', ...(replyTo ? { reply_to_id: replyTo.id } : {}) });
    }
  }, [message, editingMsg, replyTo]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTyping = () => {
    emit('message:typing', { conversationId, isTyping: true });
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      emit('message:typing', { conversationId, isTyping: false });
    }, 2000);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    fd.append('type', file.type.startsWith('image/') ? 'image' : 'file');
    if (replyTo) fd.append('reply_to_id', replyTo.id);
    sendMutation.mutate(fd);
    e.target.value = '';
  };

  const handleCall = (type) => {
    const other = activeConv?.members?.find((m) => m.id !== user.id);
    if (!other) return;
    // Passer le nom pour l'affichage dans le modal sortant
    window.__capEpacInitiateCall?.(other.id, other.display_name, type);
    emit('call:initiate', { calleeId: other.id, type });
  };

  // Indicateur de saisie affiché
  const typingUsers = activeConv?.members?.filter(
    (m) => m.id !== user.id && isTyping[m.id]
  );

  // Autre membre pour conv directe
  const otherMember = activeConv?.type === 'direct'
    ? activeConv.members?.find((m) => m.id !== user.id)
    : null;

  const filteredConvs = conversations.filter((c) => {
    const other = c.members?.find((m) => m.id !== user.id);
    const name = c.type === 'direct' ? other?.display_name : c.name;
    return name?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="flex h-full">
      {/* ── Liste des conversations ─────────────────────────────── */}
      <div className="w-80 flex flex-col border-r border-slate-200 bg-white">
        {/* Header */}
        <div className="p-4 border-b border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-slate-800">Messages</h2>
            <button onClick={() => setShowNewConv(true)} className="btn-icon text-primary-600 hover:bg-primary-50">
              <Plus className="w-5 h-5" />
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              className="input pl-9 text-sm py-2"
              placeholder="Rechercher..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Liste */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {convsLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary-500" /></div>
          ) : filteredConvs.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Aucune conversation</p>
            </div>
          ) : (
            filteredConvs.map((conv) => (
              <ConversationItem
                key={conv.id}
                conv={conv}
                isActive={conv.id === conversationId}
                currentUserId={user.id}
                onClick={() => navigate(`/chat/${conv.id}`)}
              />
            ))
          )}
        </div>
      </div>

      {/* ── Zone de chat ────────────────────────────────────────── */}
      {conversationId && activeConv ? (
        <div className="flex-1 flex flex-col bg-white">
          {/* Header de conversation */}
          <div className="flex items-center gap-3 px-5 py-3.5 border-b border-slate-100 bg-white shadow-sm">
            <button onClick={() => navigate('/chat')} className="md:hidden btn-icon text-slate-500">
              <ArrowLeft className="w-5 h-5" />
            </button>

            <div className="relative">
              {otherMember ? (
                <>
                  <Avatar user={otherMember} size="md" />
                  <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
                    otherMember.presence_status === 'online' ? 'bg-green-500' :
                    otherMember.presence_status === 'away' ? 'bg-yellow-400' : 'bg-slate-400'
                  }`} />
                </>
              ) : (
                <div className="w-10 h-10 rounded-full bg-primary-600 flex items-center justify-center text-white font-semibold">
                  {activeConv.name?.charAt(0) || '#'}
                </div>
              )}
            </div>

            <div className="flex-1">
              <h3 className="font-semibold text-slate-800">
                {otherMember?.display_name || activeConv.name}
              </h3>
              <p className="text-xs text-slate-500">
                {otherMember
                  ? otherMember.presence_status === 'online' ? '● En ligne'
                    : otherMember.presence_status === 'away' ? '● Absent'
                    : '● Hors ligne'
                  : `${activeConv.members?.length} membres`
                }
              </p>
            </div>

            {/* Boutons d'appel */}
            <div className="flex items-center gap-1">
              <button onClick={() => handleCall('audio')} className="btn-icon text-primary-600 hover:bg-primary-50">
                <Phone className="w-5 h-5" />
              </button>
              <button onClick={() => handleCall('video')} className="btn-icon text-primary-600 hover:bg-primary-50">
                <Video className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-1">
            {msgsLoading ? (
              <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary-500" /></div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400">
                <MessageSquare className="w-14 h-14 mb-3 opacity-30" />
                <p className="font-medium">Aucun message</p>
                <p className="text-sm mt-1">Envoyez le premier message !</p>
              </div>
            ) : (
              messages.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  msg={msg}
                  currentUserId={user.id}
                  onReply={(m) => { setReplyTo(m); setEditingMsg(null); }}
                  onEdit={(m) => { setEditingMsg(m); setMessage(m.content); setReplyTo(null); }}
                  onDelete={(id) => deleteMutation.mutate(id)}
                />
              ))
            )}

            {/* Indicateur de saisie */}
            {typingUsers?.length > 0 && (
              <div className="flex items-center gap-2 pl-10">
                <div className="flex gap-1 bg-white border border-slate-200 rounded-2xl px-3 py-2 shadow-sm">
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span className="text-xs text-slate-400">
                  {typingUsers[0]?.display_name} écrit...
                </span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Zone de saisie */}
          <div className="border-t border-slate-100 px-4 py-3 bg-white">
            {/* Réponse en cours */}
            {replyTo && (
              <div className="flex items-center gap-2 mb-2 px-3 py-2 bg-primary-50 rounded-lg border-l-2 border-primary-400">
                <Reply className="w-3.5 h-3.5 text-primary-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-medium text-primary-700">{replyTo.sender?.display_name}</span>
                  <p className="text-xs text-slate-600 truncate">{replyTo.content}</p>
                </div>
                <button onClick={() => setReplyTo(null)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Édition en cours */}
            {editingMsg && (
              <div className="flex items-center gap-2 mb-2 px-3 py-2 bg-yellow-50 rounded-lg border-l-2 border-yellow-400">
                <Edit2 className="w-3.5 h-3.5 text-yellow-600 flex-shrink-0" />
                <span className="text-xs text-yellow-700 flex-1">Mode édition</span>
                <button onClick={() => { setEditingMsg(null); setMessage(''); }} className="text-slate-400">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            <div className="flex items-end gap-2">
              {/* Pièce jointe */}
              <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect} />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="btn-icon text-slate-500 hover:text-primary-600 hover:bg-primary-50 self-end mb-0.5"
              >
                <Paperclip className="w-5 h-5" />
              </button>

              {/* Input */}
              <textarea
                className="flex-1 input resize-none min-h-[42px] max-h-32 py-2.5 text-sm"
                placeholder="Écrire un message... (Entrée pour envoyer)"
                value={message}
                onChange={(e) => { setMessage(e.target.value); handleTyping(); }}
                onKeyDown={handleKeyDown}
                rows={1}
              />

              {/* Envoyer */}
              <button
                onClick={handleSend}
                disabled={!message.trim() || sendMutation.isPending}
                className="btn-primary px-4 py-2.5 self-end"
              >
                {sendMutation.isPending
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Send className="w-4 h-4" />
                }
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* ── Écran vide ────────────────────────────────────────── */
        <div className="flex-1 flex flex-col items-center justify-center bg-gradient-to-br from-primary-50 to-white text-slate-400">
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

      {/* Modal nouvelle conversation */}
      {showNewConv && <NewConversationModal onClose={() => setShowNewConv(false)} currentUserId={user.id} onCreated={(id) => { setShowNewConv(false); navigate(`/chat/${id}`); qc.invalidateQueries(['conversations']); }} />}
    </div>
  );
}

// ── Modal nouvelle conversation ─────────────────────────────────
function NewConversationModal({ onClose, currentUserId, onCreated }) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState([]);
  const [groupName, setGroupName] = useState('');
  const [loading, setLoading] = useState(false);

  const { data: users } = useQuery({
    queryKey: ['users', search],
    queryFn: () => api.get('/users', { params: { search, limit: 20 } }).then((r) => r.data.data.users),
  });

  const filtered = (users || []).filter((u) => u.id !== currentUserId);

  const toggle = (u) => {
    setSelected((s) => s.find((x) => x.id === u.id) ? s.filter((x) => x.id !== u.id) : [...s, u]);
  };

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
    } catch (err) {
      toast.error('Erreur création conversation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between p-5 border-b">
          <h3 className="font-semibold text-slate-800">Nouvelle conversation</h3>
          <button onClick={onClose} className="btn-icon text-slate-500"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-4">
          <input className="input" placeholder="Rechercher un utilisateur..." value={search} onChange={(e) => setSearch(e.target.value)} autoFocus />

          {selected.length > 1 && (
            <input className="input" placeholder="Nom du groupe" value={groupName} onChange={(e) => setGroupName(e.target.value)} />
          )}

          {selected.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selected.map((u) => (
                <span key={u.id} className="flex items-center gap-1.5 bg-primary-100 text-primary-700 text-xs px-2.5 py-1 rounded-full">
                  {u.display_name}
                  <button onClick={() => toggle(u)}><X className="w-3 h-3" /></button>
                </span>
              ))}
            </div>
          )}

          <div className="max-h-60 overflow-y-auto space-y-1">
            {filtered.map((u) => (
              <button key={u.id} onClick={() => toggle(u)}
                className={`w-full flex items-center gap-3 p-2.5 rounded-lg transition-colors ${
                  selected.find((x) => x.id === u.id) ? 'bg-primary-50 border border-primary-200' : 'hover:bg-slate-50'
                }`}>
                <div className="w-9 h-9 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-sm font-semibold flex-shrink-0">
                  {u.display_name?.charAt(0)}
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium text-slate-800">{u.display_name}</p>
                  <p className="text-xs text-slate-500">@{u.username} {u.department ? `· ${u.department}` : ''}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-3 p-5 border-t">
          <button onClick={onClose} className="btn-secondary flex-1">Annuler</button>
          <button onClick={handleCreate} disabled={!selected.length || loading} className="btn-primary flex-1">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Créer'}
          </button>
        </div>
      </div>
    </div>
  );
}
