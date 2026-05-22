// mobile/src/store/callStore.js
import { create } from 'zustand';

const useCallStore = create((set, get) => ({
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

  // ── Appel entrant ──────────────────────────────────────────
  setIncomingCall: (data) => set({ incomingCall: data }),
  clearIncomingCall: () => set({ incomingCall: null }),

  // ── Appel sortant ──────────────────────────────────────────
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
      isVideoOn: callData.type === 'video',
      callDuration: 0,
    }),

  setRemoteStream: (stream) => set({ remoteStream: stream }),
  setPeerConnection: (pc) => set({ peerConnection: pc }),

  // ── Contrôles ──────────────────────────────────────────────
  toggleMute: () => {
    const { localStream, isMuted } = get();
    if (localStream) {
      localStream.getAudioTracks().forEach((t) => (t.enabled = isMuted));
    }
    set({ isMuted: !isMuted });
    return !isMuted;
  },

  toggleVideo: () => {
    const { localStream, isVideoOn } = get();
    if (localStream) {
      localStream.getVideoTracks().forEach((t) => (t.enabled = !isVideoOn));
    }
    set({ isVideoOn: !isVideoOn });
    return !isVideoOn;
  },

  toggleHold: () => set((s) => ({ isOnHold: !s.isOnHold })),

  // ── Timer durée d'appel ────────────────────────────────────
  startTimer: () => {
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
    if (localStream) {
      try {
        localStream.getTracks().forEach((t) => t.stop());
      } catch (_) {}
    }
    if (peerConnection) {
      try {
        peerConnection.close();
      } catch (_) {}
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