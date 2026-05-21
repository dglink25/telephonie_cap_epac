// src/pages/DirectoryPage.jsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Phone, Video, MessageSquare, Loader2, BookUser } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../services/api';
import useAuthStore from '../store/authStore';
import useSocketStore from '../store/socketStore';

const PRESENCE_LABELS = {
  online:  { label: 'En ligne',       dot: 'bg-green-500'  },
  away:    { label: 'Absent',          dot: 'bg-yellow-400' },
  dnd:     { label: 'Ne pas déranger', dot: 'bg-red-500'    },
  offline: { label: 'Hors ligne',      dot: 'bg-slate-400'  },
};

function UserCard({ user, currentUserId, onMessage, onCall }) {
  const presence = PRESENCE_LABELS[user.presence_status] || PRESENCE_LABELS.offline;
  const letter = user.display_name?.charAt(0)?.toUpperCase();

  return (
    <div className="card hover:shadow-md transition-shadow group">
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div className="relative flex-shrink-0">
          {user.avatar_url ? (
            <img src={user.avatar_url} alt={user.display_name} className="w-14 h-14 rounded-full object-cover" />
          ) : (
            <div className="w-14 h-14 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xl font-bold">
              {letter}
            </div>
          )}
          <span className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-white ${presence.dot}`} />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-semibold text-slate-800 leading-tight">{user.display_name}</h3>
              <p className="text-xs text-slate-500">@{user.username}</p>
            </div>
            {user.role === 'admin' && (
              <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full font-medium flex-shrink-0">
                Admin
              </span>
            )}
          </div>

          <div className="mt-1.5 space-y-0.5">
            {user.department && (
              <p className="text-xs text-slate-600">{user.department}</p>
            )}
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${presence.dot}`} />
              <span className="text-xs text-slate-500">{presence.label}</span>
            </div>
            {user.phone_extension && (
              <p className="text-xs text-slate-500">Poste: {user.phone_extension}</p>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      {user.id !== currentUserId && (
        <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-100">
          <button
            onClick={() => onMessage(user)}
            className="btn-secondary flex-1 py-1.5 text-xs"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Message
          </button>
          <button
            onClick={() => onCall(user, 'audio')}
            className="btn-primary flex-1 py-1.5 text-xs"
          >
            <Phone className="w-3.5 h-3.5" />
            Appeler
          </button>
          <button
            onClick={() => onCall(user, 'video')}
            className="btn-icon border border-primary-300 text-primary-600 hover:bg-primary-50"
            title="Appel vidéo"
          >
            <Video className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

export default function DirectoryPage() {
  const navigate = useNavigate();
  const { user: currentUser } = useAuthStore();
  const { emit } = useSocketStore();
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

  // Départements uniques pour le filtre
  const departments = [...new Set(users.map((u) => u.department).filter(Boolean))].sort();

  const handleMessage = async (user) => {
    try {
      const { data } = await api.post('/conversations', {
        type: 'direct',
        member_ids: [user.id],
      });
      navigate(`/chat/${data.data.conversation.id}`);
    } catch {
      toast.error('Impossible d\'ouvrir la conversation');
    }
  };

  const handleCall = (user, type) => {
    window.__capEpacInitiateCall?.(user.id, user.display_name, type);
    emit('call:initiate', { calleeId: user.id, type });
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-4 md:px-6 py-4 md:py-5">
        <h1 className="text-lg md:text-xl font-bold text-slate-800 mb-3 md:mb-4">Annuaire</h1>

        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              className="input pl-9 w-full"
              placeholder="Rechercher par nom, identifiant..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="input w-full md:w-48"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
          >
            <option value="">Tous les services</option>
            {departments.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Compteur */}
      <div className="px-4 md:px-6 py-3 text-sm text-slate-500">
        {isLoading ? '' : `${users.length} utilisateur${users.length > 1 ? 's' : ''}`}
      </div>

      {/* Grille */}
      <div className="flex-1 overflow-y-auto px-4 md:px-6 pb-6">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-7 h-7 animate-spin text-primary-500" />
          </div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <BookUser className="w-14 h-14 mb-4 opacity-30" />
            <p className="font-medium text-slate-600">Aucun utilisateur trouvé</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {users.map((u) => (
              <UserCard
                key={u.id}
                user={u}
                currentUserId={currentUser.id}
                onMessage={handleMessage}
                onCall={handleCall}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
