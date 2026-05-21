
import { useEffect, useRef } from 'react';
import { Phone, PhoneOff, Video } from 'lucide-react';
import useCallStore from '../../store/callStore';
import useSocketStore from '../../store/socketStore';
import { terminateCall } from '../../services/webrtcService';

export default function OutgoingCallModal() {
  const { outgoingCall, endCall } = useCallStore();
  const { socket } = useSocketStore();
  const audioRef = useRef(null);

  // Sonnerie côté appelant (ton de retour)
  useEffect(() => {
    if (outgoingCall) {
      audioRef.current?.play().catch(() => {});
    } else {
      audioRef.current?.pause();
      if (audioRef.current) audioRef.current.currentTime = 0;
    }
  }, [outgoingCall]);

  const handleCancel = () => {
    if (!outgoingCall) return;
    console.log('[OutgoingModal] annulation appel callId=', outgoingCall.callId);
    terminateCall(outgoingCall.callId);
  };

  if (!outgoingCall) return null;

  const { calleeName, calleeInitial, type } = outgoingCall;

  return (
    <>
      {/* Ton de retour */}
      <audio ref={audioRef} loop preload="auto">
        <source src="/sounds/ringtone.wav" type="audio/mpeg" />
      </audio>

      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-fade-in">

          {/* Header vert */}
          <div className="bg-gradient-to-br from-primary-700 to-primary-600 px-6 py-8 text-center">
            <div className="relative inline-block mb-4">
              {/* Avatar avec animation de pulsation */}
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-primary-400 animate-ping opacity-30" />
                <div className="w-20 h-20 bg-primary-500 rounded-full flex items-center justify-center text-white text-3xl font-bold shadow-lg relative z-10">
                  {calleeInitial || '?'}
                </div>
              </div>
              <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-white flex items-center justify-center z-20">
                {type === 'video'
                  ? <Video className="w-4 h-4 text-primary-600" />
                  : <Phone className="w-4 h-4 text-primary-600" />
                }
              </div>
            </div>

            <p className="text-primary-200 text-sm mb-1 animate-pulse">
              Appel {type === 'video' ? 'vidéo' : 'audio'} en cours…
            </p>
            <h3 className="text-2xl font-bold text-white">{calleeName}</h3>
            <p className="text-primary-300 text-xs mt-2">En attente de réponse</p>
          </div>

          {/* Bouton raccrocher */}
          <div className="px-6 py-6 flex justify-center">
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={handleCancel}
                className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-lg transition-all"
              >
                <PhoneOff className="w-7 h-7" />
              </button>
              <span className="text-xs text-slate-500 font-medium">Annuler</span>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
