// src/pages/RegisterPage.jsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Phone, Eye, EyeOff, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';

// ── Règles de validation ───────────────────────────────────────
const PASSWORD_RULES = [
  { test: (v) => v.length >= 8,       label: 'Au moins 8 caractères' },
  { test: (v) => /[A-Z]/.test(v),     label: '1 lettre majuscule' },
  { test: (v) => /[0-9]/.test(v),     label: '1 chiffre' },
];

function validateRegister(form) {
  const errors = {};

  if (!form.display_name.trim()) {
    errors.display_name = 'Le nom affiché est requis.';
  } else if (form.display_name.trim().length < 2) {
    errors.display_name = 'Le nom doit contenir au moins 2 caractères.';
  }

  if (!form.username.trim()) {
    errors.username = 'L\'identifiant est requis.';
  } else if (form.username.trim().length < 3) {
    errors.username = 'L\'identifiant doit faire au moins 3 caractères.';
  } else if (!/^[a-zA-Z0-9._-]+$/.test(form.username)) {
    errors.username = 'Uniquement lettres, chiffres, points, tirets et underscores.';
  }

  if (!form.email.trim()) {
    errors.email = 'L\'adresse email est requise.';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
    errors.email = 'Adresse email invalide (ex : jean@cap-epac.local).';
  }

  if (!form.password) {
    errors.password = 'Le mot de passe est requis.';
  } else if (PASSWORD_RULES.some((r) => !r.test(form.password))) {
    errors.password = 'Le mot de passe ne respecte pas toutes les règles ci-dessous.';
  }

  return errors;
}

// ── Mapping des erreurs serveur ────────────────────────────────
function parseServerError(err) {
  const status  = err?.response?.status;
  const message = err?.response?.data?.message || '';

  if (!err?.response) {
    return 'Impossible de contacter le serveur. Vérifiez votre connexion réseau.';
  }

  if (status === 409) {
    if (message.toLowerCase().includes('email')) {
      return 'Cette adresse email est déjà associée à un compte. Connectez-vous ou utilisez une autre adresse.';
    }
    if (message.toLowerCase().includes('utilisateur') || message.toLowerCase().includes('username')) {
      return 'Cet identifiant est déjà pris. Veuillez en choisir un autre.';
    }
    return 'Ces informations sont déjà utilisées par un autre compte.';
  }

  if (status === 422 || status === 400) {
    return 'Certaines informations saisies sont invalides. Vérifiez le formulaire et réessayez.';
  }

  if (status >= 500) {
    return 'Une erreur serveur s\'est produite. Réessayez dans quelques instants.';
  }

  return message || 'Une erreur inattendue s\'est produite.';
}

// ── Jauge de force du mot de passe ────────────────────────────
function PasswordStrength({ value }) {
  if (!value) return null;
  const passed = PASSWORD_RULES.filter((r) => r.test(value)).length;
  const colors = ['bg-red-400', 'bg-amber-400', 'bg-yellow-400', 'bg-primary-500'];
  const labels = ['Très faible', 'Faible', 'Correct', 'Fort'];
  const idx = Math.min(passed, 3);

  return (
    <div className="mt-2 space-y-2">
      {/* Barre */}
      <div className="flex gap-1">
        {PASSWORD_RULES.map((_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-all duration-300 ${
              i < passed ? colors[idx] : 'bg-slate-200'
            }`}
          />
        ))}
      </div>
      {/* Règles */}
      <ul className="space-y-0.5">
        {PASSWORD_RULES.map((rule) => {
          const ok = rule.test(value);
          return (
            <li key={rule.label} className={`flex items-center gap-1.5 text-xs ${ok ? 'text-primary-600' : 'text-slate-400'}`}>
              <CheckCircle2 className={`w-3 h-3 flex-shrink-0 ${ok ? 'text-primary-500' : 'text-slate-300'}`} />
              {rule.label}
            </li>
          );
        })}
      </ul>
      <p className={`text-xs font-medium ${['text-red-500','text-amber-500','text-yellow-600','text-primary-600'][idx]}`}>
        Force : {labels[idx]}
      </p>
    </div>
  );
}

// ── Champ avec gestion d'erreur ───────────────────────────────
function Field({ label, required, error, touched, children, hint }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
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
  if (!message) return null;
  return (
    <div
      role="alert"
      aria-live="assertive"
      className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-800 rounded-xl px-4 py-3.5 text-sm"
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
export default function RegisterPage() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    username: '', email: '', password: '', display_name: '', department: '',
  });
  const [showPass, setShowPass]   = useState(false);
  const [loading, setLoading]     = useState(false);
  const [globalError, setGlobalError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [touched, setTouched]         = useState({});

  const handleChange = (field) => (e) => {
    const value = e.target.value;
    setForm((f) => ({ ...f, [field]: value }));
    if (touched[field]) {
      const errors = validateRegister({ ...form, [field]: value });
      setFieldErrors((prev) => ({ ...prev, [field]: errors[field] }));
    }
    if (globalError) setGlobalError('');
  };

  const handleBlur = (field) => () => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    const errors = validateRegister(form);
    setFieldErrors((prev) => ({ ...prev, [field]: errors[field] }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setGlobalError('');

    // Valider tous les champs
    const allTouched = Object.fromEntries(
      ['display_name', 'username', 'email', 'password'].map((k) => [k, true])
    );
    setTouched(allTouched);
    const errors = validateRegister(form);
    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) {
      // Scroll vers la première erreur
      const firstErrorField = document.querySelector('[aria-invalid="true"]');
      firstErrorField?.focus();
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/register', {
        username:     form.username.trim(),
        email:        form.email.trim().toLowerCase(),
        password:     form.password,
        display_name: form.display_name.trim(),
        department:   form.department.trim() || undefined,
      });
      toast.success('Compte créé avec succès ! Vous pouvez maintenant vous connecter.');
      navigate('/login');
    } catch (err) {
      const msg = parseServerError(err);
      setGlobalError(msg);
      // Scroll vers le message d'erreur
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setLoading(false);
    }
  };

  const inputClass = (field) =>
    `input ${touched[field] && fieldErrors[field] ? 'input-error ring-1 ring-red-300' : ''}`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-700 via-primary-600 to-primary-500 flex items-center justify-center p-4 py-8">
      <div className="w-full max-w-md">

        {/* En-tête */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-2xl shadow-lg mb-4">
            <Phone className="w-10 h-10 text-primary-600" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Téléphonie CAP-EPAC</h1>
          <p className="text-primary-100 mt-1 text-sm">Créer votre compte</p>
        </div>

        {/* Carte */}
        <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8">
          <h2 className="text-xl font-semibold text-slate-800 mb-1">Inscription</h2>
          <p className="text-xs text-slate-400 mb-6">Les champs marqués <span className="text-red-500">*</span> sont obligatoires.</p>

          <form onSubmit={handleSubmit} noValidate className="space-y-4">

            <ErrorBanner message={globalError} onDismiss={() => setGlobalError('')} />

            {/* Nom affiché */}
            <Field label="Nom affiché" required error={fieldErrors.display_name} touched={touched.display_name}
              hint="Votre prénom et nom tels qu'ils apparaîtront aux autres.">
              <input
                className={inputClass('display_name')}
                placeholder="Jean Dupont"
                value={form.display_name}
                onChange={handleChange('display_name')}
                onBlur={handleBlur('display_name')}
                aria-required="true"
                aria-invalid={!!(touched.display_name && fieldErrors.display_name)}
              />
            </Field>

            {/* Grille identifiant + service */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Identifiant" required error={fieldErrors.username} touched={touched.username}
                hint="Lettres, chiffres, points, tirets.">
                <input
                  className={inputClass('username')}
                  placeholder="jean.dupont"
                  value={form.username}
                  onChange={handleChange('username')}
                  onBlur={handleBlur('username')}
                  autoComplete="username"
                  aria-required="true"
                  aria-invalid={!!(touched.username && fieldErrors.username)}
                />
              </Field>

              <Field label="Service" error={null} touched={false} hint="Facultatif">
                <input
                  className="input"
                  placeholder="Informatique"
                  value={form.department}
                  onChange={handleChange('department')}
                />
              </Field>
            </div>

            {/* Email */}
            <Field label="Adresse email" required error={fieldErrors.email} touched={touched.email}
              hint="Ex : prenom.nom@cap-epac.local">
              <input
                type="email"
                className={inputClass('email')}
                placeholder="jean@cap-epac.local"
                value={form.email}
                onChange={handleChange('email')}
                onBlur={handleBlur('email')}
                autoComplete="email"
                inputMode="email"
                aria-required="true"
                aria-invalid={!!(touched.email && fieldErrors.email)}
              />
            </Field>

            {/* Mot de passe */}
            <Field label="Mot de passe" required error={fieldErrors.password} touched={touched.password}>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  className={`${inputClass('password')} pr-11`}
                  placeholder="Minimum 8 car., 1 majuscule, 1 chiffre"
                  value={form.password}
                  onChange={handleChange('password')}
                  onBlur={handleBlur('password')}
                  autoComplete="new-password"
                  aria-required="true"
                  aria-invalid={!!(touched.password && fieldErrors.password)}
                />
                <button
                  type="button"
                  className="absolute right-3 top-3.5 text-slate-400 hover:text-slate-600 transition-colors"
                  onClick={() => setShowPass((v) => !v)}
                  aria-label={showPass ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {/* Jauge toujours visible dès la frappe */}
              <PasswordStrength value={form.password} />
            </Field>

            {/* Bouton */}
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-2.5 text-base mt-2"
            >
              {loading
                ? <><Loader2 className="w-4 h-4 animate-spin" />Création du compte…</>
                : 'Créer le compte'}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-5">
            Déjà un compte ?{' '}
            <Link to="/login" className="text-primary-600 font-medium hover:underline">
              Se connecter
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}