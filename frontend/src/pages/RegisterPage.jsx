// src/pages/RegisterPage.jsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Phone, Eye, EyeOff, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    username: '', email: '', password: '', display_name: '', department: '',
  });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/register', form);
      toast.success('Compte créé ! Connectez-vous.');
      navigate('/login');
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur lors de la création du compte');
    } finally {
      setLoading(false);
    }
  };

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-700 via-primary-600 to-primary-500 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-2xl shadow-lg mb-4">
            <Phone className="w-10 h-10 text-primary-600" />
          </div>
          <h1 className="text-3xl font-bold text-white">Téléphonie CAP-EPAC</h1>
          <p className="text-primary-100 mt-1 text-sm">Créer votre compte</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h2 className="text-xl font-semibold text-slate-800 mb-6">Inscription</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
                {error}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Nom affiché *</label>
                <input className="input" placeholder="Jean Dupont" value={form.display_name} onChange={set('display_name')} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Identifiant *</label>
                <input className="input" placeholder="jean.dupont" value={form.username} onChange={set('username')} required autoComplete="username" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Service</label>
                <input className="input" placeholder="Informatique" value={form.department} onChange={set('department')} />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Email *</label>
                <input type="email" className="input" placeholder="jean@cap-epac.local" value={form.email} onChange={set('email')} required autoComplete="email" />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Mot de passe *</label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    className="input pr-11"
                    placeholder="Min. 8 car., 1 majuscule, 1 chiffre"
                    value={form.password}
                    onChange={set('password')}
                    required
                    autoComplete="new-password"
                  />
                  <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" onClick={() => setShowPass(!showPass)}>
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full py-2.5 mt-2">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Création...</> : 'Créer le compte'}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-5">
            Déjà un compte ?{' '}
            <Link to="/login" className="text-primary-600 font-medium hover:underline">Se connecter</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
