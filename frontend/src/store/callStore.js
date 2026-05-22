// src/store/callStore.js
import { create } from 'zustand';

const useCallStore = create((set, get) => ({
  // Appel actif (audio/vidéo établi)
  activeCall: null,
  // Appel entrant en attente de réponse
  incomingCall: null,
  // Appel sortant en cours (sonnerie côté appelant)
  outgoingCall: null,

  localStream: null,
  remoteStream: null,
  peerConnection: null,

  isMuted: false,
  isVideoOn: false,
  isOnHold: false,
  callDuration: 0,
  durationInterval: null,

  // ── Appel entrant ──────────────────────────────────────────
  setIncomingCall: (data) => set({ incomingCall: data }),
  clearIncomingCall: () => set({ incomingCall: null }),

  // ── Appel sortant (modal sonnerie appelant) ────────────────
  setOutgoingCall: (data) => set({ outgoingCall: data }),
  clearOutgoingCall: () => set({ outgoingCall: null }),

  // ── Appel actif ────────────────────────────────────────────
  startCall: (callData, localStream) =>
    set({
      activeCall: callData,
      outgoingCall: null,
      incomingCall: null,
      localStream,
      isMuted: false,
      // ✅ isVideoOn basé sur le type d'appel
      isVideoOn: callData.type === 'video',
      callDuration: 0,
    }),

  setRemoteStream: (stream) => set({ remoteStream: stream }),
  setPeerConnection: (pc) => set({ peerConnection: pc }),

  // ── Contrôles ──────────────────────────────────────────────

  // ✅ FIX: était `t.enabled = isMuted` (inversé) → corrigé en `t.enabled = !isMuted`
  toggleMute: () => {
    const { localStream, isMuted } = get();
    const newMuted = !isMuted;
    if (localStream) {
      localStream.getAudioTracks().forEach((t) => {
        t.enabled = !newMuted; // enabled=false quand muet
      });
    }
    set({ isMuted: newMuted });
    return newMuted; // retourne le NOUVEL état
  },

  toggleVideo: () => {
    const { localStream, isVideoOn } = get();
    const newVideoOn = !isVideoOn;
    if (localStream) {
      localStream.getVideoTracks().forEach((t) => {
        t.enabled = newVideoOn;
      });
    }
    set({ isVideoOn: newVideoOn });
    return newVideoOn;
  },

  // ✅ FIX: Hold coupe/remet l'audio sur le stream local
  toggleHold: () => {
    const { localStream, isOnHold } = get();
    const newHold = !isOnHold;
    if (localStream) {
      localStream.getAudioTracks().forEach((t) => {
        t.enabled = !newHold; // couper le son en attente
      });
    }
    set({ isOnHold: newHold });
    return newHold;
  },

  // ── Timer ──────────────────────────────────────────────────
  startTimer: () => {
    // Éviter plusieurs intervals en parallèle
    const { durationInterval } = get();
    if (durationInterval) clearInterval(durationInterval);

    const interval = setInterval(() => {
      set((s) => ({ callDuration: s.callDuration + 1 }));
    }, 1000);
    set({ durationInterval: interval });
  },

  stopTimer: () => {
    const { durationInterval } = get();
    if (durationInterval) clearInterval(durationInterval);
    set({ durationInterval: null });
  },

  // ── Fin d'appel ────────────────────────────────────────────
  endCall: () => {
    const { localStream, peerConnection, durationInterval } = get();
    if (durationInterval) clearInterval(durationInterval);
    if (localStream) localStream.getTracks().forEach((t) => t.stop());
    if (peerConnection) {
      try { peerConnection.close(); } catch (_) {}
    }
    set({
      activeCall: null,
      incomingCall: null,
      outgoingCall: null,
      localStream: null,
      remoteStream: null,
      peerConnection: null,
      isMuted: false,
      isVideoOn: false,
      isOnHold: false,
      callDuration: 0,
      durationInterval: null,
    });
  },
}));

export default useCallStore;  