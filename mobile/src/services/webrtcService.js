// mobile/src/services/webrtcService.js
/**
 * Service WebRTC pour React Native
 * Utilise react-native-webrtc au lieu des APIs navigateur
 *
 * Pour installer : npm install react-native-webrtc
 * Et ajouter dans app.json :
 * "plugins": ["react-native-webrtc"]
 */
import {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  mediaDevices,
} from 'react-native-webrtc';
import useCallStore from '../store/callStore';
import useSocketStore from '../store/socketStore';

const ICE_SERVERS = [
  {
    urls: [
      `stun:${process.env.EXPO_PUBLIC_COTURN_HOST || '192.168.1.100'}:3478`,
    ],
  },
  {
    urls: [
      `turn:${process.env.EXPO_PUBLIC_COTURN_HOST || '192.168.1.100'}:3478`,
    ],
    username: 'cap-epac',
    credential: 'CapEpacTurn2025',
  },
];

let pendingIceCandidates = [];

/**
 * Obtenir le stream local (micro ± caméra)
 */
export const getLocalStream = async (video = false) => {
  const constraints = {
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
    },
    video: video
      ? { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 }, facingMode: 'user' }
      : false,
  };
  return mediaDevices.getUserMedia(constraints);
};

/**
 * Créer une PeerConnection
 */
export const createPeerConnection = (targetUserId, callId) => {
  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
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
  };

  useCallStore.getState().setPeerConnection(pc);
  pendingIceCandidates = [];
  return pc;
};

/**
 * APPELANT — Créer et envoyer l'offre SDP
 */
export const createAndSendOffer = async (calleeId, callId, type = 'audio') => {
  const video = type === 'video';
  const localStream = await getLocalStream(video);

  useCallStore.getState().startCall({ calleeId, callId, type, direction: 'outgoing' }, localStream);

  const pc = createPeerConnection(calleeId, callId);
  localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

  const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: video });
  await pc.setLocalDescription(offer);

  const { emit } = useSocketStore.getState();
  emit('webrtc:offer', { targetUserId: calleeId, sdp: offer, callId });

  return localStream;
};

/**
 * APPELÉ — Recevoir l'offre et créer la réponse SDP
 */
export const answerIncomingCall = async (callerId, sdpOffer, callId, type = 'audio') => {
  const video = type === 'video';
  const localStream = await getLocalStream(video);

  useCallStore.getState().startCall({ callerId, callId, type, direction: 'incoming' }, localStream);

  const pc = createPeerConnection(callerId, callId);
  localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

  await pc.setRemoteDescription(new RTCSessionDescription(sdpOffer));

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
 * APPELANT — Recevoir la réponse SDP
 */
export const handleAnswer = async (sdpAnswer) => {
  const { peerConnection } = useCallStore.getState();
  if (!peerConnection) return;
  if (peerConnection.signalingState === 'have-local-offer') {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(sdpAnswer));
    for (const candidate of pendingIceCandidates) {
      try { await peerConnection.addIceCandidate(new RTCIceCandidate(candidate)); } catch (_) {}
    }
    pendingIceCandidates = [];
  }
};

/**
 * Ajouter un candidat ICE
 */
export const addIceCandidate = async (candidate) => {
  const { peerConnection } = useCallStore.getState();
  if (!candidate) return;
  if (!peerConnection || !peerConnection.remoteDescription) {
    pendingIceCandidates.push(candidate);
    return;
  }
  try {
    await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
  } catch (err) {
    console.warn('[WebRTC] Erreur ICE:', err.message);
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