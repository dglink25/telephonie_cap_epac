// src/pages/AdminPage.jsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, Plus, Edit2, UserX, Shield, Loader2, X, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';

function UserRow({ user, onEdit, onToggle }) {
  return (
    <tr className="hover:bg-slate-50 transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-semibold text-sm flex-shrink-0">
            {user.display_name?.charAt(0)}
          </div>
          <div>
            <p className="text-sm font-medium text-slate-800">{user.display_name}</p>
            <p className="text-xs text-slate-500">@{user.username}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-slate-600">{user.email}</td>
      <td className="px-4 py-3 text-sm text-slate-500">{user.department || '-'}</td>
      <td className="px-4 py-3">
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
          user.role === 'admin' ? 'bg-primary-100 text-primary-700' : 'bg-slate-100 text-slate-600'
        }`}>
          {user.role === 'admin' ? 'Admin' : 'Utilisateur'}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className={`flex items-center gap-1.5 text-xs font-medium ${user.is_active ? 'text-green-600' : 'text-red-500'}`}>
          <span className={`w-2 h-2 rounded-full ${user.is_active ? 'bg-green-500' : 'bg-red-500'}`} />
          {user.is_active ? 'Actif' : 'Désactivé'}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          <button onClick={() => onEdit(user)} className="btn-icon w-8 h-8 text-slate-500 hover:text-primary-600 hover:bg-primary-50">
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => onToggle(user)}
            className={`btn-icon w-8 h-8 ${user.is_active ? 'text-slate-500 hover:text-red-600 hover:bg-red-50' : 'text-slate-500 hover:text-green-600 hover:bg-green-50'}`}
          >
            <UserX className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}

function UserModal({ user, onClose, onSaved }) {
  const [form, setForm] = useState({
    username: user?.username || '',
    email: user?.email || '',
    display_name: user?.display_name || '',
    password: '',
    role: user?.role || 'user',
    department: user?.department || '',
    phone_extension: user?.phone_extension || '',
  });
  const [loading, setLoading] = useState(false);

  const set = (f) => (e) => setForm((s) => ({ ...s, [f]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (user) {
        await api.put(`/users/admin/${user.id}`, form);
        toast.success('Utilisateur modifié');
      } else {
        await api.post('/users/admin', form);
        toast.success('Utilisateur créé');
      }
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl">
        <div className="flex items-center justify-between p-5 border-b">
          <h3 className="font-semibold">{user ? 'Modifier utilisateur' : 'Nouvel utilisateur'}</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-500" /></button>
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
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Annuler</button>
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

export default function AdminPage() {
  const qc = useQueryClient();
  const [editUser, setEditUser] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', search],
    queryFn: () => api.get('/users', { params: { search, limit: 200 } }).then((r) => r.data.data.users),
  });

  const users = data || [];

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }) =>
      is_active ? api.delete(`/users/admin/${id}`) : api.put(`/users/admin/${id}`, { is_active: true }),
    onSuccess: () => { toast.success('Utilisateur mis à jour'); qc.invalidateQueries(['admin-users']); },
    onError: () => toast.error('Erreur'),
  });

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="bg-white border-b border-slate-100 px-6 py-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary-600" /> Administration
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">Gestion des utilisateurs</p>
          </div>
          <button onClick={() => setShowCreate(true)} className="btn-primary">
            <Plus className="w-4 h-4" /> Nouvel utilisateur
          </button>
        </div>
        <input className="input max-w-sm" placeholder="Rechercher..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Utilisateur</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Email</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Service</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Rôle</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Statut</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr><td colSpan={6} className="text-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary-500 mx-auto" /></td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-10 text-slate-400">Aucun utilisateur</td></tr>
              ) : users.map((u) => (
                <UserRow
                  key={u.id}
                  user={u}
                  onEdit={setEditUser}
                  onToggle={(u) => toggleMutation.mutate({ id: u.id, is_active: u.is_active })}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate && <UserModal onClose={() => setShowCreate(false)} onSaved={() => qc.invalidateQueries(['admin-users'])} />}
      {editUser && <UserModal user={editUser} onClose={() => setEditUser(null)} onSaved={() => qc.invalidateQueries(['admin-users'])} />}
    </div>
  );
}
