// src/components/calls/ActiveCallBar.jsx
import { useEffect, useRef } from 'react';
import { PhoneOff, Mic, MicOff, Video, VideoOff, PauseCircle, PlayCircle } from 'lucide-react';
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
    <div className={`fixed ${isVideo ? 'inset-0' : 'bottom-4 right-4 w-80'} z-40`}>
      {isVideo ? (
        /* ── Vue plein écran vidéo ────────────────────────────── */
        <div className="relative w-full h-full bg-slate-900 flex items-center justify-center">
          {/* Stream distant */}
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />

          {/* Stream local (miniature) */}
          <div className="absolute bottom-24 right-4 w-36 h-24 bg-slate-800 rounded-xl overflow-hidden shadow-lg border-2 border-primary-500">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          </div>

          {/* Overlay info */}
          <div className="absolute top-4 left-0 right-0 text-center">
            <p className="text-white font-semibold text-lg drop-shadow">{activeCall.calleeName || activeCall.callerName}</p>
            <p className="text-primary-300 text-sm">{formatDuration(callDuration)}</p>
          </div>

          {/* Contrôles */}
          <div className="absolute bottom-8 left-0 right-0 flex items-center justify-center gap-5">
            <CallControl icon={isMuted ? MicOff : Mic} label={isMuted ? 'Activer micro' : 'Couper micro'} active={isMuted} onClick={handleMute} />
            <CallControl icon={PhoneOff} label="Raccrocher" danger onClick={handleHangup} size="lg" />
            <CallControl icon={isVideoOn ? Video : VideoOff} label={isVideoOn ? 'Couper vidéo' : 'Activer vidéo'} active={!isVideoOn} onClick={handleVideo} />
          </div>
        </div>
      ) : (
        /* ── Barre audio compacte ────────────────────────────── */
        <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden">
          {/* Header vert */}
          <div className="bg-primary-600 px-4 py-3 flex items-center gap-3">
            <div className="w-9 h-9 bg-primary-500 rounded-full flex items-center justify-center text-white font-bold">
              {(activeCall.calleeName || activeCall.callerName)?.charAt(0) || '?'}
            </div>
            <div className="flex-1">
              <p className="text-white text-sm font-medium">{activeCall.calleeName || activeCall.callerName}</p>
              <p className="text-primary-200 text-xs">{isOnHold ? 'En attente' : formatDuration(callDuration)}</p>
            </div>
            {/* Audio stream caché */}
            <audio ref={remoteVideoRef} autoPlay />
          </div>

          {/* Contrôles */}
          <div className="px-4 py-3 flex items-center justify-around bg-white">
            <SmallControl icon={isMuted ? MicOff : Mic} label={isMuted ? 'Activé' : 'Muet'} onClick={handleMute} active={isMuted} />
            <SmallControl icon={isOnHold ? PlayCircle : PauseCircle} label={isOnHold ? 'Reprendre' : 'Attente'} onClick={toggleHold} active={isOnHold} />
            <SmallControl icon={PhoneOff} label="Fin" onClick={handleHangup} danger />
          </div>
        </div>
      )}
    </div>
  );
}

function CallControl({ icon: Icon, label, onClick, danger, active, size = 'md' }) {
  const baseSize = size === 'lg' ? 'w-16 h-16' : 'w-13 h-13';
  return (
    <div className="call-btn">
      <button
        onClick={onClick}
        className={`call-btn-circle ${baseSize} ${
          danger
            ? 'bg-red-500 hover:bg-red-600 text-white'
            : active
            ? 'bg-slate-700 text-white'
            : 'bg-white/20 hover:bg-white/30 text-white'
        } shadow-lg`}
      >
        <Icon className={size === 'lg' ? 'w-7 h-7' : 'w-5 h-5'} />
      </button>
      <span className="text-xs text-white/80">{label}</span>
    </div>
  );
}

function SmallControl({ icon: Icon, label, onClick, danger, active }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <button
        onClick={onClick}
        className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
          danger
            ? 'bg-red-100 text-red-600 hover:bg-red-200'
            : active
            ? 'bg-primary-100 text-primary-700'
            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
        }`}
      >
        <Icon className="w-4 h-4" />
      </button>
      <span className="text-xs text-slate-500">{label}</span>
    </div>
  );
}
