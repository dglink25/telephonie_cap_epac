import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import Sidebar from './Sidebar';
import NotificationBell from '../notifications/NotificationBell';
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
  const { socket, isConnected } = useSocketStore();
  const { setIncomingCall, setOutgoingCall, clearOutgoingCall, endCall } = useCallStore();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const pendingRef = useRef(null);
  // Verrou par callId pour éviter de traiter deux call:accepted pour le même appel en parallèle
  const handlingCallIds = useRef(new Set());

  // ── Exposer l'initiateur d'appel aux pages ──────────────────
  useEffect(() => {
    window.__capEpacInitiateCall = (calleeId, calleeName, type) => {
      // Réinitialiser proprement avant chaque nouvel appel
      handlingCallIds.current.clear();
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

  useEffect(() => {
    if (!socket || !isConnected) return;

    console.log('[MainLayout] 🔌 handlers enregistrés socket.id=', socket.id);

    // ── Appel entrant ─────────────────────────────────────────
    const onIncoming = (data) => {
      console.log('[Call] 📲 call:incoming', data);
      setIncomingCall(data);
    };

    // ── Serveur confirme + donne le vrai callId ───────────────
    const onInitiated = ({ callId }) => {
      console.log('[Call] call:initiated callId=', callId);
      if (pendingRef.current) {
        pendingRef.current.callId = callId;
        setOutgoingCall({ ...pendingRef.current, callId });
      }
    };

    // ── L'appelé a décroché → créer l'offre SDP ───────────────
    const onAccepted = async ({ callId, acceptedBy }) => {
      console.log('[Call] 📞 call:accepted callId=', callId, 'acceptedBy=', acceptedBy);
      const p = pendingRef.current;
      if (!p) {
        console.warn('[Call] call:accepted sans pending, ignoré');
        return;
      }

      const realCallId = callId || p.callId;

      // Éviter de traiter deux fois le même callId+acceptedBy
      // (peut arriver si call:accepted est émis deux fois ou pour plusieurs membres groupe)
      const lockKey = `${realCallId}:${acceptedBy}`;
      if (handlingCallIds.current.has(lockKey)) {
        console.log('[Call] call:accepted déjà traité pour', lockKey, '— ignoré');
        return;
      }
      handlingCallIds.current.add(lockKey);

      clearOutgoingCall();

      // Pour appel direct : acceptedBy = l'appelé
      // Pour appel de groupe : acceptedBy = le membre qui a décroché en premier
      const targetId = acceptedBy || p.calleeId;

      if (!targetId) {
        console.error('[Call] targetId inconnu — annulation');
        handlingCallIds.current.delete(lockKey);
        return;
      }

      console.log('[WebRTC] → offre SDP vers targetId=', targetId, 'callId=', realCallId, 'type=', p.type);

      try {
        await createAndSendOffer(targetId, realCallId, p.type);
        console.log('[WebRTC] offre SDP envoyée ✅');
      } catch (err) {
        console.error('[WebRTC] createAndSendOffer:', err.message);
        toast.error('Micro inaccessible : ' + err.message);
        terminateCall(realCallId);
        pendingRef.current = null;
        handlingCallIds.current.clear();
      }
      // Ne pas supprimer lockKey — empeche re-traitement du même accept
    };

    // ── L'appelé a refusé ─────────────────────────────────────
    const onRejected = () => {
      console.log('[Call] call:rejected');
      pendingRef.current = null;
      handlingCallIds.current.clear();
      clearOutgoingCall();
      toast.info('📵 Appel refusé');
      endCall();
    };

    // ── Un membre du groupe a refusé (pas tous) ───────────────
    const onMemberRejected = ({ rejectedBy }) => {
      console.log('[Call] membre a refusé:', rejectedBy);
      // Ne rien faire — les autres membres sonnent encore
    };

    // ── Appel terminé ─────────────────────────────────────────
    const onEnded = ({ callId }) => {
      console.log('[Call] call:ended callId=', callId);
      pendingRef.current = null;
      handlingCallIds.current.clear();
      clearOutgoingCall();
      endCall();
    };

    // ── Réponse SDP de l'appelé ───────────────────────────────
    const onAnswer = async ({ sdp, callId }) => {
      console.log('[WebRTC] webrtc:answer reçu callId=', callId);
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
    socket.on('call:member_rejected', onMemberRejected);
    socket.on('call:ended',           onEnded);
    socket.on('webrtc:answer',        onAnswer);
    socket.on('webrtc:ice-candidate', onIce);

    return () => {
      socket.off('call:incoming',        onIncoming);
      socket.off('call:initiated',       onInitiated);
      socket.off('call:accepted',        onAccepted);
      socket.off('call:rejected',        onRejected);
      socket.off('call:member_rejected', onMemberRejected);
      socket.off('call:ended',           onEnded);
      socket.off('webrtc:answer',        onAnswer);
      socket.off('webrtc:ice-candidate', onIce);
      console.log('[MainLayout] 🔌 handlers retirés');
    };
  }, [socket, isConnected]);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar />

      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <aside className={`
        fixed top-0 left-0 bottom-0 w-64 bg-primary-700 text-white z-50
        transform transition-transform duration-300 ease-in-out md:hidden
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex flex-col h-full">
          <div className="px-4 py-5 border-b border-primary-600 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-primary-500 rounded-lg flex items-center justify-center">
                <Menu className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-white text-sm leading-tight">Téléphonie CAP-EPAC</h1>
                <p className="text-primary-200 text-xs">Téléphonie LAN</p>
              </div>
            </div>
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="p-2 hover:bg-primary-600 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <Sidebar isMobile onNavigate={() => setIsMobileMenuOpen(false)} />
        </div>
      </aside>

      <main className="flex-1 overflow-hidden flex flex-col">
        <div className="md:hidden bg-primary-700 text-white px-4 py-3 flex items-center justify-between shadow-md">
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-2 hover:bg-primary-600 rounded-lg transition-colors"
          >
            <Menu className="w-6 h-6" />
          </button>
          <h1 className="font-bold text-lg">CAP-EPAC</h1>
          <div className="flex items-center gap-2">
            <NotificationBell />
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          <Outlet />
        </div>
      </main>
    </div>
  );
}