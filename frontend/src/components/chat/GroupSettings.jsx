// src/components/chat/GroupSettings.jsx
import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  X, Users, Crown, Shield, LogOut, UserMinus, UserPlus,
  Edit2, Camera, Save, Check, AlertTriangle, Loader2, Info,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';

// ─── Sous-composants ───────────────────────────────────────────────────────

function MemberRow({ member, currentUserId, isCurrentUserAdmin, isGeneral, onRemove, onRoleChange }) {
  const memberRole  = member.ConversationMember?.role || member.conversation_member?.role || 'member';
  const isAdmin     = memberRole === 'admin';
  const isSelf      = member.id === currentUserId;
  const [confirm, setConfirm] = useState(false);

  return (
    <div className="flex items-center gap-3 py-2.5 px-1 group">
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        {member.avatar_url
          ? <img src={member.avatar_url} alt={member.display_name} className="w-10 h-10 rounded-full object-cover" />
          : <div className="w-10 h-10 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-semibold">{member.display_name?.charAt(0)}</div>
        }
        <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white
          ${member.presence_status === 'online' ? 'bg-primary-600' : member.presence_status === 'away' ? 'bg-yellow-400' : 'bg-slate-400'}`} />
      </div>

      {/* Infos */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-slate-800 truncate">
            {member.display_name}{isSelf ? ' (vous)' : ''}
          </span>
          {isAdmin && (
            <span className="flex items-center gap-0.5 text-[10px] bg-primary-100 text-primary-700 px-1.5 py-0.5 rounded-full font-medium">
              <Crown className="w-2.5 h-2.5" /> Admin
            </span>
          )}
        </div>
        {member.department && <p className="text-xs text-slate-400 truncate">{member.department}</p>}
      </div>

      {/* Actions (admin uniquement, pas soi-même, pas Groupe Général) */}
      {isCurrentUserAdmin && !isSelf && !isGeneral && (
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {/* Promouvoir/rétrograder */}
          <button
            onClick={() => onRoleChange(member.id, isAdmin ? 'member' : 'admin')}
            className={`btn-icon w-7 h-7 text-xs ${isAdmin ? 'text-yellow-600 hover:bg-yellow-50' : 'text-primary-600 hover:bg-primary-50'}`}
            title={isAdmin ? 'Retirer admin' : 'Nommer admin'}
          >
            <Shield className="w-3.5 h-3.5" />
          </button>

          {/* Retirer */}
          {!confirm
            ? <button onClick={() => setConfirm(true)} className="btn-icon w-7 h-7 text-red-400 hover:bg-red-50 hover:text-red-600" title="Retirer du groupe">
                <UserMinus className="w-3.5 h-3.5" />
              </button>
            : <div className="flex items-center gap-1">
                <button onClick={() => onRemove(member.id)} className="text-[10px] bg-red-500 text-white px-2 py-1 rounded font-medium hover:bg-red-600">Confirmer</button>
                <button onClick={() => setConfirm(false)} className="text-[10px] text-slate-500 hover:text-slate-700">✕</button>
              </div>
          }
        </div>
      )}
    </div>
  );
}

// ─── Panneau principal ─────────────────────────────────────────────────────

export default function GroupSettings({ conversationId, onClose, onLeft }) {
  const qc = useQueryClient();
  const { user: currentUser } = useAuthStore();
  const fileInputRef   = useRef(null);
  const [tab, setTab]  = useState('members'); // 'members' | 'edit'
  const [editForm, setEditForm] = useState({ name: '', description: '' });
  const [editMode, setEditMode] = useState(false);
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  // ── Requêtes ──────────────────────────────────────────────────
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['group-info', conversationId],
    queryFn: () => api.get(`/groups/${conversationId}`).then((r) => r.data.data.group),
    onSuccess: (g) => setEditForm({ name: g.name || '', description: g.description || '' }),
  });
  const group = data;

  // ── Mutations ─────────────────────────────────────────────────
  const updateMutation = useMutation({
    mutationFn: (body) => api.put(`/groups/${conversationId}`, body),
    onSuccess: () => { toast.success('Groupe mis à jour'); setEditMode(false); qc.invalidateQueries(['conversations']); refetch(); },
    onError: (e) => toast.error(e.response?.data?.message || 'Erreur'),
  });

  const avatarMutation = useMutation({
    mutationFn: (fd) => api.post(`/groups/${conversationId}/avatar`, fd, { headers: { 'Content-Type': 'multipart/form-data' } }),
    onSuccess: () => { toast.success('Photo mise à jour'); qc.invalidateQueries(['conversations']); refetch(); },
    onError: (e) => toast.error(e.response?.data?.message || 'Erreur'),
  });

  const removeMutation = useMutation({
    mutationFn: (memberId) => api.delete(`/groups/${conversationId}/members/${memberId}`),
    onSuccess: () => { toast.success('Membre retiré'); refetch(); qc.invalidateQueries(['conversations']); },
    onError: (e) => toast.error(e.response?.data?.message || 'Erreur'),
  });

  const roleMutation = useMutation({
    mutationFn: ({ memberId, role }) => api.put(`/groups/${conversationId}/members/${memberId}/role`, { role }),
    onSuccess: () => { toast.success('Rôle mis à jour'); refetch(); },
    onError: (e) => toast.error(e.response?.data?.message || 'Erreur'),
  });

  const leaveMutation = useMutation({
    mutationFn: () => api.delete(`/groups/${conversationId}/leave`),
    onSuccess: () => { toast.success('Vous avez quitté le groupe'); qc.invalidateQueries(['conversations']); onLeft?.(); onClose(); },
    onError: (e) => toast.error(e.response?.data?.message || 'Impossible de quitter'),
  });

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('avatar', file);
    avatarMutation.mutate(fd);
    e.target.value = '';
  };

  if (isLoading) return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl p-8"><Loader2 className="w-7 h-7 animate-spin text-primary-500 mx-auto" /></div>
    </div>
  );

  if (!group) return null;

  const isAdmin   = group.currentUserIsAdmin;
  const isGeneral = group.is_general;
  const members   = group.members || [];
  const initial   = group.name?.charAt(0)?.toUpperCase() || '#';

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">

        {/* ── Header ──────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">Paramètres du groupe</h2>
          <button onClick={onClose} className="btn-icon text-slate-500 hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Avatar + nom ─────────────────────────────────────── */}
        <div className="flex flex-col items-center py-6 px-5 bg-gradient-to-b from-primary-50 to-white border-b border-slate-100">
          <div className="relative mb-3">
            <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={handleAvatarChange} />
            {group.avatar_url
              ? <img src={group.avatar_url} alt={group.name} className="w-20 h-20 rounded-full object-cover shadow-md" />
              : <div className="w-20 h-20 rounded-full bg-primary-600 flex items-center justify-center text-white text-3xl font-bold shadow-md">{initial}</div>
            }
            {isAdmin && !isGeneral && (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={avatarMutation.isPending}
                className="absolute -bottom-1 -right-1 w-8 h-8 bg-primary-600 hover:bg-primary-700 text-white rounded-full flex items-center justify-center shadow-lg"
              >
                {avatarMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
              </button>
            )}
          </div>

          {!editMode ? (
            <div className="text-center">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-800">{group.name}</h3>
                {isGeneral && <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full font-medium">Général</span>}
                {isAdmin && !isGeneral && (
                  <button onClick={() => setEditMode(true)} className="btn-icon w-7 h-7 text-slate-400 hover:text-primary-600">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              {group.description && <p className="text-sm text-slate-500 mt-1">{group.description}</p>}
              <p className="text-xs text-slate-400 mt-1">{members.length} membre{members.length > 1 ? 's' : ''}</p>
            </div>
          ) : (
            <div className="w-full space-y-2 mt-1">
              <input
                className="input text-center font-semibold"
                value={editForm.name}
                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Nom du groupe"
                maxLength={100}
              />
              <textarea
                className="input resize-none text-sm"
                rows={2}
                value={editForm.description}
                onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Description (optionnel)"
              />
              <div className="flex gap-2">
                <button onClick={() => setEditMode(false)} className="btn-secondary flex-1 py-2 text-sm">Annuler</button>
                <button
                  onClick={() => updateMutation.mutate(editForm)}
                  disabled={!editForm.name.trim() || updateMutation.isPending}
                  className="btn-primary flex-1 py-2 text-sm"
                >
                  {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-3.5 h-3.5" /> Enregistrer</>}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Membres ──────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
              <Users className="w-4 h-4" /> Membres ({members.length})
            </h4>
            {isAdmin && !isGeneral && (
              <button onClick={() => setShowAddMembers(true)} className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-medium">
                <UserPlus className="w-3.5 h-3.5" /> Ajouter
              </button>
            )}
          </div>

          {/* Note Groupe Général */}
          {isGeneral && (
            <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5 mb-3 text-xs text-blue-700">
              <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <p>Tous les membres de CAP-EPAC rejoignent ce groupe automatiquement.</p>
            </div>
          )}

          <div className="divide-y divide-slate-50">
            {members.map((m) => (
              <MemberRow
                key={m.id}
                member={m}
                currentUserId={currentUser.id}
                isCurrentUserAdmin={isAdmin}
                isGeneral={isGeneral}
                onRemove={(memberId) => removeMutation.mutate(memberId)}
                onRoleChange={(memberId, role) => roleMutation.mutate({ memberId, role })}
              />
            ))}
          </div>
        </div>

        {/* ── Actions bas ──────────────────────────────────────── */}
        {!isGeneral && (
          <div className="px-5 py-4 border-t border-slate-100">
            {!showLeaveConfirm ? (
              <button
                onClick={() => setShowLeaveConfirm(true)}
                className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-red-500 hover:bg-red-50 rounded-xl transition-colors"
              >
                <LogOut className="w-4 h-4" /> Quitter le groupe
              </button>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-center text-slate-600 font-medium">Quitter ce groupe ?</p>
                <div className="flex gap-2">
                  <button onClick={() => setShowLeaveConfirm(false)} className="btn-secondary flex-1 py-2 text-sm">Annuler</button>
                  <button onClick={() => leaveMutation.mutate()} disabled={leaveMutation.isPending} className="btn-danger flex-1 py-2 text-sm">
                    {leaveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Quitter'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Modal Ajouter membres ────────────────────────────── */}
      {showAddMembers && (
        <AddMembersModal
          conversationId={conversationId}
          existingMemberIds={members.map((m) => m.id)}
          onClose={() => setShowAddMembers(false)}
          onAdded={() => { setShowAddMembers(false); refetch(); qc.invalidateQueries(['conversations']); }}
        />
      )}
    </div>
  );
}

// ─── Modal Ajouter membres ────────────────────────────────────────────────────

function AddMembersModal({ conversationId, existingMemberIds, onClose, onAdded }) {
  const [search, setSearch]   = useState('');
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(false);

  const { data: users } = useQuery({
    queryKey: ['users-add', search],
    queryFn: () => api.get('/users', { params: { search, limit: 30 } }).then((r) => r.data.data.users),
  });

  const available = (users || []).filter((u) => !existingMemberIds.includes(u.id));
  const toggle = (u) => setSelected((s) => s.find((x) => x.id === u.id) ? s.filter((x) => x.id !== u.id) : [...s, u]);

  const handleAdd = async () => {
    if (!selected.length) return;
    setLoading(true);
    try {
      await api.post(`/groups/${conversationId}/members`, { user_ids: selected.map((u) => u.id) });
      toast.success(`${selected.length} membre(s) ajouté(s)`);
      onAdded();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Erreur');
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-slate-800">Ajouter des membres</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <div className="p-4 space-y-3">
          <input className="input text-sm" placeholder="Rechercher..." value={search} onChange={(e) => setSearch(e.target.value)} autoFocus />
          {selected.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selected.map((u) => (
                <span key={u.id} className="flex items-center gap-1 bg-primary-100 text-primary-700 text-xs px-2 py-1 rounded-full">
                  {u.display_name} <button onClick={() => toggle(u)}><X className="w-3 h-3" /></button>
                </span>
              ))}
            </div>
          )}
          <div className="max-h-52 overflow-y-auto space-y-0.5">
            {available.length === 0
              ? <p className="text-sm text-center text-slate-400 py-4">Aucun utilisateur disponible</p>
              : available.map((u) => (
                <button key={u.id} onClick={() => toggle(u)}
                  className={`w-full flex items-center gap-3 p-2.5 rounded-lg transition-colors text-left
                    ${selected.find((x) => x.id === u.id) ? 'bg-primary-50' : 'hover:bg-slate-50'}`}>
                  <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-sm font-semibold flex-shrink-0">
                    {u.display_name?.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{u.display_name}</p>
                    <p className="text-xs text-slate-400 truncate">@{u.username}</p>
                  </div>
                  {selected.find((x) => x.id === u.id) && <Check className="w-4 h-4 text-primary-600 flex-shrink-0" />}
                </button>
              ))
            }
          </div>
        </div>
        <div className="flex gap-3 p-4 border-t">
          <button onClick={onClose} className="btn-secondary flex-1">Annuler</button>
          <button onClick={handleAdd} disabled={!selected.length || loading} className="btn-primary flex-1">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : `Ajouter (${selected.length})`}
          </button>
        </div>
      </div>
    </div>
  );
}
