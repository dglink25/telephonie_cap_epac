// src/components/meeting/MeetingModal.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Video, Link, Copy, CheckCircle, X, Loader2, Users } from 'lucide-react';
import api from '../../services/api';

export default function MeetingModal({ onClose, conversationName = '' }) {
  const navigate = useNavigate();
  const [tab, setTab]         = useState('create'); // 'create' | 'join'
  const [roomInput, setRoomInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState(null);
  const [copied, setCopied]   = useState(false);
  const [error, setError]     = useState('');

  const handleCreate = async () => {
    setLoading(true);
    setError('');
    try {
      const resp = await api.post('/meetings/create', {
        name: conversationName || '',
      });
      setCreated(resp.data.data);
    } catch (e) {
      setError(e.response?.data?.message || 'Impossible de créer la réunion');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    const room = roomInput.trim().toUpperCase();
    if (!room) return;
    setLoading(true);
    setError('');
    try {
      await api.post(`/meetings/join/${room}`);
      onClose();
      navigate(`/meeting/${room}`);
    } catch (e) {
      setError(e.response?.data?.message || 'Impossible de rejoindre la réunion');
    } finally {
      setLoading(false);
    }
  };

  const copyLink = () => {
    if (!created) return;
    const url = `${window.location.origin}/meeting/${created.roomName}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const startNow = () => {
    if (!created) return;
    onClose();
    navigate(`/meeting/${created.roomName}`);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center">
              <Video className="w-4 h-4 text-primary-600" />
            </div>
            <h2 className="font-semibold text-slate-800">Visioconférence</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Onglets */}
        <div className="flex border-b border-slate-100">
          {[
            { id: 'create', label: 'Nouvelle réunion' },
            { id: 'join',   label: 'Rejoindre' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setCreated(null); setError(''); }}
              className={`flex-1 py-3 text-sm font-medium transition-colors border-b-2
                ${tab === t.id
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-5">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Créer une réunion */}
          {tab === 'create' && !created && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-xl">
                <div className="flex items-center gap-3 mb-2">
                  <Users className="w-5 h-5 text-primary-600" />
                  <span className="font-medium text-slate-800">Jusqu'à 200 participants</span>
                </div>
                <ul className="text-sm text-slate-600 space-y-1 ml-8">
                  <li>✓ Partage d'écran et de vidéo</li>
                  <li>✓ Sous-titres automatiques</li>
                  <li>✓ Lien de partage</li>
                  <li>✓ Gestion des accès</li>
                </ul>
              </div>

              <button
                onClick={handleCreate}
                disabled={loading}
                className="w-full py-3 bg-primary-600 hover:bg-primary-700 disabled:opacity-50
                           text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {loading
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Création...</>
                  : <><Video className="w-4 h-4" /> Créer la réunion</>
                }
              </button>
            </div>
          )}

          {/* Salle créée — afficher le lien */}
          {tab === 'create' && created && (
            <div className="space-y-4">
              <div className="p-4 bg-primary-50 border border-primary-200 rounded-xl">
                <p className="text-xs text-primary-600 font-medium mb-1">Code de la salle</p>
                <p className="text-xl font-bold text-primary-800 font-mono">{created.roomName}</p>
              </div>

              <div>
                <p className="text-xs text-slate-500 mb-1.5">Lien d'invitation</p>
                <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <Link className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <span className="text-xs text-slate-600 flex-1 truncate font-mono">
                    {window.location.origin}/meeting/{created.roomName}
                  </span>
                  <button
                    onClick={copyLink}
                    className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors flex-shrink-0"
                  >
                    {copied
                      ? <CheckCircle className="w-4 h-4 text-green-500" />
                      : <Copy className="w-4 h-4 text-slate-500" />
                    }
                  </button>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={copyLink}
                  className="flex-1 py-2.5 border border-slate-200 hover:bg-slate-50
                             text-slate-700 text-sm font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  {copied ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copié !' : 'Copier le lien'}
                </button>
                <button
                  onClick={startNow}
                  className="flex-1 py-2.5 bg-primary-600 hover:bg-primary-700
                             text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  <Video className="w-4 h-4" />
                  Démarrer
                </button>
              </div>
            </div>
          )}

          {/* Rejoindre une réunion */}
          {tab === 'join' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Code ou lien de la réunion
                </label>
                <input
                  type="text"
                  value={roomInput}
                  onChange={(e) => setRoomInput(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                  placeholder="Ex: CAPEPAC-A1B2"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl
                             text-slate-800 font-mono uppercase placeholder:normal-case
                             placeholder:text-slate-400 focus:outline-none focus:ring-2
                             focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              <button
                onClick={handleJoin}
                disabled={loading || !roomInput.trim()}
                className="w-full py-3 bg-primary-600 hover:bg-primary-700 disabled:opacity-50
                           text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {loading
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Connexion...</>
                  : <><Users className="w-4 h-4" /> Rejoindre</>
                }
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
