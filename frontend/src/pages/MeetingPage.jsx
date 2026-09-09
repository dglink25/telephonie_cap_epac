// src/pages/MeetingPage.jsx
import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Copy, ExternalLink, Users, Video, Mic, MicOff, VideoOff,
         PhoneOff, Share2, Settings, CheckCircle, X } from 'lucide-react';
import api from '../services/api';
import useAuthStore from '../store/authStore';

export default function MeetingPage() {
  const { roomName }        = useParams();
  const [searchParams]      = useSearchParams();
  const navigate            = useNavigate();
  const { user }            = useAuthStore();
  const jitsiContainerRef   = useRef(null);
  const jitsiApiRef         = useRef(null);

  const [jitsiUrl, setJitsiUrl]     = useState('');
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [copied, setCopied]         = useState(false);
  const [participants, setParticipants] = useState(0);
  const [shareUrl, setShareUrl]     = useState('');

  // ── Charger la config Jitsi ───────────────────────────────────
  useEffect(() => {
    // Priorité 1 : variable VITE_JITSI_URL dans le build (définie par deploy.sh)
    const envUrl = import.meta.env.VITE_JITSI_URL;
    if (envUrl) { setJitsiUrl(envUrl); return; }
    // Priorité 2 : API backend
    api.get('/meetings/config').then((resp) => {
      setJitsiUrl(resp.data.data.jitsiUrl || 'https://meet.jit.si');
    }).catch(() => {
      setJitsiUrl('https://meet.jit.si');
    });
  }, []);

  // ── Initialiser Jitsi quand l'URL est prête ───────────────────
  useEffect(() => {
    if (!jitsiUrl || !roomName || !jitsiContainerRef.current) return;

    const room = roomName.toUpperCase();
    setShareUrl(`${window.location.origin}/meeting/${room}`);

    // Charger le script Jitsi External API
    const script = document.createElement('script');
    script.src   = `${jitsiUrl}/external_api.js`;
    script.async = true;
    script.onload = () => initJitsi(room);
    script.onerror = () => setError(`Impossible de charger Jitsi depuis ${jitsiUrl}`);
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
      jitsiApiRef.current?.dispose();
    };
  }, [jitsiUrl, roomName]);

  const initJitsi = useCallback((room) => {
    if (!window.JitsiMeetExternalAPI) {
      setError('API Jitsi non disponible');
      return;
    }

    const domain   = jitsiUrl.replace(/^https?:\/\//, '').replace(/:\d+$/, '');
    const port     = jitsiUrl.match(/:(\d+)$/)?.[1];
    const jwt      = searchParams.get('jwt');

    const options = {
      roomName: room,
      parentNode: jitsiContainerRef.current,
      width:  '100%',
      height: '100%',
      jwt:    jwt || undefined,
      configOverwrite: {
        startWithAudioMuted:       false,
        startWithVideoMuted:       false,
        enableClosePage:           false,
        disableDeepLinking:        true,
        enableNoisyMicDetection:   true,
        enableTalkWhileMuted:      true,
        // Sous-titres automatiques
        transcribingEnabled:       true,
        // Partage d'écran
        desktopSharingChromeExtId: null,
        desktopSharingChromeDisabled: false,
        // Enregistrement local
        localRecording: { enabled: true },
        // Arrière-plan virtuel
        virtualBackgrounds: { enabled: true },
        // Reaction
        enableReactions: true,
        // Max participants
        channelLastN: 200,
        // Qualité vidéo adaptative
        adaptiveLastN: true,
        resolution: 720,
        constraints: {
          video: { height: { ideal: 720, max: 1080, min: 180 } },
        },
        // Nom de l'app
        applicationName: 'CAP-EPAC Visioconférence',
        // Désactiver le redirectionpage Jitsi
        enableWelcomePage: false,
      },
      interfaceConfigOverwrite: {
        APP_NAME:           'CAP-EPAC Visioconférence',
        NATIVE_APP_NAME:    'CAP-EPAC',
        PROVIDER_NAME:      'CAP-EPAC',
        HIDE_INVITE_MORE_HEADER: false,
        TOOLBAR_BUTTONS: [
          'microphone', 'camera', 'closedcaptions', 'desktop',
          'fullscreen', 'forvideoquality', 'hangup', 'profile',
          'chat', 'recording', 'livestreaming', 'etherpad',
          'sharedvideo', 'settings', 'raisehand', 'videoquality',
          'filmstrip', 'invite', 'feedback', 'stats', 'shortcuts',
          'tileview', 'select-background', 'download', 'help',
          'mute-everyone', 'security', 'participants-pane',
          'toggle-camera', 'reactions',
        ],
        SETTINGS_SECTIONS:  ['devices', 'language', 'moderator', 'profile', 'sounds'],
        SHOW_JITSI_WATERMARK: false,
        SHOW_WATERMARK_FOR_GUESTS: false,
        DEFAULT_BACKGROUND: '#1a1a2e',
        DISABLE_JOIN_LEAVE_NOTIFICATIONS: false,
        LANG_DETECTION: true,
      },
      userInfo: {
        displayName: user?.display_name || 'Participant',
        email:       user?.email || '',
      },
      ...(port ? { hosts: { domain, muc: `conference.${domain}` }, bosh: `${jitsiUrl}/http-bind`, websocket: `wss://${domain}:${port}/xmpp-websocket` } : {}),
    };

    try {
      jitsiApiRef.current = new window.JitsiMeetExternalAPI(domain, options);

      // Événements
      jitsiApiRef.current.addEventListeners({
        readyToClose: () => navigate('/chat'),
        participantJoined: () => setParticipants((p) => p + 1),
        participantLeft:   () => setParticipants((p) => Math.max(0, p - 1)),
        videoConferenceJoined: (e) => {
          setLoading(false);
          setParticipants(1);
        },
        videoConferenceLeft: () => navigate('/chat'),
        errorOccurred: (e) => {
          if (e.error?.name !== 'connection.droppedError') {
            setError(`Erreur Jitsi : ${e.error?.message || 'Inconnue'}`);
          }
        },
      });
    } catch (e) {
      setError(`Impossible de démarrer Jitsi : ${e.message}`);
      setLoading(false);
    }
  }, [jitsiUrl, user, navigate, searchParams]);

  const copyLink = () => {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen bg-gray-900">

      {/* Barre supérieure */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-gray-800 border-b border-gray-700 flex-shrink-0">
        <div className="flex items-center gap-3">
          <Video className="w-5 h-5 text-primary-400" />
          <div>
            <p className="text-white font-semibold text-sm">CAP-EPAC Visioconférence</p>
            <p className="text-gray-400 text-xs font-mono">{roomName?.toUpperCase()}</p>
          </div>
          {participants > 0 && (
            <span className="flex items-center gap-1 text-xs text-gray-300 bg-gray-700 px-2 py-1 rounded-full">
              <Users className="w-3 h-3" />
              {participants} participant{participants > 1 ? 's' : ''}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Copier le lien */}
          <button
            onClick={copyLink}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
            title="Copier le lien d'invitation"
          >
            {copied
              ? <><CheckCircle className="w-3.5 h-3.5 text-green-400" /> Copié</>
              : <><Copy className="w-3.5 h-3.5" /> Partager</>
            }
          </button>

          {/* Ouvrir dans un nouvel onglet */}
          <a
            href={`${jitsiUrl}/${roomName?.toUpperCase()}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
            title="Ouvrir dans Jitsi"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Plein écran
          </a>

          {/* Quitter */}
          <button
            onClick={() => { jitsiApiRef.current?.executeCommand('hangup'); navigate('/chat'); }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
          >
            <PhoneOff className="w-3.5 h-3.5" />
            Quitter
          </button>
        </div>
      </div>

      {/* Zone Jitsi */}
      <div className="flex-1 relative">
        {loading && !error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 z-10">
            <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-white font-medium">Connexion à la salle...</p>
            <p className="text-gray-400 text-sm mt-1">{roomName?.toUpperCase()}</p>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 z-10 p-8">
            
            <p className="text-white font-semibold text-lg mb-2">Erreur de connexion</p>
            <p className="text-gray-400 text-sm text-center mb-6 max-w-md">{error}</p>
            <p className="text-gray-500 text-xs mb-4">
              Vérifiez que Jitsi est installé sur le serveur :<br/>
              <code className="text-primary-400">sudo bash scripts/install-jitsi.sh</code>
            </p>
            <button
              onClick={() => navigate('/chat')}
              className="px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg"
            >
              Retour aux messages
            </button>
          </div>
        )}

        <div ref={jitsiContainerRef} className="w-full h-full" />
      </div>
    </div>
  );
}
