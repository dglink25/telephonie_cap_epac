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
  const [visible, setVisible] = useState(false);
  const pendingOfferRef = useRef(null);
  const audioRef = useRef(null);

  // Animate in/out
  useEffect(() => {
    if (incomingCall) {
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
    }
  }, [incomingCall]);

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
      stopRingtone();
    }
  }, [incomingCall, stopRingtone]);

  useEffect(() => {
    if (!incomingCall) {
      pendingOfferRef.current = null;
      setAccepting(false);
    }
  }, [incomingCall]);

  useEffect(() => {
    if (!socket || !incomingCall) return;

    const onOffer = ({ sdp, callId, fromUserId }) => {
      console.log('[IncomingModal] 📨 webrtc:offer reçu callId=', callId);
      pendingOfferRef.current = { sdp, callId, fromUserId };
    };

    const onIce = async ({ candidate }) => {
      await addIceCandidate(candidate);
    };

    const onEnded = ({ callId }) => {
      if (incomingCall?.callId === callId) {
        stopRingtone();
        clearIncomingCall();
        toast('Appel annulé');
      }
    };

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
    stopRingtone();

    try {
      socket.emit('call:accept', { callId: incomingCall.callId });

      const offer = await waitForOffer(15000);

      if (!offer) {
        toast.error('Délai dépassé — réessayez');
        socket.emit('call:reject', { callId: incomingCall.callId });
        clearIncomingCall();
        return;
      }

      await answerIncomingCall(
        offer.fromUserId,
        offer.sdp,
        offer.callId,
        incomingCall.type
      );
      clearIncomingCall();
    } catch (err) {
      toast.error('Erreur micro : ' + err.message);
      socket.emit('call:reject', { callId: incomingCall.callId });
      clearIncomingCall();
    } finally {
      setAccepting(false);
    }
  };

  const handleReject = () => {
    if (!incomingCall) return;
    stopRingtone();
    socket.emit('call:reject', { callId: incomingCall.callId });
    clearIncomingCall();
  };

  const waitForOffer = (timeoutMs) =>
    new Promise((resolve) => {
      if (pendingOfferRef.current) {
        resolve(pendingOfferRef.current);
        return;
      }
      const iv = setInterval(() => {
        if (pendingOfferRef.current) {
          clearInterval(iv);
          clearTimeout(to);
          resolve(pendingOfferRef.current);
        }
      }, 50);
      const to = setTimeout(() => {
        clearInterval(iv);
        resolve(null);
      }, timeoutMs);
    });

  if (!incomingCall) return null;

  const isVideo = incomingCall.type === 'video';
  const initial = incomingCall.callerName?.charAt(0)?.toUpperCase() || '?';

  return (
    <>
      <style>{`
        @keyframes ringPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(22,163,74,0.5), 0 0 0 0 rgba(22,163,74,0.3); }
          50%       { box-shadow: 0 0 0 16px rgba(22,163,74,0), 0 0 0 32px rgba(22,163,74,0); }
        }
        @keyframes modalSlideUp {
          from { opacity: 0; transform: scale(0.92) translateY(24px); }
          to   { opacity: 1; transform: scale(1)    translateY(0); }
        }
        @keyframes overlayFade {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes rejectPulse {
          0%, 100% { transform: scale(1); }
          50%      { transform: scale(1.06); }
        }
        @keyframes acceptGlow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(22,163,74,0.6); }
          50%      { box-shadow: 0 0 0 10px rgba(22,163,74,0); }
        }
        .incoming-overlay {
          animation: overlayFade 0.2s ease both;
        }
        .incoming-card {
          animation: modalSlideUp 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }
        .ring-avatar {
          animation: ringPulse 1.8s ease-in-out infinite;
        }
        .btn-accept {
          animation: acceptGlow 2s ease-in-out infinite;
        }
        .btn-accept:hover { transform: scale(1.08); }
        .btn-reject:hover { transform: scale(1.08); }
        .btn-accept, .btn-reject {
          transition: transform 0.15s ease;
        }
      `}</style>

      <audio ref={audioRef} loop preload="auto">
        <source src="/sounds/preview.wav" type="audio/wav" />
      </audio>

      {/* Overlay */}
      <div
        className="incoming-overlay"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
          background: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
        }}
      >
        {/* Card */}
        <div
          className="incoming-card"
          style={{
            width: '100%',
            maxWidth: '340px',
            borderRadius: '24px',
            overflow: 'hidden',
            background: '#fff',
            boxShadow: '0 32px 64px rgba(0,0,0,0.3)',
          }}
        >
          {/* Header gradient */}
          <div
            style={{
              background: 'linear-gradient(160deg, #15803d 0%, #16a34a 50%, #22c55e 100%)',
              padding: '2rem 1.5rem 2.5rem',
              textAlign: 'center',
              position: 'relative',
            }}
          >
            {/* Decorative circles */}
            <div style={{
              position: 'absolute', top: '-20px', right: '-20px',
              width: '120px', height: '120px', borderRadius: '50%',
              background: 'rgba(255,255,255,0.06)',
            }} />
            <div style={{
              position: 'absolute', bottom: '-30px', left: '-30px',
              width: '100px', height: '100px', borderRadius: '50%',
              background: 'rgba(255,255,255,0.04)',
            }} />

            {/* Type badge */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              background: 'rgba(255,255,255,0.18)',
              borderRadius: '999px', padding: '4px 14px',
              marginBottom: '1.25rem',
            }}>
              {isVideo
                ? <Video style={{ width: 13, height: 13, color: '#fff' }} />
                : <Phone style={{ width: 13, height: 13, color: '#fff' }} />
              }
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.9)', fontWeight: 500 }}>
                Appel {isVideo ? 'vidéo' : 'audio'} entrant
              </span>
            </div>

            {/* Avatar */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
              <div
                className="ring-avatar"
                style={{
                  width: 80, height: 80, borderRadius: '50%',
                  background: 'rgba(255,255,255,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 32, fontWeight: 700, color: '#fff',
                  border: '3px solid rgba(255,255,255,0.4)',
                  position: 'relative',
                  zIndex: 1,
                }}
              >
                {initial}
              </div>
            </div>

            {/* Name */}
            <h3 style={{
              fontSize: 22, fontWeight: 700, color: '#fff',
              margin: 0, lineHeight: 1.2,
            }}>
              {incomingCall.callerName}
            </h3>

            {/* Group label */}
            {incomingCall.groupName && (
              <p style={{
                fontSize: 12, color: 'rgba(255,255,255,0.7)',
                marginTop: 4, marginBottom: 0,
              }}>
                {incomingCall.groupName}
              </p>
            )}

            {/* Connecting state */}
            {accepting && (
              <p style={{
                fontSize: 12, color: 'rgba(255,255,255,0.8)',
                marginTop: 8, marginBottom: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}>
                <Loader2 style={{ width: 13, height: 13, animation: 'spin 1s linear infinite' }} />
                Connexion en cours…
              </p>
            )}
          </div>

          {/* Buttons */}
          <div
            style={{
              background: '#fff',
              padding: '1.75rem 2rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-around',
            }}
          >
            {/* Reject */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <button
                className="btn-reject"
                onClick={handleReject}
                disabled={accepting}
                style={{
                  width: 60, height: 60, borderRadius: '50%',
                  background: '#fee2e2', border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  opacity: accepting ? 0.5 : 1,
                }}
              >
                <PhoneOff style={{ width: 24, height: 24, color: '#dc2626' }} />
              </button>
              <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 500 }}>Refuser</span>
            </div>

            {/* Divider dot */}
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#e5e7eb' }} />

            {/* Accept */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <button
                className="btn-accept"
                onClick={handleAccept}
                disabled={accepting}
                style={{
                  width: 60, height: 60, borderRadius: '50%',
                  background: '#16a34a', border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  opacity: accepting ? 0.8 : 1,
                }}
              >
                {accepting
                  ? <Loader2 style={{ width: 24, height: 24, color: '#fff', animation: 'spin 1s linear infinite' }} />
                  : <Phone style={{ width: 24, height: 24, color: '#fff' }} />
                }
              </button>
              <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 500 }}>
                {accepting ? 'Connexion…' : 'Accepter'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}