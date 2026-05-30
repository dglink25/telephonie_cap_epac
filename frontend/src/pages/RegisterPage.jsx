// src/pages/RegisterPage.jsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Phone, Eye, EyeOff, Loader2, AlertCircle, CheckCircle2, ChevronDown } from 'lucide-react';
import api from '../services/api';

// ── Départements disponibles ───────────────────────────────────
const DEPARTMENTS = [
  { value: '',                      label: 'Sélectionner un service…' },
  { value: 'Direction',             label: 'Direction' },
  { value: 'Responsable Division',  label: 'Responsable Division' },
  { value: 'Secrétariat',           label: 'Secrétariat' },
  { value: 'Soutien Informatique',  label: 'Soutien Informatique' },
];

// ── Règles mot de passe ────────────────────────────────────────
const PASSWORD_RULES = [
  { test: (v) => v.length >= 8,   label: 'Au moins 8 caractères' },
  { test: (v) => /[A-Z]/.test(v), label: '1 lettre majuscule' },
  { test: (v) => /[0-9]/.test(v), label: '1 chiffre' },
];

// ── Validation ─────────────────────────────────────────────────
function validate(form) {
  const errors = {};

  if (!form.display_name.trim()) {
    errors.display_name = 'Le nom complet est requis.';
  } else if (form.display_name.trim().length < 2) {
    errors.display_name = 'Le nom doit contenir au moins 2 caractères.';
  }

  if (!form.username.trim()) {
    errors.username = "L'identifiant est requis.";
  } else if (form.username.trim().length < 3) {
    errors.username = "L'identifiant doit faire au moins 3 caractères.";
  } else if (!/^[a-zA-Z0-9._-]+$/.test(form.username)) {
    errors.username = 'Lettres, chiffres, points, tirets et underscores uniquement.';
  }

  if (!form.department) {
    errors.department = 'Veuillez sélectionner votre service.';
  }

  if (!form.password) {
    errors.password = 'Le mot de passe est requis.';
  } else if (PASSWORD_RULES.some((r) => !r.test(form.password))) {
    errors.password = 'Le mot de passe ne respecte pas toutes les règles.';
  }

  return errors;
}

// ── Mapping erreurs serveur ────────────────────────────────────
function parseServerError(err) {
  if (!err?.response) return 'Impossible de contacter le serveur. Vérifiez votre connexion.';
  const { status, data } = err.response;
  const msg = data?.message || '';
  if (status === 409) {
    if (msg.toLowerCase().includes('email'))      return 'Cette adresse email est déjà associée à un compte.';
    if (msg.toLowerCase().includes('utilisateur') || msg.toLowerCase().includes('username'))
      return 'Cet identifiant est déjà pris. Veuillez en choisir un autre.';
    return 'Ces informations sont déjà utilisées par un autre compte.';
  }
  if (status === 422 || status === 400) return 'Certaines informations sont invalides. Vérifiez le formulaire.';
  if (status >= 500) return "Une erreur serveur s'est produite. Réessayez dans quelques instants.";
  return msg || "Une erreur inattendue s'est produite.";
}

// ── Jauge force mot de passe ───────────────────────────────────
function PasswordStrength({ value }) {
  if (!value) return null;
  const passed = PASSWORD_RULES.filter((r) => r.test(value)).length;
  const bar    = ['bg-red-400', 'bg-amber-400', 'bg-yellow-400', 'bg-primary-600'];
  const label  = ['Très faible', 'Faible', 'Correct', 'Fort'];
  const idx    = Math.min(passed, 3);
  return (
    <div className="mt-2 space-y-2">
      <div className="flex gap-1">
        {PASSWORD_RULES.map((_, i) => (
          <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-300 ${i < passed ? bar[idx] : 'bg-slate-200'}`} />
        ))}
      </div>
      <ul className="space-y-0.5">
        {PASSWORD_RULES.map((rule) => {
          const ok = rule.test(value);
          return (
            <li key={rule.label} className={`flex items-center gap-1.5 text-xs ${ok ? 'text-primary-600' : 'text-slate-400'}`}>
              <CheckCircle2 className={`w-3 h-3 flex-shrink-0 ${ok ? 'text-primary-600' : 'text-slate-300'}`} />
              {rule.label}
            </li>
          );
        })}
      </ul>
      <p className={`text-xs font-medium ${['text-red-500','text-amber-500','text-yellow-600','text-primary-600'][idx]}`}>
        Force : {label[idx]}
      </p>
    </div>
  );
}

// ── Champ formulaire ───────────────────────────────────────────
function Field({ label, required, error, touched, hint, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
      {touched && error && (
        <p className="mt-1.5 flex items-start gap-1.5 text-xs text-red-600" role="alert">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}

// ── Bannière erreur globale ────────────────────────────────────
function ErrorBanner({ message, onDismiss }) {
  if (!message) return null;
  return (
    <div role="alert" className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-800 rounded-xl px-4 py-3.5 text-sm">
      <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-red-500" />
      <span className="flex-1 leading-snug">{message}</span>
      <button type="button" onClick={onDismiss} aria-label="Fermer" className="text-red-400 hover:text-red-600 text-lg font-light leading-none">×</button>
    </div>
  );
}

// ── Composant principal ────────────────────────────────────────
export default function RegisterPage() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    display_name: '',
    username:     '',
    department:   '',
    password:     '',
  });
  const [showPass,     setShowPass]     = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [globalError,  setGlobalError]  = useState('');
  const [fieldErrors,  setFieldErrors]  = useState({});
  const [touched,      setTouched]      = useState({});

  const handleChange = (field) => (e) => {
    const value = e.target.value;
    setForm((f) => ({ ...f, [field]: value }));
    if (touched[field]) {
      const errs = validate({ ...form, [field]: value });
      setFieldErrors((prev) => ({ ...prev, [field]: errs[field] }));
    }
    if (globalError) setGlobalError('');
  };

  const handleBlur = (field) => () => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    const errs = validate(form);
    setFieldErrors((prev) => ({ ...prev, [field]: errs[field] }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setGlobalError('');

    const allTouched = Object.fromEntries(['display_name','username','department','password'].map((k) => [k, true]));
    setTouched(allTouched);
    const errs = validate(form);
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setLoading(true);
    try {
      await api.post('/auth/register', {
        username:     form.username.trim().toLowerCase(),
        display_name: form.display_name.trim(),
        department:   form.department,
        password:     form.password,
        // email non envoyé : le backend le compose lui-même
      });
      navigate('/login', { state: { registered: true } });
    } catch (err) {
      setGlobalError(parseServerError(err));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setLoading(false);
    }
  };

  const inputCls = (field) =>
    `input ${touched[field] && fieldErrors[field] ? 'border-red-300 ring-1 ring-red-200 focus:ring-red-300' : ''}`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-700 via-primary-600 to-primary-500 flex items-center justify-center p-4 py-6 md:py-8">
      <div className="w-full max-w-md">

        {/* En-tête */}
        <div className="text-center mb-6 md:mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 md:w-20 md:h-20 bg-white rounded-2xl shadow-lg mb-3 md:mb-4">
            <Phone className="w-8 h-8 md:w-10 md:h-10 text-primary-600" />
          </div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white">Téléphonie CAP-EPAC</h1>
          <p className="text-primary-100 mt-1 text-xs md:text-sm">Créer votre compte</p>
        </div>

        {/* Carte */}
        <div className="bg-white rounded-2xl shadow-xl p-5 sm:p-6 md:p-8">
          <h2 className="text-lg md:text-xl font-semibold text-slate-800 mb-1">Inscription</h2>
          <p className="text-xs text-slate-400 mb-5 md:mb-6">
            Les champs marqués <span className="text-red-500">*</span> sont obligatoires.
          </p>

          <form onSubmit={handleSubmit} noValidate className="space-y-3 md:space-y-4">
            <ErrorBanner message={globalError} onDismiss={() => setGlobalError('')} />

            {/* Nom complet */}
            <Field label="Nom complet" required error={fieldErrors.display_name} touched={touched.display_name}
              hint="Votre prénom et nom tels qu'ils apparaîtront aux autres.">
              <input
                className={inputCls('display_name')}
                placeholder="Votre nom complet"
                value={form.display_name}
                onChange={handleChange('display_name')}
                onBlur={handleBlur('display_name')}
                autoComplete="name"
                aria-required="true"
                aria-invalid={!!(touched.display_name && fieldErrors.display_name)}
              />
            </Field>

            {/* Identifiant */}
            <Field label="Identifiant" required error={fieldErrors.username} touched={touched.username}
              hint="Lettres, chiffres, points et tirets uniquement.">
              <input
                className={inputCls('username')}
                placeholder="votre.identifiant"
                value={form.username}
                onChange={handleChange('username')}
                onBlur={handleBlur('username')}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                aria-required="true"
                aria-invalid={!!(touched.username && fieldErrors.username)}
              />
            </Field>

            {/* Service */}
            <Field label="Service" required error={fieldErrors.department} touched={touched.department}>
              <div className="relative">
                <select
                  className={`${inputCls('department')} appearance-none pr-9`}
                  value={form.department}
                  onChange={handleChange('department')}
                  onBlur={handleBlur('department')}
                  aria-required="true"
                  aria-invalid={!!(touched.department && fieldErrors.department)}
                >
                  {DEPARTMENTS.map((d) => (
                    <option key={d.value} value={d.value} disabled={d.value === ''}>
                      {d.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-3.5 w-4 h-4 text-slate-400" />
              </div>
            </Field>

            {/* Mot de passe */}
            <Field label="Mot de passe" required error={fieldErrors.password} touched={touched.password}>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  className={`${inputCls('password')} pr-11`}
                  placeholder="Min. 8 car., 1 majuscule, 1 chiffre"
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
              <PasswordStrength value={form.password} />
            </Field>

            {/* Soumettre */}
            <button type="submit" disabled={loading} className="btn-primary w-full py-2.5 md:py-3 text-sm md:text-base mt-2">
              {loading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Création du compte…</>
                : 'Créer le compte'}
            </button>
          </form>

          <p className="text-center text-xs md:text-sm text-slate-500 mt-4 md:mt-5">
            Déjà un compte ?{' '}
            <Link to="/login" className="text-primary-600 font-medium hover:underline">Se connecter</Link>
          </p>
        </div>
      </div>
    </div>
  );
}