// src/components/chat/GroupSettingsPanel.jsx
import { useState, useRef, useEffect } from 'react';
import {
  X, Camera, Users, UserMinus, LogOut, Edit2, Check,
  ChevronRight, Shield, Crown, Loader2, UserPlus, Search,
  Lock, AlertCircle,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';

// ── Sous-composant : badge rôle ──────────────────────────────────
function RoleBadge({ role, isCreator }) {
  if (isCreator) {
    return (
      <span className="flex items-center gap-1 text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">
        <Crown className="w-3 h-3" /> Créateur
      </span>
    );
  }
  if (role === 'admin') {
    return (
      <span className="flex items-center gap-1 text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full font-medium">
        <Shield className="w-3 h-3" /> Admin
      </span>
    );
  }
  return null;
}

// ── Sous-composant : carte membre ────────────────────────────────
function MemberCard({ member, canRemove, isMe, onRemove, removing, isCreator }) {
  const letter = member.display_name?.charAt(0)?.toUpperCase();
  const memberRole = member.ConversationMember?.role || member.conversation_member?.role;

  return (
    <div className="flex items-center gap-3 py-2.5 px-3 rounded-xl hover:bg-slate-50 group transition-colors">
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        {member.avatar_url ? (
          <img
            src={member.avatar_url}
            alt={member.display_name}
            className="w-9 h-9 rounded-full object-cover"
          />
        ) : (
          <div className="w-9 h-9 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-semibold text-sm">
            {letter}
          </div>
        )}
        <span
          className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${
            member.presence_status === 'online' ? 'bg-green-500' :
            member.presence_status === 'away' ? 'bg-yellow-400' :
            member.presence_status === 'dnd' ? 'bg-red-500' : 'bg-slate-400'
          }`}
        />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-slate-800 truncate">
            {member.display_name}
            {isMe && <span className="text-slate-400 text-xs ml-1">(moi)</span>}
          </span>
          <RoleBadge role={memberRole} isCreator={isCreator} />
        </div>
        {member.department && (
          <p className="text-xs text-slate-400 truncate">{member.department}</p>
        )}
      </div>

      {/* Bouton retirer */}
      {canRemove && !isMe && (
        <button
          onClick={() => onRemove(member)}
          disabled={removing === member.id}
          className="opacity-0 group-hover:opacity-100 btn-icon w-8 h-8 text-red-400 hover:text-red-600 hover:bg-red-50 transition-all"
          title="Retirer du groupe"
        >
          {removing === member.id
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <UserMinus className="w-4 h-4" />
          }
        </button>
      )}
    </div>
  );
}

// ── Modal ajout membres ──────────────────────────────────────────
function AddMembersModal({ conversationId, existingIds, onClose, onAdded }) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(false);

  const { data: usersData } = useQuery({
    queryKey: ['users-for-add', search],
    queryFn: () => api.get('/users', { params: { search, limit: 30 } }).then((r) => r.data.data.users),
  });

  const available = (usersData || []).filter((u) => !existingIds.includes(u.id));

  const toggle = (u) => {
    setSelected((s) =>
      s.find((x) => x.id === u.id) ? s.filter((x) => x.id !== u.id) : [...s, u]
    );
  };

  const handleAdd = async () => {
    if (!selected.length) return;
    setLoading(true);
    try {
      await api.post(`/conversations/${conversationId}/members`, {
        member_ids: selected.map((u) => u.id),
      });
      toast.success(`${selected.length} membre(s) ajouté(s)`);
      onAdded();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl">
        <div className="flex items-center justify-between p-4 border-b">
          <h4 className="font-semibold text-slate-800">Ajouter des membres</h4>
          <button onClick={onClose} className="btn-icon text-slate-500"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              className="input pl-9 py-2 text-sm"
              placeholder="Rechercher..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>

          {selected.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selected.map((u) => (
                <span key={u.id} className="flex items-center gap-1 bg-primary-100 text-primary-700 text-xs px-2 py-1 rounded-full">
                  {u.display_name}
                  <button onClick={() => toggle(u)}><X className="w-3 h-3" /></button>
                </span>
              ))}
            </div>
          )}

          <div className="max-h-52 overflow-y-auto space-y-1">
            {available.length === 0 ? (
              <p className="text-center text-slate-400 text-sm py-4">Aucun utilisateur disponible</p>
            ) : available.map((u) => (
              <button
                key={u.id}
                onClick={() => toggle(u)}
                className={`w-full flex items-center gap-2.5 p-2 rounded-lg text-left transition-colors ${
                  selected.find((x) => x.id === u.id)
                    ? 'bg-primary-50 border border-primary-200'
                    : 'hover:bg-slate-50'
                }`}
              >
                <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-sm font-semibold flex-shrink-0">
                  {u.display_name?.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-800">{u.display_name}</p>
                  <p className="text-xs text-slate-400">@{u.username}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2 p-4 border-t">
          <button onClick={onClose} className="btn-secondary flex-1 py-2 text-sm">Annuler</button>
          <button
            onClick={handleAdd}
            disabled={!selected.length || loading}
            className="btn-primary flex-1 py-2 text-sm"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : `Ajouter (${selected.length})`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Composant principal ──────────────────────────────────────────
export default function GroupSettingsPanel({ conversationId, onClose, onLeft }) {
  const { user: currentUser } = useAuthStore();
  const qc = useQueryClient();

  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [removing, setRemoving] = useState(null);
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const avatarInputRef = useRef(null);

  // Charger les détails du groupe
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['conv-details', conversationId],
    queryFn: () =>
      api.get(`/conversations/${conversationId}/details`).then((r) => r.data.data),
    enabled: !!conversationId,
  });

  const conversation = data?.conversation;
  const currentUserRole = data?.currentUserRole;
  const isCreator = data?.isCreator;
  const isSystemAdmin = currentUser?.role === 'admin';
  const isGroupAdmin = currentUserRole === 'admin' || isCreator || isSystemAdmin;
  const isGroupeGeneral = conversation?.name === 'Groupe Général';

  useEffect(() => {
    if (conversation?.name) setNewName(conversation.name);
  }, [conversation?.name]);

  // Modifier le nom
  const handleSaveName = async () => {
    if (!newName.trim() || newName === conversation?.name) {
      setEditingName(false);
      return;
    }
    setSavingName(true);
    try {
      await api.put(`/conversations/${conversationId}`, { name: newName.trim() });
      toast.success('Nom mis à jour');
      qc.invalidateQueries(['conv-details', conversationId]);
      qc.invalidateQueries(['conversations']);
      setEditingName(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur');
    } finally {
      setSavingName(false);
    }
  };

  // Modifier la photo du groupe
  const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('avatar', file);
    try {
      await api.put(`/conversations/${conversationId}`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success('Photo du groupe mise à jour');
      qc.invalidateQueries(['conv-details', conversationId]);
      qc.invalidateQueries(['conversations']);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur');
    }
    e.target.value = '';
  };

  // Retirer un membre
  const handleRemoveMember = async (member) => {
    if (!window.confirm(`Retirer ${member.display_name} du groupe ?`)) return;
    setRemoving(member.id);
    try {
      await api.delete(`/conversations/${conversationId}/members/${member.id}`);
      toast.success(`${member.display_name} retiré(e) du groupe`);
      refetch();
      qc.invalidateQueries(['conversations']);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur');
    } finally {
      setRemoving(null);
    }
  };

  // Quitter le groupe
  const handleLeave = async () => {
    if (!window.confirm('Quitter ce groupe ?')) return;
    try {
      await api.post(`/conversations/${conversationId}/leave`);
      toast.success('Vous avez quitté le groupe');
      qc.invalidateQueries(['conversations']);
      onLeft?.();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur');
    }
  };

  const members = conversation?.members || [];
  const existingIds = members.map((m) => m.id);

  if (isLoading) {
    return (
      <div className="w-80 border-l border-slate-200 bg-white flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
      </div>
    );
  }

  if (!conversation) return null;

  const letter = conversation.name?.charAt(0)?.toUpperCase();

  return (
    <>
      <div className="w-80 flex flex-col border-l border-slate-200 bg-white overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-100 bg-white">
          <h3 className="font-semibold text-slate-800 text-sm">Paramètres du groupe</h3>
          <button onClick={onClose} className="btn-icon text-slate-500 hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* ── Section Avatar & Nom ─────────────────────────── */}
          <div className="px-5 py-6 border-b border-slate-100 flex flex-col items-center gap-3">
            {/* Avatar groupe */}
            <div className="relative">
              {conversation.avatar_url ? (
                <img
                  src={conversation.avatar_url}
                  alt={conversation.name}
                  className="w-20 h-20 rounded-2xl object-cover shadow"
                />
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-primary-600 flex items-center justify-center text-white text-3xl font-bold shadow">
                  {letter}
                </div>
              )}
              {isGroupAdmin && !isGroupeGeneral && (
                <>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarChange}
                  />
                  <button
                    onClick={() => avatarInputRef.current?.click()}
                    className="absolute -bottom-1.5 -right-1.5 w-8 h-8 bg-primary-600 hover:bg-primary-700 text-white rounded-full flex items-center justify-center shadow-md transition-colors"
                    title="Changer la photo"
                  >
                    <Camera className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>

            {/* Nom du groupe */}
            {editingName ? (
              <div className="flex items-center gap-2 w-full">
                <input
                  className="input text-sm py-1.5 flex-1"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveName();
                    if (e.key === 'Escape') setEditingName(false);
                  }}
                  autoFocus
                />
                <button
                  onClick={handleSaveName}
                  disabled={savingName}
                  className="btn-icon w-8 h-8 bg-primary-600 text-white hover:bg-primary-700"
                >
                  {savingName ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => setEditingName(false)}
                  className="btn-icon w-8 h-8 text-slate-500 hover:bg-slate-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-slate-800 text-base">{conversation.name}</h2>
                {isGroupAdmin && !isGroupeGeneral && (
                  <button
                    onClick={() => setEditingName(true)}
                    className="btn-icon w-7 h-7 text-slate-400 hover:text-primary-600 hover:bg-primary-50"
                    title="Modifier le nom"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}

            {/* Badge Groupe Général */}
            {isGroupeGeneral && (
              <div className="flex items-center gap-1.5 text-xs text-primary-600 bg-primary-50 px-3 py-1 rounded-full">
                <Lock className="w-3 h-3" />
                Groupe système — tous les utilisateurs
              </div>
            )}

            {/* Infos membres */}
            <p className="text-xs text-slate-400">
              {members.length} membre{members.length > 1 ? 's' : ''}
            </p>
          </div>

          {/* ── Section Membres ──────────────────────────────── */}
          <div className="px-4 py-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" /> Membres
              </h4>
              {isGroupAdmin && (
                <button
                  onClick={() => setShowAddMembers(true)}
                  className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-medium"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  Ajouter
                </button>
              )}
            </div>

            <div className="space-y-0.5">
              {members.map((member) => {
                const memberRole = member.ConversationMember?.role;
                const memberIsCreator = member.id === conversation.created_by;
                const canRemoveThis =
                  isGroupAdmin &&
                  !memberIsCreator &&
                  member.id !== currentUser?.id &&
                  !isGroupeGeneral;

                return (
                  <MemberCard
                    key={member.id}
                    member={member}
                    canRemove={canRemoveThis}
                    isMe={member.id === currentUser?.id}
                    onRemove={handleRemoveMember}
                    removing={removing}
                    isCreator={memberIsCreator}
                  />
                );
              })}
            </div>
          </div>

          {/* ── Section Actions ──────────────────────────────── */}
          <div className="px-4 pb-6 pt-2 space-y-2 border-t border-slate-100 mt-2">
            {/* Quitter le groupe */}
            {!isGroupeGeneral && (
              <button
                onClick={handleLeave}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-red-500 hover:bg-red-50 text-sm font-medium transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Quitter le groupe
              </button>
            )}

            {/* Info Groupe Général */}
            {isGroupeGeneral && (
              <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-amber-50 text-amber-700 text-xs">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <p>Le Groupe Général est obligatoire. Vous ne pouvez pas le quitter.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal ajout membres */}
      {showAddMembers && (
        <AddMembersModal
          conversationId={conversationId}
          existingIds={existingIds}
          onClose={() => setShowAddMembers(false)}
          onAdded={() => {
            refetch();
            qc.invalidateQueries(['conversations']);
          }}
        />
      )}
    </>
  );
}