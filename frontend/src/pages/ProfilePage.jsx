// src/pages/ProfilePage.jsx
import { useState, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Camera, Save, Lock, Loader2, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import useAuthStore from '../store/authStore';
import useSocketStore from '../store/socketStore';

const PRESENCE_OPTIONS = [
  { value: 'online',  label: 'En ligne',         color: 'bg-green-500'  },
  { value: 'away',    label: 'Absent',             color: 'bg-yellow-400' },
  { value: 'dnd',     label: 'Ne pas déranger',   color: 'bg-red-500'    },
  { value: 'offline', label: 'Apparaître hors ligne', color: 'bg-slate-400' },
];

export default function ProfilePage() {
  const { user, updateUser } = useAuthStore();
  const { emit } = useSocketStore();
  const fileInputRef = useRef(null);

  const [profile, setProfile] = useState({
    display_name: user?.display_name || '',
    department: user?.department || '',
    phone_extension: user?.phone_extension || '',
  });

  const [passwords, setPasswords] = useState({
    current_password: '', new_password: '', confirm: '',
  });

  const [presence, setPresence] = useState(user?.presence_status || 'online');

  // Mutations
  const profileMutation = useMutation({
    mutationFn: (data) => api.put('/users/me', data),
    onSuccess: ({ data }) => {
      updateUser(data.data.user);
      toast.success('Profil mis à jour');
    },
    onError: () => toast.error('Erreur mise à jour profil'),
  });

  const avatarMutation = useMutation({
    mutationFn: (fd) => api.post('/users/me/avatar', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
    onSuccess: ({ data }) => {
      updateUser({ avatar_url: data.data.avatar_url });
      toast.success('Avatar mis à jour');
    },
    onError: () => toast.error('Erreur upload avatar'),
  });

  const presenceMutation = useMutation({
    mutationFn: (status) => api.put('/users/me/presence', { status }),
    onSuccess: (_, status) => {
      updateUser({ presence_status: status });
      emit('user:set-status', { status });
      toast.success('Statut mis à jour');
    },
  });

  const passwordMutation = useMutation({
    mutationFn: (data) => api.post('/auth/change-password', data),
    onSuccess: () => {
      toast.success('Mot de passe changé. Reconnectez-vous.');
      setPasswords({ current_password: '', new_password: '', confirm: '' });
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Erreur'),
  });

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('avatar', file);
    avatarMutation.mutate(fd);
  };

  const handlePresenceChange = (status) => {
    setPresence(status);
    presenceMutation.mutate(status);
  };

  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    if (passwords.new_password !== passwords.confirm) {
      toast.error('Les mots de passe ne correspondent pas');
      return;
    }
    passwordMutation.mutate({
      current_password: passwords.current_password,
      new_password: passwords.new_password,
    });
  };

  const letter = user?.display_name?.charAt(0)?.toUpperCase() || 'U';

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-xl font-bold text-slate-800">Mon profil</h1>

        {/* ── Avatar & Présence ───────────────────────────────── */}
        <div className="card flex items-center gap-6">
          <div className="relative flex-shrink-0">
            <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={handleAvatarChange} />
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt={user.display_name} className="w-20 h-20 rounded-full object-cover" />
            ) : (
              <div className="w-20 h-20 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-3xl font-bold">
                {letter}
              </div>
            )}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={avatarMutation.isPending}
              className="absolute -bottom-1 -right-1 w-8 h-8 bg-primary-600 hover:bg-primary-700 text-white rounded-full flex items-center justify-center shadow-md"
            >
              {avatarMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
            </button>
          </div>

          <div className="flex-1">
            <h2 className="text-lg font-semibold text-slate-800">{user?.display_name}</h2>
            <p className="text-sm text-slate-500">@{user?.username}</p>
            <span className="inline-block mt-1 text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full font-medium">
              {user?.role === 'admin' ? 'Administrateur' : 'Utilisateur'}
            </span>
          </div>
        </div>

        {/* ── Statut de présence ──────────────────────────────── */}
        <div className="card">
          <h3 className="font-semibold text-slate-800 mb-4">Statut de présence</h3>
          <div className="grid grid-cols-2 gap-2">
            {PRESENCE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => handlePresenceChange(opt.value)}
                className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${
                  presence === opt.value
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <span className={`w-3 h-3 rounded-full flex-shrink-0 ${opt.color}`} />
                <span className="text-sm font-medium text-slate-700">{opt.label}</span>
                {presence === opt.value && <Check className="w-4 h-4 text-primary-600 ml-auto" />}
              </button>
            ))}
          </div>
        </div>

        {/* ── Infos personnelles ──────────────────────────────── */}
        <div className="card">
          <h3 className="font-semibold text-slate-800 mb-4">Informations personnelles</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Nom affiché</label>
              <input
                className="input"
                value={profile.display_name}
                onChange={(e) => setProfile({ ...profile, display_name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Service / Département</label>
                <input
                  className="input"
                  value={profile.department}
                  onChange={(e) => setProfile({ ...profile, department: e.target.value })}
                  placeholder="Ex: Informatique"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Poste téléphonique</label>
                <input
                  className="input"
                  value={profile.phone_extension}
                  onChange={(e) => setProfile({ ...profile, phone_extension: e.target.value })}
                  placeholder="Ex: 1234"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Email (non modifiable)</label>
              <input className="input bg-slate-50 cursor-not-allowed" value={user?.email} readOnly />
            </div>

            <button
              onClick={() => profileMutation.mutate(profile)}
              disabled={profileMutation.isPending}
              className="btn-primary"
            >
              {profileMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" />Enregistrement...</> : <><Save className="w-4 h-4" />Enregistrer</>}
            </button>
          </div>
        </div>

        {/* ── Changer mot de passe ────────────────────────────── */}
        <div className="card">
          <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Lock className="w-4 h-4 text-primary-600" /> Changer le mot de passe
          </h3>
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Mot de passe actuel</label>
              <input
                type="password"
                className="input"
                value={passwords.current_password}
                onChange={(e) => setPasswords({ ...passwords, current_password: e.target.value })}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Nouveau mot de passe</label>
                <input
                  type="password"
                  className="input"
                  value={passwords.new_password}
                  onChange={(e) => setPasswords({ ...passwords, new_password: e.target.value })}
                  required
                  placeholder="Min. 8 car."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Confirmer</label>
                <input
                  type="password"
                  className="input"
                  value={passwords.confirm}
                  onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                  required
                />
              </div>
            </div>
            <button type="submit" disabled={passwordMutation.isPending} className="btn-primary">
              {passwordMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" />Modification...</> : 'Modifier le mot de passe'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
