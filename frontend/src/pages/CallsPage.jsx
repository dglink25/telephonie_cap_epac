// src/pages/CallsPage.jsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed, Video, Clock, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import api from '../services/api';
import useAuthStore from '../store/authStore';
import useSocketStore from '../store/socketStore';
import toast from 'react-hot-toast';

const STATUS_CONFIG = {
  completed:  { label: 'Terminé',  color: 'text-primary-600',  bg: 'bg-primary-50',  icon: Phone },
  missed:     { label: 'Manqué',   color: 'text-red-500',      bg: 'bg-red-50',      icon: PhoneMissed },
  rejected:   { label: 'Refusé',   color: 'text-orange-500',   bg: 'bg-orange-50',   icon: PhoneMissed },
  failed:     { label: 'Échoué',   color: 'text-slate-500',  bg: 'bg-slate-50',  icon: PhoneMissed },
  ongoing:    { label: 'En cours', color: 'text-blue-600',   bg: 'bg-blue-50',   icon: Phone },
};

function formatCallDuration(seconds) {
  if (!seconds) return '-';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}

function CallRow({ call, currentUserId }) {
  const { socket } = useSocketStore();
  const isOutgoing = call.caller_id === currentUserId;
  const other = isOutgoing ? call.callee : call.caller;
  const config = STATUS_CONFIG[call.status] || STATUS_CONFIG.completed;

  const handleCallback = () => {
    if (!socket || !other) return;
    window.__capEpacInitiateCall?.(other.id, call.type);
    socket.emit('call:initiate', { calleeId: other.id, type: call.type });
    toast(`📞 Rappel de ${other.display_name}…`);
  };

  return (
    <div className="flex items-center gap-3 md:gap-4 px-4 md:px-5 py-3 md:py-4 hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0">
      <div className={`w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center flex-shrink-0 ${config.bg}`}>
        {isOutgoing
          ? <PhoneOutgoing className={`w-4 h-4 md:w-5 md:h-5 ${config.color}`} />
          : call.status === 'missed'
          ? <PhoneMissed className="w-4 h-4 md:w-5 md:h-5 text-red-500" />
          : <PhoneIncoming className={`w-4 h-4 md:w-5 md:h-5 ${config.color}`} />
        }
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-slate-800 text-sm md:text-base">{other?.display_name || 'Inconnu'}</span>
          {call.type === 'video' && <Video className="w-3 h-3 md:w-3.5 md:h-3.5 text-slate-400" />}
          <span className={`text-[10px] md:text-xs px-1.5 md:px-2 py-0.5 rounded-full ${config.bg} ${config.color} font-medium`}>
            {config.label}
          </span>
        </div>
        <div className="flex items-center gap-2 md:gap-3 mt-0.5">
          <span className="text-[10px] md:text-xs text-slate-500">
            {formatDistanceToNow(new Date(call.created_at), { addSuffix: true, locale: fr })}
          </span>
          {call.duration_seconds > 0 && (
            <span className="text-[10px] md:text-xs text-slate-400 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatCallDuration(call.duration_seconds)}
            </span>
          )}
        </div>
      </div>

      <button
        onClick={handleCallback}
        className="btn-icon text-primary-600 hover:bg-primary-50 flex-shrink-0"
        title="Rappeler"
      >
        <Phone className="w-4 h-4" />
      </button>
    </div>
  );
}

export default function CallsPage() {
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

  const tabs = [
    { id: 'all',       label: 'Tous' },
    { id: 'completed', label: 'Terminés' },
    { id: 'missed',    label: 'Manqués' },
    { id: 'rejected',  label: 'Refusés' },
  ];

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="px-4 md:px-6 py-4 md:py-5 border-b border-slate-100">
        <h1 className="text-lg md:text-xl font-bold text-slate-800">Journal des appels</h1>
        <p className="text-xs md:text-sm text-slate-500 mt-1">Historique de vos communications</p>
      </div>

      <div className="flex items-center gap-1 px-4 md:px-6 py-3 border-b border-slate-100 bg-slate-50 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setFilter(t.id)}
            className={`px-3 md:px-4 py-1.5 rounded-lg text-xs md:text-sm font-medium transition-colors whitespace-nowrap ${
              filter === t.id
                ? 'bg-primary-600 text-white'
                : 'text-slate-600 hover:bg-white hover:text-slate-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-7 h-7 animate-spin text-primary-500" />
          </div>
        ) : calls.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Phone className="w-14 h-14 mb-4 opacity-30" />
            <p className="font-medium text-slate-600">Aucun appel</p>
          </div>
        ) : (
          calls.map((call) => (
            <CallRow key={call.id} call={call} currentUserId={user.id} />
          ))
        )}
      </div>
    </div>
  );
}
