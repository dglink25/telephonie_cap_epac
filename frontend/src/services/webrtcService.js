// src/services/webrtcService.js
/**
 * Service WebRTC — Flux correct :
 *
 * APPELANT :
 *  1. call:initiate  → serveur → appele reçoit call:incoming
 *  2. Attend call:accepted  (l'appelé a décroché)
 *  3. Crée PeerConnection + offer SDP → envoie webrtc:offer
 *  4. Reçoit webrtc:answer → setRemoteDescription
 *  5. Échange candidats ICE → connexion établie
 *
 * APPELÉ :
 *  1. Reçoit call:incoming → affiche modal
 *  2. Clique Accepter → envoie call:accept
 *  3. Reçoit webrtc:offer → crée PeerConnection + answer → envoie webrtc:answer
 *  4. Échange candidats ICE → connexion établie
 */

import useCallStore from '../store/callStore';
import useSocketStore from '../store/socketStore';

const ICE_SERVERS = [
  // ✅ FIX: TURN LAN en priorité — plus fiable sur réseau local
  {
    urls: [
      `turn:${import.meta.env.VITE_COTURN_HOST || window.location.hostname}:3478?transport=udp`,
      `turn:${import.meta.env.VITE_COTURN_HOST || window.location.hostname}:3478?transport=tcp`,
    ],
    username: 'cap-epac',
    credential: 'CapEpacTurn2025',
  },
  {
    urls: `stun:${import.meta.env.VITE_COTURN_HOST || window.location.hostname}:3478`,
  },
  // STUN Google en fallback
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

// File d'attente des candidats ICE reçus avant que la connexion soit prête
let pendingIceCandidates = [];

/**
 * Obtenir le stream local (micro ± caméra)
 */
export const getLocalStream = async (video = false) => {
  const constraints = {
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      sampleRate: 48000,
    },
    video: video
      ? { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } }
      : false,
  };
  return navigator.mediaDevices.getUserMedia(constraints);
};

/**
 * Créer une PeerConnection WebRTC
 */
export const createPeerConnection = (targetUserId, callId) => {
  const pc = new RTCPeerConnection({
    iceServers: ICE_SERVERS,
    iceCandidatePoolSize: 10,
  });

  const { emit } = useSocketStore.getState();

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      emit('webrtc:ice-candidate', { targetUserId, candidate: event.candidate, callId });
    }
  };

  pc.ontrack = (event) => {
    if (event.streams?.[0]) {
      useCallStore.getState().setRemoteStream(event.streams[0]);
    }
  };

  pc.onconnectionstatechange = () => {
    console.log('[WebRTC] connectionState:', pc.connectionState);
    if (pc.connectionState === 'connected') {
      useCallStore.getState().startTimer();
    }
    if (['failed', 'disconnected'].includes(pc.connectionState)) {
      console.warn('[WebRTC] connexion perdue');
    }
  };

  pc.onsignalingstatechange = () => {
    console.log('[WebRTC] signalingState:', pc.signalingState);
  };

  useCallStore.getState().setPeerConnection(pc);
  pendingIceCandidates = [];
  return pc;
};

/**
 * APPELANT — Étape 1 : initier l'appel (sans créer la PeerConnection encore)
 * La PeerConnection sera créée quand l'appelé accepte (call:accepted)
 */
export const initiateOutgoingCall = (calleeId, type = 'audio') => {
  const { emit } = useSocketStore.getState();
  emit('call:initiate', { calleeId, type });
};

/**
 * APPELANT — Étape 2 : l'appelé a accepté, créer l'offre SDP
 */
export const createAndSendOffer = async (calleeId, callId, type = 'audio') => {
  const video = type === 'video';
  const localStream = await getLocalStream(video);

  useCallStore.getState().startCall({
    calleeId,
    callId,
    type,
    direction: 'outgoing',
  }, localStream);

  const pc = createPeerConnection(calleeId, callId);
  localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

  const offer = await pc.createOffer({
    offerToReceiveAudio: true,
    offerToReceiveVideo: video,
  });
  await pc.setLocalDescription(offer);

  const { emit } = useSocketStore.getState();
  emit('webrtc:offer', { targetUserId: calleeId, sdp: offer, callId });

  return localStream;
};

/**
 * APPELÉ — Étape 3 : recevoir l'offre et créer la réponse SDP
 */
export const answerIncomingCall = async (callerId, sdpOffer, callId, type = 'audio') => {
  const video = type === 'video';
  const localStream = await getLocalStream(video);

  useCallStore.getState().startCall({
    callerId,
    callId,
    type,
    direction: 'incoming',
  }, localStream);

  const pc = createPeerConnection(callerId, callId);
  localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

  await pc.setRemoteDescription(new RTCSessionDescription(sdpOffer));

  // Appliquer les candidats ICE en attente
  for (const candidate of pendingIceCandidates) {
    try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch (_) {}
  }
  pendingIceCandidates = [];

  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);

  const { emit } = useSocketStore.getState();
  emit('webrtc:answer', { targetUserId: callerId, sdp: answer, callId });

  return localStream;
};

/**
 * APPELANT — Étape 4 : recevoir la réponse SDP
 */
export const handleAnswer = async (sdpAnswer) => {
  const { peerConnection } = useCallStore.getState();
  if (!peerConnection) return;
  if (peerConnection.signalingState === 'have-local-offer') {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(sdpAnswer));
    // Appliquer les candidats ICE en attente
    for (const candidate of pendingIceCandidates) {
      try { await peerConnection.addIceCandidate(new RTCIceCandidate(candidate)); } catch (_) {}
    }
    pendingIceCandidates = [];
  }
};

/**
 * Ajouter un candidat ICE (avec mise en file d'attente si pas encore prêt)
 */
export const addIceCandidate = async (candidate) => {
  const { peerConnection } = useCallStore.getState();
  if (!candidate) return;

  if (!peerConnection || !peerConnection.remoteDescription) {
    // Mettre en attente : la remote description n'est pas encore définie
    pendingIceCandidates.push(candidate);
    return;
  }
  try {
    await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
  } catch (err) {
    console.warn('[WebRTC] Erreur ICE candidate:', err.message);
  }
};

/**
 * Terminer un appel
 */
export const terminateCall = (callId) => {
  const { emit } = useSocketStore.getState();
  if (callId) emit('call:end', { callId });
  pendingIceCandidates = [];
  useCallStore.getState().endCall();
};

/**
 * Formater la durée MM:SS
 */
export const formatDuration = (seconds) => {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};
