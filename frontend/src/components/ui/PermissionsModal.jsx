// src/components/ui/PermissionsModal.jsx
import { useState, useEffect } from 'react';
import { Mic, Video, Bell, Shield, AlertTriangle, Check, X, RefreshCw, ChevronDown, ChevronUp, Lock, AlertCircle, HelpCircle } from 'lucide-react';

const isSecureContext = () =>
  window.isSecureContext ||
  window.location.protocol === 'https:' ||
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1';

const checkPermission = async (name) => {
  try {
    if (!navigator.permissions) return 'unknown';
    const r = await navigator.permissions.query({ name });
    return r.state;
  } catch { return 'unknown'; }
};

const requestPermission = async (type) => {
  try {
    if (type === 'microphone') {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      s.getTracks().forEach((t) => t.stop());
      return 'granted';
    }
    if (type === 'camera') {
      const s = await navigator.mediaDevices.getUserMedia({ video: true });
      s.getTracks().forEach((t) => t.stop());
      return 'granted';
    }
    if (type === 'notifications') {
      const r = await Notification.requestPermission();
      return r === 'granted' ? 'granted' : 'denied';
    }
    return 'unknown';
  } catch (err) {
    if (err.name === 'NotAllowedError') return 'denied';
    if (err.name === 'NotFoundError')   return 'unavailable';
    return 'error';
  }
};

const PERMS = [
  { id: 'microphone',    label: 'Microphone',   desc: 'Requis pour les appels audio et messages vocaux', icon: Mic,   iconBg: 'bg-primary-100',  iconColor: 'text-primary-600',  required: true  },
  { id: 'camera',        label: 'Caméra',        desc: 'Requis pour les appels vidéo',                    icon: Video, iconBg: 'bg-blue-100',     iconColor: 'text-blue-600',     required: false },
  { id: 'notifications', label: 'Notifications', desc: 'Recevoir des alertes pour messages et appels',    icon: Bell,  iconBg: 'bg-purple-100',   iconColor: 'text-purple-600',   required: false },
];

const STATUS = {
  granted:     { color: 'text-primary-600',  bg: 'bg-primary-50',  border: 'border-primary-200',  label: 'Accordée',         dot: 'bg-primary-600'  },
  denied:      { color: 'text-red-600',    bg: 'bg-red-50',    border: 'border-red-200',    label: 'Refusée',          dot: 'bg-red-500'    },
  prompt:      { color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200', label: 'En attente',       dot: 'bg-orange-400' },
  unknown:     { color: 'text-slate-500',  bg: 'bg-slate-50',  border: 'border-slate-200',  label: 'Non vérifiée',     dot: 'bg-slate-400'  },
  unavailable: { color: 'text-slate-400',  bg: 'bg-slate-50',  border: 'border-slate-200',  label: 'Non disponible',   dot: 'bg-slate-300'  },
  error:       { color: 'text-red-500',    bg: 'bg-red-50',    border: 'border-red-200',    label: 'Erreur',           dot: 'bg-red-400'    },
};

function PermissionRow({ config, state, onRequest, loading }) {
  const Icon = config.icon;
  const st   = STATUS[state] || STATUS.unknown;
  return (
    <div className={`flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4 p-4 rounded-xl border ${st.border} ${st.bg} transition-all`}>
      <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${config.iconBg}`}>
        <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${config.iconColor}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-0.5">
          <span className="text-sm font-semibold text-slate-800">{config.label}</span>
          {config.required && <span className="text-[10px] bg-primary-100 text-primary-700 px-1.5 py-0.5 rounded-full font-medium">Requis</span>}
          <span className={`flex items-center gap-1 text-xs font-medium ${st.color}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />{st.label}
          </span>
        </div>
        <p className="text-xs text-slate-500 leading-relaxed">{config.desc}</p>
        {state === 'denied' && (
          <p className="text-xs text-red-600 mt-1.5 font-medium">
            Cliquez sur le cadenas dans la barre d'adresse → Autorisations du site → Activer {config.label}
          </p>
        )}
      </div>
      <div className="flex-shrink-0 self-start sm:self-auto">
        {state === 'granted'     && <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center"><Check className="w-4 h-4 text-primary-600" /></div>}
        {state === 'denied'      && <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center"><X className="w-4 h-4 text-red-500" /></div>}
        {state === 'unavailable' && <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center"><X className="w-4 h-4 text-slate-400" /></div>}
        {!['granted','denied','unavailable'].includes(state) && (
          <button onClick={() => onRequest(config.id)} disabled={loading === config.id} className="btn-primary text-xs px-3 py-1.5 gap-1 whitespace-nowrap">
            {loading === config.id ? <><RefreshCw className="w-3 h-3 animate-spin" /> En cours...</> : 'Autoriser'}
          </button>
        )}
      </div>
    </div>
  );
}

export default function PermissionsModal({ onClose, onAllGranted }) {
  const [states, setStates]           = useState({});
  const [loading, setLoading]         = useState(null);
  const [showHelp, setShowHelp]       = useState(false);
  const secure = isSecureContext();
  const origin = window.location.origin;

  useEffect(() => {
    (async () => {
      const r = {};
      for (const p of PERMS) {
        r[p.id] = p.id === 'notifications'
          ? (Notification?.permission || 'unknown')
          : await checkPermission(p.id);
      }
      setStates(r);
    })();
  }, []);

  useEffect(() => {
    const ok = PERMS.filter((p) => p.required).every((p) => states[p.id] === 'granted');
    if (ok && Object.keys(states).length > 0) onAllGranted?.();
  }, [states]);

  const handleRequest = async (id) => {
    setLoading(id);
    const result = await requestPermission(id);
    setStates((s) => ({ ...s, [id]: result }));
    setLoading(null);
  };

  const handleAll = async () => {
    for (const p of PERMS) {
      if (!['granted','denied','unavailable'].includes(states[p.id])) {
        await handleRequest(p.id);
      }
    }
  };

  const allRequiredGranted = PERMS.filter((p) => p.required).every((p) => states[p.id] === 'granted');

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden mx-auto">

        {/* Header vert */}
        <div className="bg-gradient-to-br from-primary-600 to-primary-700 px-4 sm:px-6 pt-5 sm:pt-6 pb-6 sm:pb-7">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/20 rounded-xl sm:rounded-2xl flex items-center justify-center">
              <Shield className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white">Autorisations requises</h2>
              <p className="text-primary-200 text-xs sm:text-sm">Téléphonie CAP-EPAC</p>
            </div>
          </div>
          <p className="text-primary-100 text-xs sm:text-sm leading-relaxed">
            Pour utiliser les appels audio/vidéo et les messages vocaux, autorisez l'accès aux périphériques.
          </p>
        </div>

        <div className="px-4 sm:px-6 py-4 sm:py-5 space-y-3 max-h-[50vh] sm:max-h-[55vh] overflow-y-auto">

          {/* Alerte connexion non sécurisée */}
          {!secure && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-orange-800">Connexion non sécurisée</p>
                  <p className="text-xs text-orange-700 mt-1 leading-relaxed">
                    Chrome et Firefox bloquent le micro/caméra sur les sites HTTP.
                    Utilisez <strong className="font-semibold">https://</strong> pour accéder à l'application.
                  </p>
                  <button onClick={() => setShowHelp(!showHelp)}
                    className="flex items-center gap-1 text-xs text-orange-600 font-medium mt-2 hover:text-orange-800">
                    {showHelp ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    {showHelp ? 'Masquer les solutions' : 'Voir les solutions'}
                  </button>

                  {showHelp && (
                    <div className="mt-3 space-y-3">
                      {/* Solution 1 — Chrome Flags */}
                      <div className="bg-white border border-orange-200 rounded-lg p-3">
                        <p className="text-xs font-bold text-orange-800 mb-2 flex items-center gap-1">
                          <HelpCircle className="w-3 h-3" />
                          Solution 1 — Chrome : Forcer HTTPS sur l'IP locale
                        </p>
                        <ol className="text-xs text-orange-700 space-y-1 list-decimal list-inside">
                          <li>Ouvrir Chrome et aller sur :<br/>
                            <code className="text-[10px] bg-orange-100 px-1 rounded break-all select-all inline-block mt-1">
                              chrome://flags/#unsafely-treat-insecure-origin-as-secure
                            </code>
                          </li>
                          <li>Dans le champ, taper : <code className="bg-orange-100 px-1 rounded text-[10px]">{origin}</code></li>
                          <li>Passer à <strong>Enabled</strong> → Relancer Chrome</li>
                        </ol>
                        <button
                          onClick={() => { navigator.clipboard?.writeText(`chrome://flags/#unsafely-treat-insecure-origin-as-secure`).catch(()=>{}); }}
                          className="mt-2 text-[10px] bg-orange-100 hover:bg-orange-200 text-orange-700 px-2 py-1 rounded font-medium transition-colors"
                        >
                          Copier le lien Chrome Flags
                        </button>
                      </div>

                      {/* Solution 2 — Icône cadenas */}
                      <div className="bg-white border border-orange-200 rounded-lg p-3">
                        <p className="text-xs font-bold text-orange-800 mb-2 flex items-center gap-1">
                          <Lock className="w-3 h-3" />
                          Solution 2 — Autoriser via l'icône cadenas
                        </p>
                        <ol className="text-xs text-orange-700 space-y-1 list-decimal list-inside">
                          <li>Cliquer sur le <strong>cadenas ou avertissement</strong> dans la barre d'adresse</li>
                          <li>Aller dans <strong>Autorisations du site</strong></li>
                          <li>Autoriser <strong>Microphone</strong> et <strong>Caméra</strong></li>
                          <li>Recharger la page (F5)</li>
                        </ol>
                      </div>

                      {/* Solution 3 — Certificat de confiance */}
                      <div className="bg-white border border-orange-200 rounded-lg p-3">
                        <p className="text-xs font-bold text-orange-800 mb-2 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          Solution 3 (définitive) — Certificat de confiance mkcert
                        </p>
                        <ol className="text-xs text-orange-700 space-y-1 list-decimal list-inside">
                          <li>Sur le serveur : <code className="bg-orange-100 px-1 rounded">bash scripts/install-mkcert.sh</code></li>
                          <li>Relancer : <code className="bg-orange-100 px-1 rounded">bash scripts/start.sh</code></li>
                          <li>Sur chaque PC client : importer <code className="bg-orange-100 px-1 rounded">nginx/ssl/rootCA.pem</code></li>
                          <li>Chrome : <em>Paramètres → Sécurité → Gérer les certificats → Importer</em></li>
                          <li>Firefox : <em>about:preferences#privacy → Voir les certificats → Importer</em></li>
                        </ol>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Rows permissions */}
          {PERMS.map((p) => (
            <PermissionRow key={p.id} config={p} state={states[p.id] || 'unknown'}
              onRequest={handleRequest} loading={loading} />
          ))}
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-4 border-t border-slate-100 flex flex-col sm:flex-row gap-3">
          <button onClick={handleAll} disabled={!!loading} className="btn-primary flex-1 py-2.5">
            {loading
              ? <><RefreshCw className="w-4 h-4 animate-spin" /> Demande en cours...</>
              : 'Autoriser tout'}
          </button>
          <button
            onClick={onClose}
            className={`px-5 py-2.5 rounded-xl font-medium transition-colors ${
              allRequiredGranted 
                ? 'bg-slate-100 text-slate-700 hover:bg-slate-200' 
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            {allRequiredGranted ? 'Fermer' : 'Ignorer'}
          </button>
        </div>

      </div>
    </div>
  );
}