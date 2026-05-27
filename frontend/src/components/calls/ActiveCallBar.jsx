// src/components/calls/ActiveCallBar.jsx
import { useEffect, useRef, useState } from 'react';
import { PhoneOff, Mic, MicOff, Video, VideoOff, PauseCircle, PlayCircle, Maximize2, Minimize2 } from 'lucide-react';
import useCallStore from '../../store/callStore';
import useSocketStore from '../../store/socketStore';
import { terminateCall, formatDuration } from '../../services/webrtcService';

export default function ActiveCallBar() {
  const {
    activeCall,
    localStream,
    remoteStream,
    isMuted,
    isVideoOn,
    isOnHold,
    callDuration,
    toggleMute,
    toggleVideo,
    toggleHold,
  } = useCallStore();

  const { emit } = useSocketStore();
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  // Gestion du plein écran
  const toggleFullscreen = () => {
    const element = document.getElementById('video-call-container');
    if (!document.fullscreenElement) {
      element?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  if (!activeCall) return null;

  const isVideo = activeCall.type === 'video';
  const targetId = activeCall.calleeId || activeCall.callerId;

  const handleMute = () => {
    const muted = toggleMute();
    emit('call:toggle-mute', { callId: activeCall.callId, isMuted: muted, targetUserId: targetId });
  };

  const handleVideo = () => {
    const on = toggleVideo();
    emit('call:toggle-video', { callId: activeCall.callId, videoOn: on, targetUserId: targetId });
  };

  const handleHangup = () => {
    terminateCall(activeCall.callId);
  };

  return (
    <>
      {isVideo ? (
        /* ── Vue vidéo plein écran avec modal centré ────────────────────────────── */
        <div 
          id="video-call-container"
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-sm animate-fadeIn"
        >
          {/* Conteneur principal centré */}
          <div className="relative w-full h-full flex items-center justify-center p-4">
            
            {/* Stream distant (conteneur responsive) */}
            <div className="relative w-full max-w-6xl h-full max-h-[90vh] bg-slate-900 rounded-2xl overflow-hidden shadow-2xl animate-scaleIn">
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-contain"
              />

              {/* Stream local (miniature responsive) */}
              <div className="absolute bottom-4 right-4 sm:bottom-6 sm:right-6 w-28 h-20 sm:w-40 sm:h-28 md:w-48 md:h-32 bg-slate-800 rounded-xl overflow-hidden shadow-lg border-2 border-primary-500 transition-all duration-300 hover:scale-105">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Overlay info avec animation */}
              <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/70 to-transparent p-4 sm:p-6 animate-slideDown">
                <div className="text-center">
                  <p className="text-white font-semibold text-base sm:text-lg md:text-xl drop-shadow">
                    {activeCall.calleeName || activeCall.callerName}
                  </p>
                  <p className="text-primary-300 text-xs sm:text-sm mt-1">
                    {formatDuration(callDuration)}
                  </p>
                </div>
              </div>

              {/* Contrôles avec animation */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4 sm:p-6 animate-slideUp">
                <div className="flex items-center justify-center gap-3 sm:gap-4 md:gap-5">
                  <CallControl 
                    icon={isMuted ? MicOff : Mic} 
                    label={isMuted ? 'Micro' : 'Micro activé'} 
                    active={isMuted} 
                    onClick={handleMute} 
                  />
                  <CallControl 
                    icon={PhoneOff} 
                    label="Raccrocher" 
                    danger 
                    onClick={handleHangup} 
                    size="lg" 
                  />
                  <CallControl 
                    icon={isVideoOn ? Video : VideoOff} 
                    label={isVideoOn ? 'Vidéo' : 'Vidéo coupée'} 
                    active={!isVideoOn} 
                    onClick={handleVideo} 
                  />
                  <CallControl 
                    icon={isFullscreen ? Minimize2 : Maximize2} 
                    label="Plein écran" 
                    onClick={toggleFullscreen} 
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ── Modal audio centré animé ────────────────────────────────────────── */
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fadeIn" />
          
          <div className="relative bg-white rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-sm sm:max-w-md overflow-hidden animate-modalSlideUp">
            {/* Header avec dégradé */}
            <div className="bg-gradient-to-r from-primary-600 to-primary-700 px-5 sm:px-6 py-4 sm:py-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/20 rounded-full flex items-center justify-center text-white font-bold text-base sm:text-lg">
                  {(activeCall.calleeName || activeCall.callerName)?.charAt(0) || '?'}
                </div>
                <div className="flex-1">
                  <p className="text-white text-sm sm:text-base font-semibold">
                    {activeCall.calleeName || activeCall.callerName}
                  </p>
                  <p className="text-primary-200 text-xs">
                    {isOnHold ? 'En attente' : `Durée: ${formatDuration(callDuration)}`}
                  </p>
                </div>
              </div>
            </div>

            {/* Statut de l'appel */}
            {isOnHold && (
              <div className="bg-amber-50 border-b border-amber-100 px-5 sm:px-6 py-2">
                <p className="text-amber-700 text-xs text-center font-medium">
                  Appel en attente
                </p>
              </div>
            )}

            {/* Contrôles */}
            <div className="px-5 sm:px-6 py-5 sm:py-6 bg-white">
              <div className="flex items-center justify-around gap-2">
                <AudioControl 
                  icon={isMuted ? MicOff : Mic} 
                  label={isMuted ? 'Micro coupé' : 'Micro actif'} 
                  onClick={handleMute} 
                  active={isMuted} 
                />
                <AudioControl 
                  icon={isOnHold ? PlayCircle : PauseCircle} 
                  label={isOnHold ? 'Reprendre' : 'Mettre en attente'} 
                  onClick={toggleHold} 
                  active={isOnHold} 
                />
                <AudioControl 
                  icon={PhoneOff} 
                  label="Raccrocher" 
                  onClick={handleHangup} 
                  danger 
                />
              </div>
            </div>

            {/* Stream audio caché */}
            <audio ref={remoteVideoRef} autoPlay />
          </div>
        </div>
      )}
    </>
  );
}

function CallControl({ icon: Icon, label, onClick, danger, active, size = 'md' }) {
  return (
    <div className="flex flex-col items-center gap-1 sm:gap-2 transition-all duration-200 hover:scale-105">
      <button
        onClick={onClick}
        className={`
          rounded-full flex items-center justify-center transition-all duration-200
          ${size === 'lg' 
            ? 'w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16' 
            : 'w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12'
          }
          ${danger
            ? 'bg-red-500 hover:bg-red-600 active:bg-red-700 text-white shadow-lg hover:shadow-xl'
            : active
            ? 'bg-slate-700 hover:bg-slate-600 text-white'
            : 'bg-white/20 hover:bg-white/30 active:bg-white/40 text-white backdrop-blur-sm'
          }
        `}
      >
        <Icon className={`${size === 'lg' ? 'w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7' : 'w-4 h-4 sm:w-5 sm:h-5'}`} />
      </button>
      <span className="text-[10px] sm:text-xs text-white/80 font-medium">
        {label}
      </span>
    </div>
  );
}

function AudioControl({ icon: Icon, label, onClick, danger, active }) {
  return (
    <div className="flex flex-col items-center gap-1.5 transition-all duration-200 hover:scale-105">
      <button
        onClick={onClick}
        className={`
          w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center transition-all duration-200
          ${danger
            ? 'bg-red-100 text-red-600 hover:bg-red-200 active:bg-red-300'
            : active
            ? 'bg-primary-100 text-primary-700 hover:bg-primary-200'
            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }
        `}
      >
        <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
      </button>
      <span className="text-[10px] sm:text-xs text-slate-600 font-medium text-center max-w-[70px]">
        {label}
      </span>
    </div>
  );
}

