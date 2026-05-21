// src/pages/LoginPage.jsx
import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Phone, Eye, EyeOff, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import useAuthStore from '../store/authStore';

// ── Validation locale ──────────────────────────────────────────
function validateLogin({ username, password }) {
  const errors = {};
  if (!username.trim()) {
    errors.username = 'L\'identifiant est requis.';
  } else if (username.trim().length < 3) {
    errors.username = 'L\'identifiant doit contenir au moins 3 caractères.';
  }
  if (!password) {
    errors.password = 'Le mot de passe est requis.';
  } else if (password.length < 6) {
    errors.password = 'Le mot de passe doit contenir au moins 6 caractères.';
  }
  return errors;
}

// ── Sous-composant : champ avec erreur ────────────────────────
function Field({ label, error, touched, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
      {children}
      {touched && error && (
        <p className="mt-1.5 flex items-start gap-1.5 text-xs text-red-600" role="alert" aria-live="polite">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}

// ── Bannière d'erreur globale ──────────────────────────────────
function ErrorBanner({ message, onDismiss }) {
  const ref = useRef(null);

  useEffect(() => {
    if (message && ref.current) {
      ref.current.focus();
    }
  }, [message]);

  if (!message) return null;

  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="alert"
      aria-live="assertive"
      className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-800 rounded-xl px-4 py-3.5 text-sm outline-none"
    >
      <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-red-500" />
      <span className="flex-1 leading-snug">{message}</span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Fermer le message d'erreur"
        className="text-red-400 hover:text-red-600 ml-1 leading-none text-lg font-light"
      >
        ×
      </button>
    </div>
  );
}

// ── Composant principal ────────────────────────────────────────
export default function LoginPage() {
  const navigate = useNavigate();
  const { login, isLoading } = useAuthStore();

  const [form, setForm]     = useState({ username: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [globalError, setGlobalError]   = useState('');
  const [fieldErrors, setFieldErrors]   = useState({});
  const [touched, setTouched]           = useState({});
  const [attemptsLeft, setAttemptsLeft] = useState(null);

  // Mapping serveur → message lisible ──────────────────────────
  const parseServerError = (err) => {
    const data = err?.response?.data;
    const status = err?.response?.status;
    const message = data?.message || '';

    // Compte verrouillé
    if (status === 403 || message.toLowerCase().includes('verrouillé')) {
      const match = message.match(/(\d+)\s*minute/);
      const minutes = match ? match[1] : '?';
      return `Compte temporairement bloqué après trop de tentatives. Réessayez dans ${minutes} minute(s).`;
    }

    // Identifiants incorrects avec tentatives restantes
    if (status === 401) {
      if (data?.attemptsLeft != null) {
        setAttemptsLeft(data.attemptsLeft);
        return `Identifiant ou mot de passe incorrect. Il vous reste ${data.attemptsLeft} tentative(s) avant le blocage du compte.`;
      }
      return 'Identifiant ou mot de passe incorrect. Vérifiez vos informations et réessayez.';
    }

    // Erreurs réseau / serveur
    if (!err?.response) {
      return 'Impossible de contacter le serveur. Vérifiez votre connexion réseau.';
    }
    if (status >= 500) {
      return 'Une erreur s\'est produite côté serveur. Veuillez réessayer dans quelques instants.';
    }

    return message || 'Une erreur inattendue s\'est produite.';
  };

  const handleChange = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
    // Révalidation à la saisie si le champ a déjà été touché
    if (touched[field]) {
      const errors = validateLogin({ ...form, [field]: e.target.value });
      setFieldErrors((prev) => ({ ...prev, [field]: errors[field] }));
    }
    // Efface l'erreur globale dès que l'utilisateur retape
    if (globalError) setGlobalError('');
    if (attemptsLeft !== null) setAttemptsLeft(null);
  };

  const handleBlur = (field) => () => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    const errors = validateLogin(form);
    setFieldErrors((prev) => ({ ...prev, [field]: errors[field] }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setGlobalError('');

    // Marquer tous les champs comme touchés pour afficher les erreurs
    setTouched({ username: true, password: true });
    const errors = validateLogin(form);
    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) return;

    const result = await login(form.username.trim(), form.password);

    if (result.success) {
      toast.success('Connexion réussie !');
      navigate('/');
    } else {
      // result vient du store — on re-fetch l'erreur brute si dispo
      // Si le store retourne déjà un message structuré on l'affiche
      setGlobalError(result.message || 'Identifiant ou mot de passe incorrect.');
    }
  };

  // Calcul des classes de l'input selon l'état ─────────────────
  const inputClass = (field) =>
    `input ${touched[field] && fieldErrors[field] ? 'input-error ring-red-300' : ''}`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-700 via-primary-600 to-primary-500 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* En-tête */}
        <div className="text-center mb-6 md:mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 md:w-20 md:h-20 bg-white rounded-2xl shadow-lg mb-3 md:mb-4">
            <Phone className="w-8 h-8 md:w-10 md:h-10 text-primary-600" />
          </div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white">Téléphonie CAP-EPAC</h1>
          <p className="text-primary-100 mt-1 text-xs md:text-sm">Système de communication réseau local</p>
        </div>

        {/* Carte */}
        <div className="bg-white rounded-2xl shadow-xl p-5 sm:p-6 md:p-8">
          <h2 className="text-lg md:text-xl font-semibold text-slate-800 mb-5 md:mb-6">Connexion</h2>

          <form onSubmit={handleSubmit} noValidate className="space-y-4 md:space-y-5">

            {/* Bannière d'erreur globale — reste jusqu'à dismiss */}
            <ErrorBanner
              message={globalError}
              onDismiss={() => { setGlobalError(''); setAttemptsLeft(null); }}
            />

            {/* Bandeau d'avertissement tentatives restantes */}
            {attemptsLeft !== null && attemptsLeft <= 2 && !globalError && (
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-3 text-sm">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-500" />
                <span>Attention : encore {attemptsLeft} tentative(s) avant le blocage temporaire de votre compte.</span>
              </div>
            )}

            {/* Identifiant */}
            <Field label="Identifiant" error={fieldErrors.username} touched={touched.username}>
              <input
                type="text"
                className={inputClass('username')}
                placeholder="Votre nom d'utilisateur"
                value={form.username}
                onChange={handleChange('username')}
                onBlur={handleBlur('username')}
                autoFocus
                autoComplete="username"
                aria-required="true"
                aria-invalid={!!(touched.username && fieldErrors.username)}
                aria-describedby={touched.username && fieldErrors.username ? 'username-error' : undefined}
              />
            </Field>

            {/* Mot de passe */}
            <Field label="Mot de passe" error={fieldErrors.password} touched={touched.password}>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  className={`${inputClass('password')} pr-11`}
                  placeholder="••••••••"
                  value={form.password}
                  onChange={handleChange('password')}
                  onBlur={handleBlur('password')}
                  autoComplete="current-password"
                  aria-required="true"
                  aria-invalid={!!(touched.password && fieldErrors.password)}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  onClick={() => setShowPass((v) => !v)}
                  aria-label={showPass ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </Field>

            {/* Bouton */}
            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full py-2.5 md:py-3 text-sm md:text-base mt-1"
            >
              {isLoading ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Connexion en cours…</>
              ) : (
                'Se connecter'
              )}
            </button>
          </form>

          <p className="text-center text-xs md:text-sm text-slate-500 mt-5 md:mt-6">
            Pas encore de compte ?{' '}
            <Link to="/register" className="text-primary-600 font-medium hover:underline">
              Créer un compte
            </Link>
          </p>
        </div>

        <p className="text-center text-primary-200 text-[10px] md:text-xs mt-4 md:mt-6">
          Communication 100 % locale — Réseau LAN sécurisé
        </p>
      </div>
    </div>
  );
}