// src/components/chat/MentionPicker.jsx
import { useEffect, useRef } from 'react';

export default function MentionPicker({ members, query, onSelect, position }) {
  const listRef = useRef(null);

  const filtered = members.filter((m) =>
    m.display_name.toLowerCase().includes(query.toLowerCase()) ||
    m.username.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 6);

  useEffect(() => {
    // Sélectionner le premier par défaut
    const first = listRef.current?.querySelector('button');
    first?.focus();
  }, [query]);

  if (!filtered.length) return null;

  return (
    <div
      className="absolute bottom-full mb-1 left-0 bg-white border border-slate-200 rounded-xl shadow-xl z-50 w-64 overflow-hidden"
      style={{ bottom: position?.bottom || '100%' }}
    >
      <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-100">
        <span className="text-xs text-slate-500 font-medium">Mentionner un membre</span>
      </div>
      <div ref={listRef} className="py-1 max-h-48 overflow-y-auto">
        {filtered.map((m) => (
          <button
            key={m.id}
            onClick={() => onSelect(m)}
            className="w-full flex items-center gap-3 px-3 py-2 hover:bg-primary-50 transition-colors text-left focus:bg-primary-50 focus:outline-none"
          >
            {/* Avatar */}
            {m.avatar_url
              ? <img src={m.avatar_url} alt={m.display_name} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
              : <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-sm font-semibold flex-shrink-0">
                  {m.display_name?.charAt(0)?.toUpperCase()}
                </div>
            }
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-800 truncate">{m.display_name}</p>
              <p className="text-xs text-slate-400 truncate">@{m.username}</p>
            </div>
            {/* Indicateur présence */}
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
              m.presence_status === 'online' ? 'bg-primary-600' :
              m.presence_status === 'away'   ? 'bg-yellow-400' : 'bg-slate-300'
            }`} />
          </button>
        ))}
      </div>
    </div>
  );
}
