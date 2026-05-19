// src/components/layout/MainLayout.jsx
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import useSocketStore from '../../store/socketStore';
import { useEffect, useRef } from 'react';
import useCallStore from '../../store/callStore';
import {
  createAndSendOffer,
  handleAnswer,
  addIceCandidate,
  terminateCall,
} from '../../services/webrtcService';
import toast from 'react-hot-toast';

export default function MainLayout() {
  const { socket } = useSocketStore();
  const { setIncomingCall, setOutgoingCall, clearOutgoingCall, endCall } = useCallStore();

  // { calleeId, calleeName, calleeInitial, type, callId }
  const pendingRef = useRef(null);

  // ── Exposer l'initiateur d'appel aux pages ──────────────────
  useEffect(() => {
    window.__capEpacInitiateCall = (calleeId, calleeName, type) => {
      pendingRef.current = {
        calleeId,
        calleeName,
        calleeInitial: calleeName?.charAt(0)?.toUpperCase() || '?',
        type,
        callId: null,
      };
      console.log('[Call] ▶ appel sortant enregistré', calleeId, calleeName, type);
    };
    return () => { delete window.__capEpacInitiateCall; };
  }, []);

  // ── Handlers Socket.IO ──────────────────────────────────────
  useEffect(() => {
    if (!socket) return;
    console.log('[MainLayout] 🔌 handlers enregistrés socket.id=', socket.id);

    // ── Appel entrant ─────────────────────────────────────────
    const onIncoming = (data) => {
      console.log('[Call] 📲 call:incoming', data);
      setIncomingCall(data);
    };

    // ── Serveur confirme + donne le vrai callId ───────────────
    const onInitiated = ({ callId }) => {
      console.log('[Call] ✅ call:initiated callId=', callId);
      if (pendingRef.current) {
        pendingRef.current.callId = callId;
        // Afficher le modal appel sortant
        setOutgoingCall({ ...pendingRef.current, callId });
      }
    };

    // ── L'appelé a décroché → créer l'offre SDP ───────────────
    const onAccepted = async ({ callId }) => {
      console.log('[Call] 📞 call:accepted callId=', callId);
      const p = pendingRef.current;
      if (!p) {
        console.warn('[Call] call:accepted sans pending, ignoré');
        return;
      }
      // Fermer le modal sortant (l'appel est établi)
      clearOutgoingCall();
      const realCallId = callId || p.callId;
      try {
        console.log('[WebRTC] 🎙 création offre SDP calleeId=', p.calleeId, 'callId=', realCallId);
        await createAndSendOffer(p.calleeId, realCallId, p.type);
        console.log('[WebRTC] ✅ offre SDP envoyée');
      } catch (err) {
        console.error('[WebRTC] ❌ createAndSendOffer:', err.message);
        toast.error('Micro inaccessible : ' + err.message);
        terminateCall(realCallId);
        pendingRef.current = null;
      }
    };

    // ── L'appelé a refusé ─────────────────────────────────────
    const onRejected = () => {
      console.log('[Call] ❌ call:rejected');
      pendingRef.current = null;
      clearOutgoingCall();
      toast('📵 Appel refusé');
      endCall();
    };

    // ── Appel terminé ─────────────────────────────────────────
    const onEnded = ({ callId }) => {
      console.log('[Call] 🔴 call:ended callId=', callId);
      pendingRef.current = null;
      clearOutgoingCall();
      endCall();
    };

    // ── Réponse SDP de l'appelé ───────────────────────────────
    const onAnswer = async ({ sdp, callId }) => {
      console.log('[WebRTC] 📩 webrtc:answer reçu callId=', callId);
      await handleAnswer(sdp);
    };

    // ── Candidats ICE ─────────────────────────────────────────
    const onIce = async ({ candidate }) => {
      await addIceCandidate(candidate);
    };

    socket.on('call:incoming',        onIncoming);
    socket.on('call:initiated',       onInitiated);
    socket.on('call:accepted',        onAccepted);
    socket.on('call:rejected',        onRejected);
    socket.on('call:ended',           onEnded);
    socket.on('webrtc:answer',        onAnswer);
    socket.on('webrtc:ice-candidate', onIce);

    return () => {
      socket.off('call:incoming',        onIncoming);
      socket.off('call:initiated',       onInitiated);
      socket.off('call:accepted',        onAccepted);
      socket.off('call:rejected',        onRejected);
      socket.off('call:ended',           onEnded);
      socket.off('webrtc:answer',        onAnswer);
      socket.off('webrtc:ice-candidate', onIce);
      console.log('[MainLayout] 🔌 handlers retirés');
    };
  }, [socket]);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar />
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
