
import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Edit2, UserX, UserCheck, Shield, Loader2, X, Check,
  Mail, Phone, Building2, Calendar, User as UserIcon, Wifi, Trash2,
  AlertTriangle, Eye, EyeOff, Users, Lock,
} from 'lucide-react';
import QRCode from 'qrcode';
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
            <ProfileRow icon={<Building2 className="w-4 h-4" />} label="Service"            value={user.department || '-'} />
            <ProfileRow icon={<Phone className="w-4 h-4" />}     label="Poste"              value={user.phone_extension || '-'} />
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


function UserRow({ user, currentUserId, onView, onEdit, onToggle, onVpn, onHardDelete }) {
  const isAdmin   = user.role === 'admin';
  const isSelf    = user.id === currentUserId;
  const canToggle = !isAdmin && !isSelf;
  const canDelete = !isAdmin && !isSelf;

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
      <td className="px-4 py-3 text-sm text-slate-500 hidden lg:table-cell">{user.department || '-'}</td>
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
                  ? 'text-slate-500 hover:text-orange-600 hover:bg-orange-50'
                  : 'text-slate-500 hover:text-primary-600 hover:bg-primary-50'
              }`}
              title={user.is_active ? 'Désactiver le compte' : 'Activer le compte'}
            >
              {user.is_active ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
            </button>
          )}
          <button
            onClick={() => onVpn(user)}
            className="btn-icon w-8 h-8 text-slate-500 hover:text-primary-600 hover:bg-primary-50"
            title="Configurer VPN WireGuard"
          >
            <Wifi className="w-4 h-4" />
          </button>
          {canDelete && (
            <button
              onClick={() => onHardDelete(user)}
              className="btn-icon w-8 h-8 text-slate-500 hover:text-red-600 hover:bg-red-50"
              title="Supprimer définitivement"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}        </div>
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
  const [newDept, setNewDept] = useState(''); // pour saisir un nouveau service

  // Charger la liste des services existants
  const { data: deptData } = useQuery({
    queryKey: ['departments-list'],
    queryFn: () => api.get('/visibility/departments').then((r) => r.data.data.departments),
  });
  const departments = deptData || [];

  const set = (f) => (e) => setForm((s) => ({ ...s, [f]: e.target.value }));

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 220);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    // Si "nouveau service" saisi, l'utiliser
    const finalForm = { ...form, department: newDept.trim() || form.department };
    try {
      if (user) {
        await api.put(`/users/admin/${user.id}`, finalForm);
      } else {
        await api.post('/users/admin', finalForm);
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
              <select
                className="input"
                value={newDept ? '__new__' : (form.department || '')}
                onChange={(e) => {
                  if (e.target.value === '__new__') {
                    setNewDept('');
                  } else {
                    setForm((s) => ({ ...s, department: e.target.value }));
                    setNewDept('');
                  }
                }}
              >
                <option value="">— Aucun service —</option>
                {departments.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
                <option value="__new__">+ Nouveau service...</option>
              </select>
              {(newDept !== undefined && (form.department === '__new__' || newDept !== '' || !departments.includes(form.department) && form.department)) && (
                <input
                  className="input mt-1.5"
                  placeholder="Nom du nouveau service"
                  value={newDept || (departments.includes(form.department) ? '' : form.department)}
                  onChange={(e) => setNewDept(e.target.value)}
                />
              )}
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
// Modal VPN WireGuard
// ─────────────────────────────────────────────────────────────────
function VpnModal({ user, onClose, showFeedback }) {
  const [visible,   setVisible]   = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [config,    setConfig]    = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [copied,    setCopied]    = useState(false);

  useEffect(() => { requestAnimationFrame(() => setVisible(true)); }, []);

  const handleClose = () => { setVisible(false); setTimeout(onClose, 220); };

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const { data } = await api.post(`/vpn/generate/${user.id}`);
      const conf = data.data.config;
      setConfig(conf);
      const url = await QRCode.toDataURL(conf, { width: 300, margin: 2,
        color: { dark: '#0f172a', light: '#ffffff' } });
      setQrDataUrl(url);
    } catch (err) {
      showFeedback('error', err.response?.data?.message || 'Erreur génération VPN');
    } finally { setLoading(false); }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(config).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleRevoke = async () => {
    if (!window.confirm(`Révoquer l'accès VPN de ${user.display_name} ?`)) return;
    try {
      await api.delete(`/vpn/revoke/${user.id}`);
      showFeedback('success', 'Accès VPN révoqué');
      handleClose();
    } catch (err) {
      showFeedback('error', err.response?.data?.message || 'Erreur révocation');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        background: `rgba(0,0,0,${visible ? 0.55 : 0})`,
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
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-primary-50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary-100 flex items-center justify-center">
              <Wifi className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800">Config VPN WireGuard</h3>
              <p className="text-xs text-slate-500">{user.display_name}</p>
            </div>
          </div>
          <button onClick={handleClose} className="p-1 rounded-lg hover:bg-slate-100">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {!qrDataUrl ? (
            <>
              <p className="text-sm text-slate-600 text-center">
                Générer la configuration VPN pour permettre à{' '}
                <strong>{user.display_name}</strong> d'accéder au système hors réseau.
              </p>
              <div className="bg-blue-50 rounded-xl p-4 text-sm text-blue-700 space-y-1">
                <p className="font-medium">Comment ça marche :</p>
                <p>1. Cliquer "Générer" → QR code affiché</p>
                <p>2. Scanner avec l'app <strong>WireGuard</strong> (Android/iOS)</p>
                <p>3. Activer le VPN → accès au système depuis n'importe où</p>
              </div>
              <button
                onClick={handleGenerate}
                disabled={loading}
                className="btn-primary w-full"
              >
                {loading
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Génération...</>
                  : <><Wifi className="w-4 h-4" /> Générer la config VPN</>
                }
              </button>
            </>
          ) : (
            <>
              {/* QR Code */}
              <div className="flex justify-center">
                <div className="p-3 bg-white border-2 border-slate-200 rounded-2xl shadow-sm">
                  <img src={qrDataUrl} alt="QR Code WireGuard" className="w-56 h-56" />
                </div>
              </div>
              <p className="text-center text-sm text-slate-600">
                Scanner avec l'app <strong>WireGuard</strong> sur le téléphone
              </p>

              {/* Config texte */}
              <div className="bg-slate-900 rounded-xl p-3 relative">
                <pre className="text-xs text-green-400 font-mono overflow-x-auto whitespace-pre-wrap">
                  {config}
                </pre>
                <button
                  onClick={handleCopy}
                  className="absolute top-2 right-2 text-xs bg-slate-700 hover:bg-slate-600 text-white px-2 py-1 rounded-lg transition-colors"
                >
                  {copied ? '✓ Copié' : 'Copier'}
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleGenerate}
                  disabled={loading}
                  className="btn-secondary flex-1 text-sm"
                >
                  Régénérer
                </button>
                <button
                  onClick={handleRevoke}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-red-200"
                >
                  <Trash2 className="w-4 h-4" /> Révoquer
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Panel Visibilité inter-services
// ─────────────────────────────────────────────────────────────────
function VisibilityPanel({ showFeedback }) {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['visibility-matrix'],
    queryFn: () => api.get('/visibility/matrix').then((r) => r.data.data),
  });

  const [matrix, setMatrix]   = useState({});
  const [saving, setSaving]   = useState(false);

  useEffect(() => {
    if (data?.matrix) setMatrix(data.matrix);
  }, [data]);

  const departments = data?.departments || [];

  const toggle = (from, to) => {
    if (from === to) return; // un service se voit toujours lui-même
    setMatrix((prev) => ({
      ...prev,
      [from]: { ...prev[from], [to]: !prev[from]?.[to] },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Construire la liste des règles à partir de la matrice
      const rules = [];
      departments.forEach((from) => {
        departments.forEach((to) => {
          if (from !== to && matrix[from]?.[to]) {
            rules.push({ from, to });
          }
        });
      });
      await api.post('/visibility/matrix', { rules });
      showFeedback('success', 'Règles de visibilité enregistrées');
      refetch();
    } catch (err) {
      showFeedback('error', err.response?.data?.message || 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return (
    <div className="flex justify-center py-12">
      <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
    </div>
  );

  if (departments.length === 0) return (
    <div className="text-center py-12 text-slate-400">
      <Building2 className="w-10 h-10 mx-auto mb-2 opacity-40" />
      <p className="text-sm">Aucun service configuré</p>
      <p className="text-xs mt-1">Assignez des services aux utilisateurs d'abord</p>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Légende */}
      <div className="bg-blue-50 rounded-xl p-4 text-sm text-blue-700 space-y-1">
        <p className="font-medium flex items-center gap-2">
          <Eye className="w-4 h-4" /> Règles de visibilité inter-services
        </p>
        <p>Cocher la case signifie : les utilisateurs de la <strong>ligne</strong> peuvent voir les utilisateurs de la <strong>colonne</strong>.</p>
        <p>La relation est <strong>directionnelle</strong> — non symétrique.</p>
        <p>Un service voit toujours ses propres membres.</p>
        <p>Les utilisateurs <strong>sans service</strong> ne voient personne (sauf le Groupe Général).</p>
      </div>

      {/* Matrice */}
      <div className="bg-white rounded-xl border border-slate-100 overflow-auto shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase sticky left-0 bg-slate-50 z-10 min-w-[160px]">
                Service ↓ peut voir →
              </th>
              {departments.map((dept) => (
                <th key={dept} className="px-3 py-3 text-center text-xs font-medium text-slate-600 min-w-[100px]">
                  <div className="flex flex-col items-center gap-1">
                    <Building2 className="w-3.5 h-3.5 text-primary-400" />
                    <span className="truncate max-w-[90px]">{dept}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {departments.map((from) => (
              <tr key={from} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 sticky left-0 bg-white z-10 border-r border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-primary-100 flex items-center justify-center flex-shrink-0">
                      <Users className="w-3.5 h-3.5 text-primary-600" />
                    </div>
                    <span className="font-medium text-slate-700 text-xs">{from}</span>
                  </div>
                </td>
                {departments.map((to) => {
                  const isSelf    = from === to;
                  const isChecked = isSelf || (matrix[from]?.[to] ?? false);
                  return (
                    <td key={to} className="px-3 py-3 text-center">
                      {isSelf ? (
                        <div className="flex justify-center">
                          <div className="w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center" title="Toujours visible">
                            <Check className="w-3.5 h-3.5 text-primary-600" />
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => toggle(from, to)}
                          className={`w-6 h-6 rounded-md border-2 flex items-center justify-center mx-auto transition-colors ${
                            isChecked
                              ? 'bg-primary-500 border-primary-500 text-white'
                              : 'border-slate-300 hover:border-primary-400'
                          }`}
                          title={isChecked ? `${from} voit ${to}` : `${from} ne voit pas ${to}`}
                        >
                          {isChecked && <Check className="w-3.5 h-3.5" />}
                        </button>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Bouton sauvegarder */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary px-6"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          Enregistrer les règles
        </button>
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
  const [vpnUser,      setVpnUser]      = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [showCreate,   setShowCreate]   = useState(false);
  const [activeTab,    setActiveTab]    = useState('users'); // 'users' | 'visibility'
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

  const hardDeleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/users/admin/${id}/hard`),
    onSuccess: (_, id) => {
      qc.invalidateQueries(['admin-users']);
      setDeleteTarget(null);
      showFeedback('success', 'Utilisateur supprimé définitivement.');
    },
    onError: (err) => {
      showFeedback('error', err.response?.data?.message || 'Erreur lors de la suppression.');
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
              {allUsers.length} utilisateur{allUsers.length > 1 ? 's' : ''} -{' '}
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
          {activeTab === 'users' && (
            <>
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
            </>
          )}
        </div>

        {/* Onglets */}
        <div className="flex gap-1 mt-4 border-b border-slate-100">
          {[
            { key: 'users',      label: 'Utilisateurs',        icon: UserIcon },
            { key: 'visibility', label: 'Visibilité services',  icon: Eye },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
                activeTab === key
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Contenu selon onglet */}
      <div className="flex-1 overflow-auto p-4 sm:p-6">
        {activeTab === 'visibility' ? (
          <VisibilityPanel showFeedback={showFeedback} />
        ) : (
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
                    onVpn={setVpnUser}
                    onHardDelete={setDeleteTarget}
                  />
                ))}
              </tbody>
            </table>
          </div>
          </div>
        )}
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
      {vpnUser && (
        <VpnModal
          user={vpnUser}
          onClose={() => setVpnUser(null)}
          showFeedback={showFeedback}
        />
      )}

      {/* Modal suppression définitive */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-800">Suppression définitive</h3>
                <p className="text-sm text-slate-500">Cette action est irréversible</p>
              </div>
            </div>
            <p className="text-sm text-slate-600">
              Supprimer définitivement <strong>{deleteTarget.display_name}</strong> ?
              <br />
              <span className="text-red-500 text-xs">
                Tous ses messages, appels, et données seront supprimés.
              </span>
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="btn-secondary flex-1"
              >
                Annuler
              </button>
              <button
                onClick={() => hardDeleteMutation.mutate(deleteTarget.id)}
                disabled={hardDeleteMutation.isPending}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              >
                {hardDeleteMutation.isPending
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Trash2 className="w-4 h-4" />
                }
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {feedbackNode}
    </div>
  );
}