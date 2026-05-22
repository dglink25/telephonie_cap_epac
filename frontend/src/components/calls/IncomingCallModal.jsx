// src/components/calls/IncomingCallModal.jsx
import { useEffect, useRef, useState, useCallback } from 'react';
import { Phone, PhoneOff, Video, Loader2 } from 'lucide-react';
import useCallStore from '../../store/callStore';
import useSocketStore from '../../store/socketStore';
import { answerIncomingCall, addIceCandidate } from '../../services/webrtcService';
import toast from 'react-hot-toast';

export default function IncomingCallModal() {
  const { incomingCall, clearIncomingCall } = useCallStore();
  const { socket } = useSocketStore();
  const [accepting, setAccepting] = useState(false);
  const pendingOfferRef = useRef(null);
  const audioRef = useRef(null);

  // ── Sonnerie ──────────────────────────────────────────────────
  // ✅ FIX: stopRingtone extrait en fonction réutilisable
  const stopRingtone = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, []);

  useEffect(() => {
    if (incomingCall) {
      audioRef.current?.play().catch(() => {});
    } else {
      // ✅ FIX: quand incomingCall passe à null (depuis n'importe où), stopper la sonnerie
      stopRingtone();
    }
  }, [incomingCall, stopRingtone]);

  useEffect(() => {
    if (!incomingCall) {
      pendingOfferRef.current = null;
      setAccepting(false);
    }
  }, [incomingCall]);

  // ── Écouter les événements Socket ─────────────────────────────
  useEffect(() => {
    if (!socket || !incomingCall) return;

    const onOffer = ({ sdp, callId, fromUserId }) => {
      console.log('[IncomingModal] 📨 webrtc:offer reçu callId=', callId);
      pendingOfferRef.current = { sdp, callId, fromUserId };
    };

    const onIce = async ({ candidate }) => {
      await addIceCandidate(candidate);
    };

    // ✅ FIX: call:ended doit stopper la sonnerie côté appelé
    const onEnded = ({ callId }) => {
      if (incomingCall?.callId === callId) {
        console.log('[IncomingModal] appel annulé par l\'appelant callId=', callId);
        stopRingtone();
        clearIncomingCall();
        toast('📵 Appel annulé');
      }
    };

    // ✅ FIX: call:rejected (un autre membre du groupe a rejeté) → ne pas fermer si ce n'est pas nous
    const onRejected = ({ callId }) => {
      if (incomingCall?.callId === callId) {
        stopRingtone();
        clearIncomingCall();
      }
    };

    socket.on('webrtc:offer',         onOffer);
    socket.on('webrtc:ice-candidate', onIce);
    socket.on('call:ended',           onEnded);
    socket.on('call:rejected',        onRejected);

    return () => {
      socket.off('webrtc:offer',         onOffer);
      socket.off('webrtc:ice-candidate', onIce);
      socket.off('call:ended',           onEnded);
      socket.off('call:rejected',        onRejected);
    };
  }, [socket, incomingCall, stopRingtone, clearIncomingCall]);

  const handleAccept = async () => {
    if (!incomingCall || accepting) return;
    setAccepting(true);
    stopRingtone(); // ✅ FIX: stopper la sonnerie immédiatement au clic
    console.log('[IncomingModal] ✅ accepter callId=', incomingCall.callId);

    try {
      socket.emit('call:accept', { callId: incomingCall.callId });
      console.log('[IncomingModal] call:accept émis, attente offre SDP...');

      const offer = await waitForOffer(15000);

      if (!offer) {
        console.error('[IncomingModal] ⏱ timeout: pas d\'offre SDP en 15s');
        toast.error('Délai dépassé — réessayez l\'appel');
        socket.emit('call:reject', { callId: incomingCall.callId });
        clearIncomingCall();
        return;
      }

      console.log('[IncomingModal] 🎙 offre reçue, création réponse SDP...');
      await answerIncomingCall(
        offer.fromUserId,
        offer.sdp,
        offer.callId,
        incomingCall.type
      );
      console.log('[IncomingModal] ✅ réponse SDP envoyée');
      clearIncomingCall();

    } catch (err) {
      console.error('[IncomingModal] ❌ erreur:', err.message);
      toast.error('Erreur micro : ' + err.message);
      socket.emit('call:reject', { callId: incomingCall.callId });
      clearIncomingCall();
    } finally {
      setAccepting(false);
    }
  };

  const handleReject = () => {
    if (!incomingCall) return;
    console.log('[IncomingModal] ❌ refuser callId=', incomingCall.callId);
    stopRingtone(); // ✅ FIX: stopper la sonnerie au refus
    socket.emit('call:reject', { callId: incomingCall.callId });
    clearIncomingCall();
  };

  const waitForOffer = (timeoutMs) =>
    new Promise((resolve) => {
      if (pendingOfferRef.current) {
        console.log('[IncomingModal] offre déjà disponible immédiatement');
        resolve(pendingOfferRef.current);
        return;
      }
      const iv = setInterval(() => {
        if (pendingOfferRef.current) {
          clearInterval(iv);
          clearTimeout(to);
          console.log('[IncomingModal] offre reçue après attente');
          resolve(pendingOfferRef.current);
        }
      }, 50);
      const to = setTimeout(() => {
        clearInterval(iv);
        resolve(null);
      }, timeoutMs);
    });

  if (!incomingCall) return null;

  return (
    <>
      {/* ✅ FIX: ref sur l'audio pour pouvoir le stopper partout */}
      <audio ref={audioRef} loop preload="auto">
        <source src="/sounds/preview.wav" type="audio/wav" />
      </audio>

      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-fade-in">

          <div className="bg-gradient-to-br from-primary-600 to-primary-700 px-6 py-8 text-center">
            <div className="relative inline-block mb-4">
              <div className="w-20 h-20 bg-primary-500 rounded-full flex items-center justify-center text-white text-3xl font-bold shadow-lg ring-animation">
                {incomingCall.callerName?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-white flex items-center justify-center">
                {incomingCall.type === 'video'
                  ? <Video className="w-4 h-4 text-primary-600" />
                  : <Phone className="w-4 h-4 text-primary-600" />
                }
              </div>
            </div>
            <p className="text-primary-200 text-sm mb-1">
              Appel {incomingCall.type === 'video' ? 'vidéo' : 'audio'} entrant
            </p>
            <h3 className="text-2xl font-bold text-white">{incomingCall.callerName}</h3>
            {/* ✅ Afficher si c'est un appel de groupe */}
            {incomingCall.groupName && (
              <p className="text-primary-300 text-xs mt-1">Groupe : {incomingCall.groupName}</p>
            )}
            {accepting && (
              <p className="text-primary-200 text-xs mt-2 animate-pulse">Connexion en cours…</p>
            )}
          </div>

          <div className="px-6 py-6 flex items-center justify-around">
            <div className="call-btn">
              <button
                onClick={handleReject}
                disabled={accepting}
                className="call-btn-circle w-14 h-14 bg-red-500 hover:bg-red-600 text-white shadow-md disabled:opacity-50"
              >
                <PhoneOff className="w-6 h-6" />
              </button>
              <span className="text-xs text-slate-500 font-medium">Refuser</span>
            </div>
            <div className="call-btn">
              <button
                onClick={handleAccept}
                disabled={accepting}
                className="call-btn-circle w-14 h-14 bg-primary-500 hover:bg-primary-600 text-white shadow-md disabled:opacity-80"
              >
                {accepting
                  ? <Loader2 className="w-6 h-6 animate-spin" />
                  : <Phone className="w-6 h-6" />
                }
              </button>
              <span className="text-xs text-slate-500 font-medium">
                {accepting ? 'Connexion…' : 'Accepter'}
              </span>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}