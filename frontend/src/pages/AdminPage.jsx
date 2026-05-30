
import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Edit2, UserX, UserCheck, Shield, Loader2, X, Check,
  Mail, Phone, Building2, Calendar, User as UserIcon,
} from 'lucide-react';
import useAuthStore from '../store/authStore';
import api from '../services/api';
import { useFeedback } from '../components/ui/FeedbackModal';


function UserProfileModal({ user, onClose, onEdit }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { requestAnimationFrame(() => setVisible(true)); }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 220);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        background: `rgba(0,0,0,${visible ? 0.45 : 0})`,
        backdropFilter: visible ? 'blur(4px)' : 'blur(0px)',
        transition: 'background 0.22s ease, backdrop-filter 0.22s ease',
      }}
      onClick={handleClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden"
        style={{
          transform: visible ? 'scale(1) translateY(0)' : 'scale(0.94) translateY(12px)',
          opacity:   visible ? 1 : 0,
          transition: 'transform 0.22s cubic-bezier(0.34,1.4,0.64,1), opacity 0.18s ease',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800">Profil utilisateur</h3>
          <button onClick={handleClose} className="p-1 rounded-lg hover:bg-slate-100 transition-colors">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-xl flex-shrink-0">
              {user.display_name?.charAt(0)?.toUpperCase()}
            </div>
            <div>
              <p className="font-semibold text-slate-800">{user.display_name}</p>
              <p className="text-sm text-slate-500">@{user.username}</p>
              <span className={`inline-flex items-center gap-1.5 text-xs font-medium mt-1 ${user.is_active ? 'text-primary-600' : 'text-red-500'}`}>
                <span className={`w-2 h-2 rounded-full ${user.is_active ? 'bg-primary-600' : 'bg-red-500'}`} />
                {user.is_active ? 'Compte actif' : 'Compte désactivé'}
              </span>
            </div>
          </div>

          <div className="bg-slate-50 rounded-xl p-4 space-y-3">
            <ProfileRow icon={<Mail className="w-4 h-4" />}      label="Email"              value={user.email} />
            <ProfileRow icon={<Building2 className="w-4 h-4" />} label="Service"            value={user.department || '—'} />
            <ProfileRow icon={<Phone className="w-4 h-4" />}     label="Poste"              value={user.phone_extension || '—'} />
            <ProfileRow icon={<UserIcon className="w-4 h-4" />}  label="Rôle"               value={user.role === 'admin' ? 'Administrateur' : 'Utilisateur'} />
            {user.last_seen_at && (
              <ProfileRow
                icon={<Calendar className="w-4 h-4" />}
                label="Dernière connexion"
                value={new Date(user.last_seen_at).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })}
              />
            )}
          </div>
        </div>

        <div className="flex gap-3 px-5 py-4 border-t border-slate-100">
          <button onClick={handleClose} className="btn-secondary flex-1">Fermer</button>
          <button onClick={() => { handleClose(); setTimeout(() => onEdit(user), 240); }} className="btn-primary flex-1">
            <Edit2 className="w-4 h-4" /> Modifier
          </button>
        </div>
      </div>
    </div>
  );
}

function ProfileRow({ icon, label, value }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-slate-400 flex-shrink-0">{icon}</span>
      <span className="text-xs text-slate-500 w-36 flex-shrink-0">{label}</span>
      <span className="text-sm text-slate-700 font-medium break-all">{value}</span>
    </div>
  );
}


function UserRow({ user, currentUserId, onView, onEdit, onToggle }) {
  const isAdmin   = user.role === 'admin';
  const isSelf    = user.id === currentUserId;
  const canToggle = !isAdmin && !isSelf;

  return (
    <tr className="hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => onView(user)}>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-semibold text-sm flex-shrink-0">
            {user.display_name?.charAt(0)?.toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-medium text-slate-800">{user.display_name}</p>
            <p className="text-xs text-slate-500">@{user.username}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-slate-600 hidden md:table-cell">{user.email}</td>
      <td className="px-4 py-3 text-sm text-slate-500 hidden lg:table-cell">{user.department || '—'}</td>
      <td className="px-4 py-3">
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
          isAdmin ? 'bg-primary-100 text-primary-700' : 'bg-slate-100 text-slate-600'
        }`}>
          {isAdmin ? 'Admin' : 'Utilisateur'}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${user.is_active ? 'text-primary-600' : 'text-red-500'}`}>
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${user.is_active ? 'bg-primary-600' : 'bg-red-500'}`} />
          <span className="hidden sm:inline">{user.is_active ? 'Actif' : 'Désactivé'}</span>
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => onEdit(user)}
            className="btn-icon w-8 h-8 text-slate-500 hover:text-primary-600 hover:bg-primary-50"
            title="Modifier"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          {canToggle && (
            <button
              onClick={() => onToggle(user)}
              className={`btn-icon w-8 h-8 ${
                user.is_active
                  ? 'text-slate-500 hover:text-red-600 hover:bg-red-50'
                  : 'text-slate-500 hover:text-primary-600 hover:bg-primary-50'
              }`}
              title={user.is_active ? 'Désactiver le compte' : 'Activer le compte'}
            >
              {user.is_active ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

// ─────────────────────────────────────────────────────────────────
// Modal création / édition
// ─────────────────────────────────────────────────────────────────
function UserModal({ user, onClose, onSaved, showFeedback }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { requestAnimationFrame(() => setVisible(true)); }, []);

  const [form, setForm] = useState({
    username:        user?.username        || '',
    email:           user?.email           || '',
    display_name:    user?.display_name    || '',
    password:        '',
    role:            user?.role            || 'user',
    department:      user?.department      || '',
    phone_extension: user?.phone_extension || '',
  });
  const [loading, setLoading] = useState(false);

  const set = (f) => (e) => setForm((s) => ({ ...s, [f]: e.target.value }));

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 220);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (user) {
        await api.put(`/users/admin/${user.id}`, form);
      } else {
        await api.post('/users/admin', form);
      }
      onSaved();
      handleClose();
      setTimeout(() => showFeedback('success', user ? 'Utilisateur modifié avec succès.' : 'Utilisateur créé avec succès.'), 260);
    } catch (err) {
      const msg = err.response?.data?.message || 'Une erreur est survenue.';
      showFeedback('error', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        background: `rgba(0,0,0,${visible ? 0.45 : 0})`,
        backdropFilter: visible ? 'blur(4px)' : 'blur(0px)',
        transition: 'background 0.22s ease, backdrop-filter 0.22s ease',
      }}
      onClick={handleClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden"
        style={{
          transform: visible ? 'scale(1) translateY(0)' : 'scale(0.94) translateY(12px)',
          opacity:   visible ? 1 : 0,
          transition: 'transform 0.22s cubic-bezier(0.34,1.4,0.64,1), opacity 0.18s ease',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800">{user ? 'Modifier utilisateur' : 'Nouvel utilisateur'}</h3>
          <button onClick={handleClose} className="p-1 rounded-lg hover:bg-slate-100 transition-colors">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Nom affiché *</label>
              <input className="input" value={form.display_name} onChange={set('display_name')} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Identifiant *</label>
              <input className="input" value={form.username} onChange={set('username')} required disabled={!!user} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Rôle</label>
              <select className="input" value={form.role} onChange={set('role')}>
                <option value="user">Utilisateur</option>
                <option value="admin">Administrateur</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Email *</label>
              <input type="email" className="input" value={form.email} onChange={set('email')} required />
            </div>
            {!user && (
              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Mot de passe *</label>
                <input type="password" className="input" value={form.password} onChange={set('password')} required placeholder="Min. 8 car., 1 maj., 1 chiffre" />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Service</label>
              <input className="input" value={form.department} onChange={set('department')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Poste</label>
              <input className="input" value={form.phone_extension} onChange={set('phone_extension')} />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={handleClose} className="btn-secondary flex-1">Annuler</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {user ? 'Enregistrer' : 'Créer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Page principale
// ─────────────────────────────────────────────────────────────────
export default function AdminPage() {
  const qc            = useQueryClient();
  const currentUser   = useAuthStore((s) => s.user);
  const currentUserId = currentUser?.id;

  const [editUser,     setEditUser]     = useState(null);
  const [profileUser,  setProfileUser]  = useState(null);
  const [showCreate,   setShowCreate]   = useState(false);
  const [search,       setSearch]       = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  const { show: showFeedback, node: feedbackNode } = useFeedback();

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', search],
    queryFn: () =>
      api.get('/users/admin-list', { params: { search, limit: 200 } })
         .then((r) => r.data.data.users),
  });

  const allUsers = data || [];

  const users = allUsers.filter((u) => {
    if (filterStatus === 'active')   return u.is_active === true;
    if (filterStatus === 'inactive') return u.is_active === false;
    return true;
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }) =>
      api.put(`/users/admin/${id}`, { is_active: !is_active }),
    onSuccess: (_, { is_active }) => {
      qc.invalidateQueries(['admin-users']);
      showFeedback('success', is_active ? 'Compte désactivé avec succès.' : 'Compte activé avec succès.');
    },
    onError: (err) => {
      const msg = err.response?.data?.message || 'Erreur lors de la mise à jour.';
      showFeedback('error', msg);
    },
  });

  const activeCount   = allUsers.filter((u) => u.is_active === true).length;
  const inactiveCount = allUsers.filter((u) => u.is_active === false).length;

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* En-tête */}
      <div className="bg-white border-b border-slate-100 px-4 sm:px-6 py-5">
        <div className="flex items-start sm:items-center justify-between mb-4 gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary-600" /> Administration
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {allUsers.length} utilisateur{allUsers.length > 1 ? 's' : ''} —{' '}
              <span className="text-primary-600">{activeCount} actif{activeCount > 1 ? 's' : ''}</span>
              {inactiveCount > 0 && (
                <span className="text-red-500">, {inactiveCount} désactivé{inactiveCount > 1 ? 's' : ''}</span>
              )}
            </p>
          </div>
          <button onClick={() => setShowCreate(true)} className="btn-primary flex-shrink-0">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline"> Nouvel utilisateur</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input
            className="input flex-1 min-w-[160px] max-w-sm"
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
            {[
              { key: 'all',      label: 'Tous' },
              { key: 'active',   label: 'Actifs' },
              { key: 'inactive', label: 'Désactivés' },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFilterStatus(key)}
                className={`text-xs px-3 py-1 rounded-md transition-colors ${
                  filterStatus === key
                    ? 'bg-white text-slate-800 shadow-sm font-medium'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tableau */}
      <div className="flex-1 overflow-auto p-4 sm:p-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Utilisateur</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide hidden lg:table-cell">Service</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Rôle</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Statut</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr><td colSpan={6} className="text-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-primary-500 mx-auto" />
                  </td></tr>
                ) : users.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-12 text-slate-400 text-sm">
                    Aucun utilisateur trouvé
                  </td></tr>
                ) : users.map((u) => (
                  <UserRow
                    key={u.id}
                    user={u}
                    currentUserId={currentUserId}
                    onView={setProfileUser}
                    onEdit={setEditUser}
                    onToggle={(u) => toggleMutation.mutate({ id: u.id, is_active: u.is_active })}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showCreate && (
        <UserModal
          onClose={() => setShowCreate(false)}
          onSaved={() => qc.invalidateQueries(['admin-users'])}
          showFeedback={showFeedback}
        />
      )}
      {editUser && (
        <UserModal
          user={editUser}
          onClose={() => setEditUser(null)}
          onSaved={() => qc.invalidateQueries(['admin-users'])}
          showFeedback={showFeedback}
        />
      )}
      {profileUser && (
        <UserProfileModal
          user={profileUser}
          onClose={() => setProfileUser(null)}
          onEdit={(u) => { setProfileUser(null); setTimeout(() => setEditUser(u), 240); }}
        />
      )}

      {feedbackNode}
    </div>
  );
}